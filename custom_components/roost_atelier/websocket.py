"""What the Atelier and its card ask Home Assistant: list, open, save and delete homes, and recognise furniture."""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN
from .storage import Conflict
from .recognize import async_recognize


@callback
def async_register(hass: HomeAssistant) -> None:
    for cmd in (ws_list, ws_get, ws_save, ws_delete, ws_recognize, ws_subscribe, ws_photos, ws_versions, ws_version, ws_deleted, ws_undelete):
        websocket_api.async_register_command(hass, cmd)


def _store(hass: HomeAssistant):
    return hass.data[DOMAIN]["store"]


@websocket_api.websocket_command({vol.Required("type"): "roost_atelier/plans"})
@callback
def ws_list(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    connection.send_result(msg["id"], _store(hass).summary())


@websocket_api.websocket_command({vol.Required("type"): "roost_atelier/plan", vol.Required("plan_id"): str})
@callback
def ws_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    plan = _store(hass).get(msg["plan_id"])
    if plan is None:
        connection.send_error(msg["id"], "not_found", "This home was not found")
        return
    connection.send_result(msg["id"], plan)


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "roost_atelier/save", vol.Required("plan"): dict,
                                  vol.Optional("base"): vol.Any(int, None), vol.Optional("force", default=False): bool})
@callback
def ws_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    try:
        plan = _store(hass).save(msg["plan"], msg.get("base"), msg["force"])
    except Conflict as err:
        connection.send_error(msg["id"], "conflict", f"changed elsewhere:{err.args[0]}")
        return
    hass.bus.async_fire(f"{DOMAIN}_updated", {"plan_id": plan["id"], "updated": plan["updated"]})
    connection.send_result(msg["id"], {"id": plan["id"], "updated": plan["updated"]})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "roost_atelier/versions", vol.Required("plan_id"): str})
@callback
def ws_versions(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    connection.send_result(msg["id"], _store(hass).versions(msg["plan_id"]))


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "roost_atelier/version", vol.Required("plan_id"): str, vol.Required("updated"): int})
@callback
def ws_version(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    plan = _store(hass).version(msg["plan_id"], msg["updated"])
    if plan is None:
        connection.send_error(msg["id"], "not_found", "That version is no longer kept")
        return
    connection.send_result(msg["id"], plan)


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "roost_atelier/deleted"})
@callback
def ws_deleted(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    connection.send_result(msg["id"], _store(hass).deleted_list())


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "roost_atelier/undelete", vol.Required("plan_id"): str})
@callback
def ws_undelete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    plan = _store(hass).undelete(msg["plan_id"])
    if plan is None:
        connection.send_error(msg["id"], "not_found", "That home is no longer kept")
        return
    connection.send_result(msg["id"], {"id": plan["id"]})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "roost_atelier/delete", vol.Required("plan_id"): str})
@callback
def ws_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    connection.send_result(msg["id"], {"deleted": _store(hass).delete(msg["plan_id"])})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): "roost_atelier/recognize", vol.Required("file"): str, vol.Optional("entity_id"): str}
)
@websocket_api.async_response
async def ws_recognize(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    try:
        result = await async_recognize(hass, msg["file"], msg.get("entity_id"))
    except ValueError as err:
        connection.send_error(msg["id"], "not_ready", str(err))
        return
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({vol.Required("type"): "roost_atelier/subscribe"})
@callback
def ws_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Tell open cards when a home is saved, so they redraw without a refresh."""

    @callback
    def forward(event) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], {"plan_id": event.data.get("plan_id"), "updated": event.data.get("updated")}))

    connection.subscriptions[msg["id"]] = hass.bus.async_listen(f"{DOMAIN}_updated", forward)
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): "roost_atelier/photos", vol.Required("plan_id"): str})
@websocket_api.async_response
async def ws_photos(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Room photos made for a home."""
    from .uploads import list_photos

    prefix = "".join(c for c in msg["plan_id"] if c.isalnum() or c in "_-") + "_"
    connection.send_result(msg["id"], await hass.async_add_executor_job(list_photos, hass, prefix))
