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
        return web.FileResponse(path, headers={"X-Content-Type-Options": "nosniff"})


BAKE_KEY = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
MAX_BAKE = 200 * 1024 * 1024


class BakeView(HomeAssistantView):
    """The baked light of a home: made once on a computer, shared with every screen (stored compressed)."""

    url = "/api/roost_atelier/bake/{key}"
    name = "api:roost_atelier:bake"

    def _path(self, hass, key: str) -> Path:
        return folder(hass) / "light" / f"{key}.rab.gz"

    async def get(self, request: web.Request, key: str) -> web.StreamResponse:
        hass = request.app[KEY_HASS]
        if not BAKE_KEY.match(key):
            return web.Response(status=400)
        path = self._path(hass, key)
        try:
            st = await hass.async_add_executor_job(path.stat)
        except OSError:
            return web.Response(status=404)
        # the light is several MB: a screen that already has this exact file is told to keep it
        tag = f'"{st.st_mtime_ns:x}-{st.st_size:x}"'
        head = {"Cache-Control": "private, no-cache", "ETag": tag}
        if request.headers.get("If-None-Match") == tag:
            return web.Response(status=304, headers=head)
        data = await hass.async_add_executor_job(path.read_bytes)
        return web.Response(body=data, content_type="application/octet-stream", headers={**head, "Content-Encoding": "gzip"})

    async def post(self, request: web.Request, key: str) -> web.Response:
        hass = request.app[KEY_HASS]
        if not request["hass_user"].is_admin:
            return web.Response(status=403)
        if not BAKE_KEY.match(key):
            return web.Response(status=400)
        body = await request.read()
        if not body or len(body) > MAX_BAKE or body[:4] != b"RAB1":
            return web.Response(status=400, text="Not a light file")
        path = self._path(hass, key)

        def write() -> int:
            import gzip
            path.parent.mkdir(parents=True, exist_ok=True)
            packed = gzip.compress(body, compresslevel=6)
            tmp = path.with_suffix(".tmp")
            tmp.write_bytes(packed)
            tmp.replace(path)
            return len(packed)

        size = await hass.async_add_executor_job(write)
        return web.json_response({"stored": size})


PHOTO_KEY = re.compile(r"^[A-Za-z0-9_-]{1,80}$")


class PhotoView(HomeAssistantView):
    """Room photos the integration makes by itself (realistic render cleaned by the local AI)."""

    url = "/api/roost_atelier/photo/{key}"
    name = "api:roost_atelier:photo"

    async def get(self, request: web.Request, key: str) -> web.StreamResponse:
        hass = request.app[KEY_HASS]
        if not PHOTO_KEY.match(key):
            return web.Response(status=400)
        path = folder(hass) / "photos" / f"{key}.jpg"
        if not await hass.async_add_executor_job(path.is_file):
            return web.Response(status=404)
        return web.FileResponse(path, headers={"Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff"})

    async def post(self, request: web.Request, key: str) -> web.Response:
        hass = request.app[KEY_HASS]
        if not request["hass_user"].is_admin:
            return web.Response(status=403)
        if not PHOTO_KEY.match(key):
            return web.Response(status=400)
        body = await request.read()
        if not body or len(body) > MAX_UPLOAD or body[:2] != b"\xff\xd8":
            return web.Response(status=400, text="Not a photo")
        path = folder(hass) / "photos" / f"{key}.jpg"

        def write() -> None:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            tmp.write_bytes(body)
            tmp.replace(path)

        await hass.async_add_executor_job(write)
        return web.json_response({"ok": True})


def list_photos(hass, prefix: str) -> list[dict]:
    base = folder(hass) / "photos"
    if not base.is_dir():
        return []
    out = []
    for p in sorted(base.glob(f"{prefix}*.jpg")):
        out.append({"key": p.stem, "updated": p.stat().st_mtime})
    return out


def cleanup(hass, used: set[str], plan_ids: set[str]) -> dict[str, int]:
    """Remove what no home needs any more: uploads nothing points at (older than a day), and the light
    and photos of homes that are gone. Returns how many files were removed and how much space came back."""
    import time

    base = folder(hass)
    if not base.is_dir():
        return {"files": 0, "bytes": 0}
    removed, freed, day_ago = 0, 0, time.time() - 86400

    def drop(p: Path) -> None:
        nonlocal removed, freed
        try:
            size = p.stat().st_size
            p.unlink()
            removed += 1
            freed += size
        except OSError:
            pass

    for p in base.iterdir():
        if p.is_file() and NAME.match(p.name) and p.name not in used and p.stat().st_mtime < day_ago:
            drop(p)
    for sub, suffix in (("light", ".rab.gz"), ("photos", ".jpg")):
        d = base / sub
        if not d.is_dir():
            continue
        for p in d.iterdir():
            if not p.is_file():
                continue
            if p.suffix == ".tmp":
                drop(p)
                continue
            owner = p.name[: -len(suffix)].split("_", 1)[0] if p.name.endswith(suffix) else ""
            if owner and owner != "local" and owner not in plan_ids:
                drop(p)
    return {"files": removed, "bytes": freed}
