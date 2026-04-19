"""
solana_writer.py — On-chain write layer for Argus.

Writes WorkSignal data to the Swarm Bus program on Solana devnet.
Uses solders for keypair / transaction building and httpx for RPC.
"""

from __future__ import annotations

import base64
import json
import logging
import struct
from pathlib import Path
from typing import Any, Optional

import httpx
from solders.hash import Hash  # type: ignore[import]
from solders.keypair import Keypair  # type: ignore[import]
from solders.instruction import Instruction, AccountMeta  # type: ignore[import]
from solders.message import Message  # type: ignore[import]
from solders.pubkey import Pubkey  # type: ignore[import]
from solders.transaction import Transaction  # type: ignore[import]
from solders.system_program import ID as SYSTEM_PROGRAM_ID  # type: ignore[import]

from apps.agent1.schema import WorkSignal

logger = logging.getLogger("argus.solana")


class SolanaWriter:
    """
    Writes WorkSignal payloads to the Swarm Bus program on Solana.

    The writer:
      1. Serialises the signal into a compact binary instruction payload.
      2. Derives a PDA for the signal account.
      3. Builds, signs, and sends the transaction.
      4. Confirms the transaction on-chain.
    """

    def __init__(
        self,
        rpc_url: str,
        program_id: str,
        keypair_path: str,
    ) -> None:
        self._rpc_url = rpc_url
        self._program_id = Pubkey.from_string(program_id)
        self._keypair = self._load_keypair(keypair_path)
        logger.info(
            "SolanaWriter initialised — program=%s  signer=%s",
            program_id,
            str(self._keypair.pubkey()),
        )

    # ------------------------------------------------------------------
    # Keypair loading
    # ------------------------------------------------------------------
    @staticmethod
    def _load_keypair(path: str) -> Keypair:
        """Load a Solana keypair from a JSON file (Solana CLI format)."""
        expanded = Path(path).expanduser()
        if not expanded.exists():
            logger.warning(
                "Keypair file not found at %s — generating an ephemeral keypair. "
                "This is fine for testing but NOT for production.",
                expanded,
            )
            kp = Keypair()
            logger.info("Ephemeral keypair pubkey: %s", str(kp.pubkey()))
            return kp

        raw = json.loads(expanded.read_text())
        return Keypair.from_bytes(bytes(raw))

    # ------------------------------------------------------------------
    # RPC helpers
    # ------------------------------------------------------------------
    async def _rpc_call(self, method: str, params: list[Any]) -> dict[str, Any]:
        """Make a JSON-RPC call to the Solana cluster."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                self._rpc_url,
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": method,
                    "params": params,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            if "error" in data:
                raise RuntimeError(f"RPC error: {data['error']}")
            return data

    async def _get_latest_blockhash(self) -> Hash:
        data = await self._rpc_call(
            "getLatestBlockhash",
            [{"commitment": "finalized"}],
        )
        bh = data["result"]["value"]["blockhash"]
        return Hash.from_string(bh)

    async def get_balance(self) -> float:
        """Return the SOL balance of the signer in SOL."""
        data = await self._rpc_call(
            "getBalance",
            [str(self._keypair.pubkey()), {"commitment": "confirmed"}],
        )
        lamports = data["result"]["value"]
        return lamports / 1_000_000_000

    # ------------------------------------------------------------------
    # PDA derivation
    # ------------------------------------------------------------------
    def derive_signal_pda(self, signal_id: str) -> tuple[Pubkey, int]:
        """Derive a Program Derived Address for the signal account."""
        seeds = [b"work_signal", signal_id.encode()[:32]]
        return Pubkey.find_program_address(seeds, self._program_id)

    # ------------------------------------------------------------------
    # Instruction building
    # ------------------------------------------------------------------
    def _build_instruction(self, signal: WorkSignal) -> Instruction:
        """
        Build the Solana instruction to write a WorkSignal.

        Instruction layout:
          [0:8]   discriminator (sha256("global:emit_work_signal")[..8])
          [8:..]  borsh serialized args: signal_id (String), schema_version (u32), payload (String)
        """
        import hashlib
        
        # 1. 8-byte discriminator
        discriminator = hashlib.sha256(b"global:emit_work_signal").digest()[:8]
        
        # 2. Borsh serialize signal_id
        signal_id_bytes = signal.signal_id.encode()
        signal_id_borsh = struct.pack("<I", len(signal_id_bytes)) + signal_id_bytes
        
        # 3. Borsh serialize schema_version (u32)
        schema_ver_borsh = struct.pack("<I", signal.schema_version)
        
        # 4. Borsh serialize payload (JSON string)
        payload_json = json.dumps(
            signal.to_bus_payload(),
            separators=(",", ":"),
            sort_keys=True,
        ).encode()
        payload_borsh = struct.pack("<I", len(payload_json)) + payload_json

        ix_data = discriminator + signal_id_borsh + schema_ver_borsh + payload_borsh

        # Derive PDA
        pda, _bump = self.derive_signal_pda(signal.signal_id)

        accounts = [
            AccountMeta(pubkey=self._keypair.pubkey(), is_signer=True, is_writable=True),   # payer
            AccountMeta(pubkey=pda, is_signer=False, is_writable=True),                      # signal PDA
            AccountMeta(pubkey=SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),        # system program
        ]

        return Instruction(self._program_id, ix_data, accounts)

    # ------------------------------------------------------------------
    # Submit
    # ------------------------------------------------------------------
    async def write_signal(self, signal: WorkSignal) -> Optional[str]:
        """
        Write a WorkSignal to the Swarm Bus on-chain.

        Returns the transaction signature on success, None on failure.
        """
        try:
            ix = self._build_instruction(signal)
            blockhash = await self._get_latest_blockhash()

            msg = Message.new_with_blockhash(
                [ix],
                self._keypair.pubkey(),
                blockhash,
            )
            tx = Transaction.new_unsigned(msg)
            tx.sign([self._keypair], blockhash)

            tx_bytes = bytes(tx)
            tx_b64 = base64.b64encode(tx_bytes).decode()

            result = await self._rpc_call(
                "sendTransaction",
                [
                    tx_b64,
                    {
                        "encoding": "base64",
                        "skipPreflight": True,
                        "preflightCommitment": "confirmed",
                    },
                ],
            )

            sig = result.get("result")
            if sig:
                logger.info(
                    "✓ Signal %s written on-chain — tx: %s",
                    signal.signal_id[:8],
                    sig,
                )
                return sig

            logger.error("Transaction returned no signature: %s", result)
            return None

        except Exception as exc:
            logger.error(
                "✗ Failed to write signal %s: %s",
                signal.signal_id[:8],
                exc,
            )
            return None

    async def confirm_transaction(self, signature: str, timeout: int = 30) -> bool:
        """Poll for transaction confirmation."""
        import asyncio

        for _ in range(timeout):
            try:
                result = await self._rpc_call(
                    "getSignatureStatuses",
                    [[signature]],
                )
                statuses = result.get("result", {}).get("value", [])
                if statuses and statuses[0] is not None:
                    status = statuses[0]
                    if status.get("confirmationStatus") in (
                        "confirmed",
                        "finalized",
                    ):
                        return True
                    if status.get("err"):
                        logger.error("Transaction failed: %s", status["err"])
                        return False
            except Exception as exc:
                logger.warning("Confirmation poll error: %s", exc)
            await asyncio.sleep(1)

        logger.warning("Transaction confirmation timed out: %s", signature)
        return False
