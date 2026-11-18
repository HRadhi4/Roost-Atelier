"""Where homes are kept: Home Assistant's own storage, plus a folder for uploaded pictures."""
from __future__ import annotations

import time
import uuid
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION


class PlanStore:
    """All homes (plans) built in the Atelier."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY, minor_version=1)
        self.plans: dict[str, dict[str, Any]] = {}

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.plans = data.get("plans", {})

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"plans": self.plans}, 1.0)

    def summary(self) -> list[dict[str, Any]]:
        return [
            {"id": pid, "name": p.get("name", "Home"), "updated": p.get("updated", 0), "floors": len(p.get("floors", []))}
            for pid, p in sorted(self.plans.items(), key=lambda kv: -kv[1].get("updated", 0))
        ]

    def get(self, plan_id: str) -> dict[str, Any] | None:
        return self.plans.get(plan_id)

    def save(self, plan: dict[str, Any]) -> dict[str, Any]:
        pid = plan.get("id") or uuid.uuid4().hex[:12]
        plan = {**plan, "id": pid, "updated": int(time.time())}
        self.plans[pid] = plan
        self._save()
        return plan

    def delete(self, plan_id: str) -> bool:
        if self.plans.pop(plan_id, None) is None:
            return False
        self._save()
        return True
