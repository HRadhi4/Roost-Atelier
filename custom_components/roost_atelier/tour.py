"""What a dashboard card needs to show a home as pictures: the rooms, doors, windows and devices of each level,
and which pictures the Atelier has made. The card (Roost Home Tour, in Roost Cards) asks for this and then loads
the pictures themselves from /api/roost_atelier/photo/<plan>_<level>_<key>.

No Home Assistant imports: tested on its own.
"""
from __future__ import annotations

from typing import Any

# bump when the shape below changes in a way a card must know about
TOUR_VERSION = 1


def _num(v: Any, default: float = 0.0) -> float:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else default


def tour_data(plan: dict[str, Any], photos: list[dict[str, Any]]) -> dict[str, Any]:
    """A light copy of a home: only what the pictures card uses (no furniture, walls or light settings)."""
    pid = plan.get("id", "")
    floors = []
    for fi, f in enumerate(plan.get("floors") or []):
        pre = f"{pid}_{fi}_"
        pics = {p["key"][len(pre):]: p["updated"] for p in photos if p.get("key", "").startswith(pre)}
        floors.append({
            "index": fi,
            "name": f.get("name") or "",
            "height": _num(f.get("height"), 2.8),
            "rooms": [{"id": r.get("id"), "name": r.get("name") or "", "type": r.get("type") or "", "pts": r.get("pts") or [],
                       **({"pano": r["pano"]} if r.get("pano") else {})} for r in f.get("rooms") or []],
            "openings": [{"type": o.get("type") or "window", "x": _num(o.get("x")), "y": _num(o.get("y")),
                          "sill": _num(o.get("sill")), "height": _num(o.get("height"), 2.0)} for o in f.get("openings") or []],
            "devices": [{k: d[k] for k in ("id", "entity", "kind", "look", "x", "y", "z", "name") if d.get(k) is not None}
                        for d in f.get("devices") or [] if d.get("entity")],
            # which pictures exist and when they were made: "all" (the whole level), a room id (its photo), "pano_<room id>" (its 360°)
            "pictures": pics,
        })
    return {"version": TOUR_VERSION, "id": pid, "name": plan.get("name") or "", "updated": plan.get("updated"), "floors": floors}
