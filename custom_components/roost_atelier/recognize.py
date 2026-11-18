"""Furniture from a photo: Home Assistant's own AI (an AI Task) names each piece, its colour and rough size."""
from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.core import HomeAssistant
from homeassistant.helpers import selector

from .uploads import folder

KINDS = [
    "sofa", "sofa_l", "armchair", "coffee_table", "side_table", "tv_unit", "tv", "dining_table", "dining_chair", "bed_double",
    "bed_single", "nightstand", "wardrobe", "dresser", "desk", "office_chair", "bookshelf", "rug", "plant", "floor_lamp",
    "pendant_lamp", "kitchen_island", "fridge", "stove", "sink_cabinet", "bathtub", "shower", "toilet", "basin", "mirror",
    "curtain", "ac_split", "bench", "ottoman", "console", "cabinet",
]

STRUCTURE = {
    "items": {
        "description": "Every piece of furniture or fixture seen in the photo",
        "required": True,
        "selector": {"object": {}},
    }
}

INSTRUCTIONS = (
    "Look at this photo of a room. List every piece of furniture and fixture you can see. "
    "For each give: kind (one of: " + ", ".join(KINDS) + "), colour as a hex value of its main material, "
    "material (fabric, leather, wood, metal, glass, stone, plastic), approximate width, depth and height in metres, "
    "and its position in the photo as left, centre or right. Answer as a JSON list in the 'items' field."
)


async def async_recognize(hass: HomeAssistant, file: str, entity_id: str | None) -> dict[str, Any]:
    if "ai_task" not in hass.config.components:
        raise ValueError("Set up an AI Task first (Settings → Devices & services → add an AI provider), then try again")
    src = folder(hass) / file
    if not src.is_file():
        raise ValueError("The photo was not found")
    media_dir = hass.config.media_dirs.get("local")
    if not media_dir:
        raise ValueError("Home Assistant has no media folder to show the photo to the AI")
    dest_dir = Path(media_dir) / "roost_atelier"
    await hass.async_add_executor_job(lambda: (dest_dir.mkdir(parents=True, exist_ok=True), shutil.copy(src, dest_dir / file)))
    data: dict[str, Any] = {
        "task_name": "Roost Atelier furniture",
        "instructions": INSTRUCTIONS,
        "structure": STRUCTURE,
        "attachments": [{"media_content_id": f"media-source://media_source/local/roost_atelier/{file}", "media_content_type": "image/jpeg"}],
    }
    if entity_id:
        data["entity_id"] = entity_id
    result = await hass.services.async_call("ai_task", "generate_data", data, blocking=True, return_response=True)
    items = (result or {}).get("data", {}).get("items", []) if isinstance(result, dict) else []
    clean = []
    for it in items if isinstance(items, list) else []:
        if not isinstance(it, dict) or it.get("kind") not in KINDS:
            continue
        clean.append({
            "kind": it["kind"],
            "colour": str(it.get("colour") or it.get("color") or "#9a9a9a")[:9],
            "material": str(it.get("material") or "fabric")[:16],
            "w": _num(it.get("width")), "d": _num(it.get("depth")), "h": _num(it.get("height")),
            "where": str(it.get("position") or "centre")[:8],
        })
    return {"items": clean}


def _num(v: Any) -> float | None:
    try:
        f = float(v)
        return f if 0.05 < f < 8 else None
    except (TypeError, ValueError):
        return None


_ = (vol, selector)
