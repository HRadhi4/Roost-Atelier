"""Roost Atelier: build your home in 3D and watch it live on your dashboards."""
from __future__ import annotations

import json
import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from datetime import timedelta

from .const import DOMAIN, PANEL_URL, URL_BASE
from .storage import PlanStore
from .uploads import BakeView, FileView, PhotoView, UploadView, cleanup
from . import websocket as ws

_LOGGER = logging.getLogger(__name__)
FRONTEND = Path(__file__).parent / "frontend"


def _version() -> str:
    return json.loads((Path(__file__).parent / "manifest.json").read_text())["version"]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Load the homes, serve the Atelier and add it to the sidebar."""
    store = PlanStore(hass)
    await store.async_load()
    hass.data[DOMAIN] = {"store": store}
    version = await hass.async_add_executor_job(_version)

    if not hass.data.get(f"{DOMAIN}_static"):
        await hass.http.async_register_static_paths([StaticPathConfig(URL_BASE, str(FRONTEND), True)])
        hass.http.register_view(UploadView())
        hass.http.register_view(FileView())
        hass.http.register_view(BakeView())
        hass.http.register_view(PhotoView())
        ws.async_register(hass)
        hass.data[f"{DOMAIN}_static"] = True

    module = f"{URL_BASE}/roost-atelier.js?v={version}"
    # the card works on every dashboard without adding it as a resource by hand
    frontend.add_extra_js_url(hass, module)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL,
        webcomponent_name="roost-atelier-panel",
        module_url=module,
        sidebar_title="Atelier",
        sidebar_icon="mdi:floor-plan",
        require_admin=True,
        config={"version": version},
    )

    async def _tidy(_now=None) -> None:
        plan_ids = set(store.plans) | {p.get("id") for p in store.deleted}
        res = await hass.async_add_executor_job(cleanup, hass, store.used_files(), plan_ids)
        if res["files"]:
            _LOGGER.info("Roost Atelier tidied %s unused files (%.1f MB)", res["files"], res["bytes"] / 1e6)

    entry.async_on_unload(async_call_later(hass, 180, _tidy))
    entry.async_on_unload(async_track_time_interval(hass, _tidy, timedelta(hours=24)))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Take the Atelier out of the sidebar."""
    frontend.async_remove_panel(hass, PANEL_URL)
    version = await hass.async_add_executor_job(_version)
    frontend.remove_extra_js_url(hass, f"{URL_BASE}/roost-atelier.js?v={version}")
    hass.data.pop(DOMAIN, None)
    return True
