"""
base.py — Abstract base class for all platform adapters.

Every adapter must:
  1. Set `platform_name` to a `Platform` enum value.
  2. Implement at least one of `handle_webhook()` or `poll()`.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any, Optional

from fastapi import Request

from apps.agent1.schema import Platform, WorkSignal

logger = logging.getLogger("argus.adapter")


class PlatformAdapter(ABC):
    """
    Base contract that every Argus platform adapter fulfils.
    """

    # Subclass MUST set this
    platform_name: Platform

    # ------------------------------------------------------------------
    # Webhook path — override if non-default
    # ------------------------------------------------------------------
    @property
    def webhook_route(self) -> str:
        """URL path that the agent's HTTP server will mount."""
        return f"/webhook/{self.platform_name.value}"

    # ------------------------------------------------------------------
    # Webhook handling (push-based adapters)
    # ------------------------------------------------------------------
    async def handle_webhook(
        self,
        request: Request,
        payload: dict[str, Any],
    ) -> Optional[list[WorkSignal]]:
        """
        Process an inbound webhook from the platform.

        Return a list of WorkSignals (may be empty), or None to indicate
        the event should be silently ignored (e.g. ping events).
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} does not implement handle_webhook()"
        )

    # ------------------------------------------------------------------
    # Polling (pull-based adapters)
    # ------------------------------------------------------------------
    async def poll(self) -> list[WorkSignal]:
        """
        Actively query the platform for new work events.

        Called on a timer by the agent core loop.
        Return an empty list when there is nothing new.
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} does not implement poll()"
        )

    # ------------------------------------------------------------------
    # Validation helpers
    # ------------------------------------------------------------------
    async def verify_signature(self, request: Request) -> bool:
        """
        Verify the webhook payload signature.
        Default: always passes.  Override for platforms that sign payloads.
        """
        return True

    # ------------------------------------------------------------------
    # Repr
    # ------------------------------------------------------------------
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} platform={self.platform_name.value}>"
