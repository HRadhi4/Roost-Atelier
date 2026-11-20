"""Where homes are kept: Home Assistant's own storage, plus a folder for uploaded pictures.

Every save keeps the version it replaces (the last 10 of each home), and a deleted home is kept too,
so a bad edit or a delete can be undone later.
"""
from __future__ import annotations

import time
import uuid
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .ids import clean_id, clean_ids
from .const import STORAGE_KEY, STORAGE_VERSION

KEEP = 10          # earlier versions kept per home
KEEP_DELETED = 10  # deleted homes kept


class Conflict(Exception):
    """The home was saved from another screen after this one opened it."""


def _now() -> int:
    return int(time.time() * 1000)


class PlanStore:
    """All homes (plans) built in the Atelier."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY, minor_version=1)
        self._old: Store[dict[str, Any]] = Store(hass, 1, f"{STORAGE_KEY}_history")
        self.plans: dict[str, dict[str, Any]] = {}
        self.history: dict[str, list[dict[str, Any]]] = {}
        self.deleted: list[dict[str, Any]] = []

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.plans = {clean_id(k): clean_ids(v) for k, v in (data.get("plans") or {}).items()}
        old = await self._old.async_load() or {}
        self.history = {clean_id(k): clean_ids(v) for k, v in (old.get("history") or {}).items()}
        self.deleted = clean_ids(old.get("deleted") or [])

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"plans": self.plans}, 1.0)

    def _save_old(self) -> None:
        self._old.async_delay_save(lambda: {"history": self.history, "deleted": self.deleted}, 5.0)

    def summary(self) -> list[dict[str, Any]]:
        return [
            {"id": pid, "name": p.get("name", "Home"), "updated": p.get("updated", 0), "floors": len(p.get("floors", []))}
            for pid, p in sorted(self.plans.items(), key=lambda kv: -kv[1].get("updated", 0))
        ]

    def get(self, plan_id: str) -> dict[str, Any] | None:
        return self.plans.get(plan_id)

    def save(self, plan: dict[str, Any], base: int | None = None, force: bool = False) -> dict[str, Any]:
        plan = clean_ids(plan)
        pid = plan.get("id") or uuid.uuid4().hex[:12]
        old = self.plans.get(pid)
        if old and not force and base is not None and old.get("updated", 0) != base:
            raise Conflict(old.get("updated", 0))
        if old:
            # keep what it was, at most one version a minute (typing saves often)
            versions = self.history.setdefault(pid, [])
            if not versions or old.get("updated", 0) - versions[0].get("updated", 0) > 60_000 or force:
                versions.insert(0, old)
            else:
                versions[0] = old
            del versions[KEEP:]
            self._save_old()
        new_time = max(_now(), (old or {}).get("updated", 0) + 1)
        plan = {**plan, "id": pid, "updated": new_time}
        self.plans[pid] = plan
        self._save()
        return plan

    def versions(self, plan_id: str) -> list[dict[str, Any]]:
        return [_brief(p) for p in self.history.get(plan_id, [])]

    def version(self, plan_id: str, updated: int) -> dict[str, Any] | None:
        for p in self.history.get(plan_id, []):
            if p.get("updated") == updated:
                return p
        for p in self.deleted:
            if p.get("id") == plan_id and p.get("updated") == updated:
                return p
        return None

    def deleted_list(self) -> list[dict[str, Any]]:
        return [{**_brief(p), "id": p.get("id"), "name": p.get("name", "Home"), "deleted_at": p.get("deleted_at", 0)} for p in self.deleted]

    def delete(self, plan_id: str) -> bool:
        plan = self.plans.pop(plan_id, None)
        if plan is None:
            return False
        self.deleted.insert(0, {**plan, "deleted_at": _now()})
        del self.deleted[KEEP_DELETED:]
        self._save()
        self._save_old()
        return True

    def undelete(self, plan_id: str) -> dict[str, Any] | None:
        for i, p in enumerate(self.deleted):
            if p.get("id") == plan_id:
                self.deleted.pop(i)
                plan = {k: v for k, v in p.items() if k != "deleted_at"}
                if plan_id in self.plans:
                    plan["id"] = uuid.uuid4().hex[:12]
                plan["updated"] = _now()
                self.plans[plan["id"]] = plan
                self._save()
                self._save_old()
                return plan
        return None

    def used_files(self) -> set[str]:
        """Every uploaded file a home (or a kept version) still points at."""
        found: set[str] = set()

        def walk(v: Any) -> None:
            if isinstance(v, dict):
                for x in v.values():
                    walk(x)
            elif isinstance(v, list):
                for x in v:
                    walk(x)
            elif isinstance(v, str) and len(v) >= 18 and "." in v:
                found.add(v.rsplit("/", 1)[-1])

        walk(self.plans)
        walk(self.history)
        walk(self.deleted)
        return found


def _brief(p: dict[str, Any]) -> dict[str, Any]:
    floors = p.get("floors", [])
    return {"updated": p.get("updated", 0), "name": p.get("name", "Home"), "floors": len(floors),
            "rooms": sum(len(f.get("rooms", [])) for f in floors),
            "items": sum(len(f.get("items", [])) for f in floors)}
