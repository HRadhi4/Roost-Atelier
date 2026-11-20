"""Real surface textures (scanned wood, stone, marble, grass, plaster) from Poly Haven, free for any use (CC0).

Each one is downloaded once, the first time a home uses it, and kept in the config folder; after that it is served
from Home Assistant and nothing is fetched from the internet again. Only the textures listed here can be asked for.
"""
from __future__ import annotations

import asyncio
import logging
import re

from aiohttp import web

from homeassistant.components.http import HomeAssistantView, KEY_HASS
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .uploads import folder

_LOGGER = logging.getLogger(__name__)

# the textures the Atelier uses (the names Poly Haven gives them)
TEXTURES = {
    "laminate_floor_02", "wood_floor", "herringbone_parquet", "large_floor_tiles_02", "marble_01",
    "wood_planks", "leafy_grass", "white_plaster_02", "patterned_paving_02",
}
MAPS = {"diff": "diff", "nor": "nor_gl", "rough": "rough"}
NAME = re.compile(r"^[a-z0-9_]+$")
SOURCE = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{id}/{id}_{map}_1k.jpg"
_locks: dict[str, asyncio.Lock] = {}


def texture_path(hass, tex: str, kind: str):
    return folder(hass) / "textures" / f"{tex}_{kind}.jpg"


class TextureView(HomeAssistantView):
    url = "/api/roost_atelier/texture/{tex}/{kind}"
    name = "api:roost_atelier:texture"

    async def get(self, request: web.Request, tex: str, kind: str) -> web.StreamResponse:
        hass = request.app[KEY_HASS]
        if not NAME.match(tex) or tex not in TEXTURES or kind not in MAPS:
            return web.Response(status=404)
        path = texture_path(hass, tex, kind)
        async with _locks.setdefault(f"{tex}/{kind}", asyncio.Lock()):
            if not await hass.async_add_executor_job(path.exists):
                try:
                    resp = await async_get_clientsession(hass).get(SOURCE.format(id=tex, map=MAPS[kind]), timeout=60)
                    if resp.status != 200:
                        return web.Response(status=502)
                    data = await resp.read()
                    if len(data) > 8 * 1024 * 1024 or data[:3] != b"\xff\xd8\xff":
                        return web.Response(status=502)

                    def write() -> None:
                        path.parent.mkdir(parents=True, exist_ok=True)
                        tmp = path.with_suffix(".part")
                        tmp.write_bytes(data)
                        tmp.replace(path)

                    await hass.async_add_executor_job(write)
                except Exception as err:  # noqa: BLE001 - no internet: the Atelier keeps its drawn textures
                    _LOGGER.debug("Roost Atelier could not fetch the texture %s: %s", tex, err)
                    return web.Response(status=503)
        return web.FileResponse(path, headers={"Cache-Control": "private, max-age=31536000", "X-Content-Type-Options": "nosniff", "Content-Type": "image/jpeg"})
