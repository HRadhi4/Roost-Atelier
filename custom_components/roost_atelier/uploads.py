"""Pictures and drawings you upload (plans, room photos), kept in the config folder and shown only to signed-in people."""
from __future__ import annotations

import re
import uuid
from pathlib import Path

from aiohttp import web

from homeassistant.components.http import HomeAssistantView, KEY_HASS

from .const import MAX_UPLOAD, UPLOAD_DIR

ALLOWED = {".png", ".jpg", ".jpeg", ".webp", ".pdf", ".dxf", ".glb"}
NAME = re.compile(r"^[a-f0-9]{16}\.[a-z0-9]{2,4}$")


def folder(hass) -> Path:
    return Path(hass.config.path(UPLOAD_DIR))


class UploadView(HomeAssistantView):
    url = "/api/roost_atelier/upload"
    name = "api:roost_atelier:upload"

    async def post(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        if not request["hass_user"].is_admin:
            return web.Response(status=403)
        reader = await request.multipart()
        part = await reader.next()
        if part is None or not part.filename:
            return web.Response(status=400, text="No file")
        ext = Path(part.filename).suffix.lower()
        if ext not in ALLOWED:
            return web.Response(status=400, text="This kind of file is not supported")
        data = bytearray()
        while chunk := await part.read_chunk():
            data.extend(chunk)
            if len(data) > MAX_UPLOAD:
                return web.Response(status=413, text="The file is too large")
        name = f"{uuid.uuid4().hex[:16]}{ext}"

        def write() -> None:
            folder(hass).mkdir(parents=True, exist_ok=True)
            (folder(hass) / name).write_bytes(bytes(data))

        await hass.async_add_executor_job(write)
        return self.json({"file": name})


class FileView(HomeAssistantView):
    url = "/api/roost_atelier/file/{name}"
    name = "api:roost_atelier:file"

    async def get(self, request: web.Request, name: str) -> web.StreamResponse:
        hass = request.app[KEY_HASS]
        if not NAME.match(name):
            return web.Response(status=404)
        path = folder(hass) / name
        if not await hass.async_add_executor_job(path.is_file):
            return web.Response(status=404)
        return web.FileResponse(path)
