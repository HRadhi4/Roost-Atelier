"""Real surface textures (scanned wood, stone, marble, grass, plaster) and real sky photos from Poly Haven, free for any use (CC0).

Each one is downloaded once, the first time a home uses it, and kept in the config folder; after that it is served
from Home Assistant and nothing is fetched from the internet again. Only the textures listed here can be asked for.
"""
from __future__ import annotations

import asyncio
import logging
import re

from aiohttp import ClientTimeout, web

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


# the real skies shown round the house ("Real sky" setting), one per time of day
SKIES = {"qwantani_noon_puresky", "qwantani_afternoon_puresky", "qwantani_sunset_puresky", "qwantani_night_puresky"}
SKY_SOURCE = "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/{id}_2k.hdr"


class SkyView(HomeAssistantView):
    url = "/api/roost_atelier/sky/{sky}"
    name = "api:roost_atelier:sky"

    async def get(self, request: web.Request, sky: str) -> web.StreamResponse:
        hass = request.app[KEY_HASS]
        if not NAME.match(sky) or sky not in SKIES:
            return web.Response(status=404)
        path = folder(hass) / "skies" / f"{sky}.hdr"
        async with _locks.setdefault(f"sky/{sky}", asyncio.Lock()):
            if not await hass.async_add_executor_job(path.exists):
                try:
                    resp = await async_get_clientsession(hass).get(SKY_SOURCE.format(id=sky), timeout=120)
                    if resp.status != 200:
                        return web.Response(status=502)
                    data = await resp.read()
                    if len(data) > 16 * 1024 * 1024 or not data.startswith(b"#?"):
                        return web.Response(status=502)

                    def write() -> None:
                        path.parent.mkdir(parents=True, exist_ok=True)
                        tmp = path.with_suffix(".part")
                        tmp.write_bytes(data)
                        tmp.replace(path)

                    await hass.async_add_executor_job(write)
                except Exception as err:  # noqa: BLE001 - no internet: the Atelier shows its own sky
                    _LOGGER.debug("Roost Atelier could not fetch the sky %s: %s", sky, err)
                    return web.Response(status=503)
        return web.FileResponse(path, headers={"Cache-Control": "private, max-age=31536000", "X-Content-Type-Options": "nosniff", "Content-Type": "application/octet-stream"})


# The photo-reading model (OWL-ViT, Apache-2.0) used by "Read a photo": fetched once by Home Assistant the first
# time any screen needs it, then kept here and served to every phone and computer in the home. Only these
# files of this one model can be asked for.
MODEL_ID = "Xenova/owlvit-base-patch32"
MODEL_FILES = {
    "config.json", "preprocessor_config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json",
    "vocab.json", "merges.txt", "generation_config.json", "onnx/model_quantized.onnx", "onnx/model_fp16.onnx",
}
MODEL_SOURCE = "https://huggingface.co/{model}/resolve/main/{file}"
MAX_MODEL_FILE = 700 * 1024 * 1024


_downloads: dict[str, asyncio.Future] = {}


async def _fetch_model_file(hass, file: str, target, tmp, missing) -> int:
    """Download one model file to the config folder. Returns 200, 404 (no such file) or 503."""
    try:
        timeout = ClientTimeout(total=3600, sock_connect=30, sock_read=120)
        resp = await async_get_clientsession(hass).get(MODEL_SOURCE.format(model=MODEL_ID, file=file), timeout=timeout)
        if resp.status == 404:
            # this model has no such file (an optional one): remember, don't ask again
            await hass.async_add_executor_job(lambda: (missing.parent.mkdir(parents=True, exist_ok=True), missing.touch()))
            return 404
        if resp.status != 200:
            return 503
        await hass.async_add_executor_job(lambda: target.parent.mkdir(parents=True, exist_ok=True))
        fh = await hass.async_add_executor_job(tmp.open, "wb")
        size = 0
        try:
            async for chunk in resp.content.iter_chunked(1 << 20):
                size += len(chunk)
                if size > MAX_MODEL_FILE:
                    raise ValueError("model file too big")
                await hass.async_add_executor_job(fh.write, chunk)
        finally:
            await hass.async_add_executor_job(fh.close)
        await hass.async_add_executor_job(tmp.replace, target)
        return 200
    except Exception as err:  # noqa: BLE001 - no internet: the screen asks the model's own site instead
        _LOGGER.debug("Roost Atelier could not fetch the model file %s: %s", file, err)
        await hass.async_add_executor_job(lambda: tmp.unlink(missing_ok=True))
        return 503


class ModelView(HomeAssistantView):
    url = "/api/roost_atelier/model/{path:.+}"
    name = "api:roost_atelier:model"

    async def get(self, request: web.Request, path: str) -> web.StreamResponse:
        hass = request.app[KEY_HASS]
        prefix = MODEL_ID + "/"
        if not path.startswith(prefix) or path[len(prefix):] not in MODEL_FILES:
            return web.Response(status=404)
        file = path[len(prefix):]
        target = folder(hass) / "model" / file
        missing = target.with_name(target.name + ".missing")
        tmp = target.with_name(target.name + ".part")
        if await hass.async_add_executor_job(missing.exists):
            return web.Response(status=404)
        if not await hass.async_add_executor_job(target.exists):
            # one download per file, carried on by Home Assistant even if this screen stops waiting
            task = _downloads.get(file)
            if task is None or task.done():
                task = _downloads[file] = hass.async_create_background_task(_fetch_model_file(hass, file, target, tmp, missing), f"roost_atelier model {file}")
            status = await asyncio.shield(task)
            if status != 200:
                return web.Response(status=status)
        kind = "application/json" if file.endswith(".json") else "application/octet-stream"
        return web.FileResponse(target, headers={"Cache-Control": "private, max-age=31536000", "X-Content-Type-Options": "nosniff", "Content-Type": kind})
