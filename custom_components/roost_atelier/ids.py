"""Ids inside a home (the home itself, rooms, devices, furniture, openings) end up in page attributes and in
picture addresses, so only letters, digits, "_" and "-" are kept. A home file shared online or edited by hand
can't slip anything else in. No Home Assistant imports: tested on its own.
"""
from __future__ import annotations

import re
import uuid
from typing import Any

BAD = re.compile(r"[^A-Za-z0-9_-]")


def clean_id(value: Any) -> str:
    text = BAD.sub("", str(value or ""))[:40]
    return text or uuid.uuid4().hex[:12]


def clean_ids(obj: Any) -> Any:
    """Every "id" in the home, at any depth, made safe (other values are left as they are)."""
    if isinstance(obj, dict):
        return {k: (clean_id(v) if k == "id" and isinstance(v, (str, int)) else clean_ids(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_ids(v) for v in obj]
    return obj
