"""Furniture from a photo: Home Assistant's own AI (an AI Task) names each piece, its colour and rough size."""
from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.core import HomeAssistant
from homeassistant.helpers import selector

from .uploads import folder

# what the AI may answer (the same list as CATALOG in src/fromphoto.js, checked by the tests)
KINDS = [
    "sofa",
    "corner_sofa",
    "armchair",
    "lounge_chair",
    "coffee_table",
    "round_coffee_table",
    "side_table",
    "tv_unit",
    "rug",
    "pouf",
    "bookshelf",
    "open_shelves",
    "console",
    "bench",
    "majlis_seating",
    "dining_table",
    "dining_chair",
    "bar_stool",
    "double_bed",
    "single_bed",
    "nightstand",
    "wardrobe",
    "chest_of_drawers",
    "desk",
    "office_chair",
    "wall_panelling",
    "round_mirror",
    "leaning_mirror",
    "mirror",
    "base_cabinets",
    "wall_cabinets",
    "tall_cabinet",
    "oven_tower",
    "hob_and_oven",
    "sink_cabinet",
    "cooker_hood",
    "kitchen_island",
    "fridge",
    "washing_machine",
    "toilet",
    "wall_basin",
    "basin_vanity",
    "led_mirror",
    "shower",
    "bathtub",
    "towel_rail",
    "extractor_fan",
    "plant",
    "small_plant",
    "floor_lamp",
    "recessed_spot",
    "twin_recessed_spot",
    "square_led_panel",
    "round_led_panel",
    "magnetic_slot_light",
    "led_strip",
    "hidden_cove_light",
    "track_light",
    "pendant_lamp",
    "basket_pendant",
    "chandelier",
    "candle_chandelier",
    "ceiling_light",
    "air_conditioner",
    "curtain",
    "tv",
    "ceiling_fan",
    "window",
    "door",
]

# help telling similar things apart, in the words a person would use
HINTS = """
Ceiling lights, count every fitting you can see:
- recessed_spot: a small round light set flush into the ceiling (about 8-12 cm).
- twin_recessed_spot: two small round spots side by side in one fitting.
- square_led_panel: a flat square glowing panel in the ceiling. round_led_panel: a flat or slim round glowing disc or drum (often 25-40 cm).
- magnetic_slot_light: a thin black line cut into the ceiling with short glowing bars along it. Give its length in metres and how many bars glow.
- led_strip: a continuous glowing line. hidden_cove_light: light washing up from a hidden ledge or a dropped ceiling edge.
- track_light: a surface rail with several spot heads.
- pendant_lamp: one shade hanging on a cord; basket_pendant when the shade is woven rattan, seagrass or wicker.
- chandelier: a crystal or ring chandelier; candle_chandelier when black or brass arms hold candle-shaped bulbs.
- ceiling_light: a dome or round fitting stuck to the ceiling. ceiling_fan: a fan with blades hanging from the ceiling.
Things a smart home controls: air_conditioner (a wall split unit), curtain (fabric curtains or a blind; one entry per window), tv, ceiling_fan.
Kitchen: base_cabinets (the lower run with a worktop), wall_cabinets (upper cabinets on the wall), tall_cabinet (floor to ceiling),
oven_tower (a tall cabinet with built-in ovens or microwave), hob_and_oven (gas or electric hob with an oven under it), sink_cabinet,
cooker_hood, fridge, washing_machine, kitchen_island.
Bathroom: toilet, wall_basin (a basin on the wall without a cabinet), basin_vanity (a basin on a cabinet), led_mirror (a mirror with a
glowing edge), mirror, shower (a shower area or column), bathtub, towel_rail, extractor_fan (a small square fan high on the wall).
Bedroom and dressing: double_bed, single_bed, nightstand, wardrobe (built-in or free-standing, give the total width), chest_of_drawers,
leaning_mirror (a tall mirror standing on the floor against the wall), round_mirror, wall_panelling (a grid of mouldings on a wall).
Living: sofa (one entry per sofa), corner_sofa, armchair, lounge_chair (a low rattan or cane chair with a cushion), coffee_table,
round_coffee_table, side_table, tv_unit, rug (one entry per rug), bench, dining_table, dining_chair, bar_stool, bookshelf, open_shelves,
console, pouf, plant, small_plant, floor_lamp, majlis_seating.
Openings: window (give width, height and sill height in metres), door.
"""

STRUCTURE = {
    "items": {
        "description": "Everything found in the photo, one entry per kind of thing (use count for several of the same)",
        "required": True,
        "selector": {"object": {}},
    }
}

INSTRUCTIONS = (
    "You are looking at a photo taken inside a home. List every piece of furniture, every built-in fixture, every ceiling "
    "light, every curtain, window and door, the air conditioner and the TV. For each entry give:\n"
    "kind: exactly one of " + ", ".join(KINDS) + ";\n"
    "count: how many identical ones you can see;\n"
    "name: a short plain name (for example 'grey sofa' or 'woven pendant');\n"
    "colour: hex value of its main colour; material: fabric, leather, wood, rattan, metal, glass, stone, ceramic or plastic;\n"
    "width, depth, height: its real size in metres (estimate from doors about 2.1 m high, worktops 0.9 m, beds 2 m long);\n"
    "x: where its middle is across the photo, from 0 (left edge) to 1 (right edge);\n"
    "distance: near, middle or far from the camera;\n"
    "surface: back (the wall the camera faces), left, right, floor or ceiling;\n"
    "for lights also layout (single, row or grid), length in metres for slot lights and strips, bars for slot lights, "
    "size in metres for panels; for a tv style: wall or stand.\n" + HINTS + "\nAnswer as a JSON list in the 'items' field."
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
            "count": _int(it.get("count"), 1, 30),
            "name": str(it.get("name") or "")[:40],
            "colour": str(it.get("colour") or it.get("color") or "#9a9a9a")[:9],
            "material": str(it.get("material") or "")[:16],
            "w": _num(it.get("width")), "d": _num(it.get("depth")), "h": _num(it.get("height")),
            "x": _frac(it.get("x"), it.get("position")),
            "depth": str(it.get("distance") or "middle")[:8],
            "wall": str(it.get("surface") or "floor")[:8],
            "style": str(it.get("style") or "")[:12],
            "layout": str(it.get("layout") or "")[:8],
            "length": _num(it.get("length")), "size": _num(it.get("size")), "sill": _num(it.get("sill")),
            "bars": _int(it.get("bars"), 0, 12) if it.get("bars") is not None else None,
        })
    return {"items": clean}


def _int(v: Any, lo: int, hi: int) -> int:
    try:
        return max(lo, min(hi, int(round(float(v)))))
    except (TypeError, ValueError):
        return lo


def _frac(v: Any, word: Any = None) -> float:
    try:
        f = float(v)
        return max(0.0, min(1.0, f / 100 if f > 1 else f))
    except (TypeError, ValueError):
        return {"left": 0.2, "right": 0.8}.get(str(word or "").lower(), 0.5)


def _num(v: Any) -> float | None:
    try:
        f = float(v)
        return f if 0.05 < f < 8 else None
    except (TypeError, ValueError):
        return None


_ = (vol, selector)
