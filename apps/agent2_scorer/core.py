"""
Agent 2 — Scorer (Example)

Listens to the Solana Swarm Bus for newly emitted WorkSignals.
Evaluates the signal (mocked here, but would use LLM) and prints the score.
"""

import asyncio
import base64
import json
import logging
from typing import Any

from solana.rpc.async_api import AsyncClient
from solders.pubkey import Pubkey # type: ignore[import]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("scorer")

SWARM_BUS_PROGRAM_ID = Pubkey.from_string("G9ADiy7bb4bfqjEbihS8Mfaq1VSv7NvVRzyiQrFVjDSE")

async def listen_to_bus():
    """Subscribe to all accounts owned by the Swarm Bus program."""
    uri = "wss://api.devnet.solana.com"
    logger.info("Connecting to Solana Devnet WS: %s", uri)
    
    # In a real app we use the solana websocket client
    from solana.rpc.websocket_api import connect

    async with connect(uri) as websocket:
        await websocket.program_subscribe(SWARM_BUS_PROGRAM_ID)
        logger.info("Subscribed to Swarm Bus program: %s", SWARM_BUS_PROGRAM_ID)
        
        first_resp = await websocket.recv()
        logger.info("Subscription established: %s", first_resp)

        while True:
            msg = await websocket.recv()
            
            for item in msg:
                try:
                    result = item.result
                    if not result:
                        continue
                    
                    account_data = result.value.account.data
                    if isinstance(account_data, list) and account_data[1] == "base64":
                        raw_bytes = base64.b64decode(account_data[0])
                        # The first 8 bytes are the Anchor discriminator
                        # The rest is the borsh serialized data
                        # For a simple demo, we can just look for the JSON payload inside the bytes
                        
                        # Find the first { and last } to extract JSON payload (hacky but works for demo if JSON is inside)
                        try:
                            start = raw_bytes.index(b'{')
                            end = raw_bytes.rindex(b'}') + 1
                            json_str = raw_bytes[start:end].decode('utf-8')
                            signal = json.loads(json_str)
                            
                            logger.info("🎯 Detected new WorkSignal!")
                            logger.info("  Signal ID: %s", signal.get("signal_id"))
                            logger.info("  Platform: %s", signal.get("platform"))
                            logger.info("  Contributor: %s", signal.get("contributor"))
                            logger.info("  Title: %s", signal.get("title"))
                            
                            # MOCK SCORING LOGIC
                            score = 9 if signal.get("platform") == "github" else 7
                            logger.info("⚖️ Scored WorkSignal at %d/10. Ready for Agent 3 (Paymaster).", score)
                            
                        except ValueError:
                            # Not a valid JSON structure or padding
                            pass
                            
                except Exception as e:
                    logger.error("Error processing message: %s", e)

def main():
    asyncio.run(listen_to_bus())

if __name__ == "__main__":
    main()
