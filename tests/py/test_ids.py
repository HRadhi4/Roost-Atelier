"""Ids in a home can't carry anything but letters, digits, _ and -. Run with:  python -m pytest tests/py"""
import importlib.util
import pathlib

spec = importlib.util.spec_from_file_location("ids", pathlib.Path(__file__).parents[2] / "custom_components" / "roost_atelier" / "ids.py")
ids = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ids)


def test_crafted_ids_are_cleaned():
    bad = '"><img src=x onerror=alert(1)>'
    plan = {"id": bad, "name": bad, "floors": [{"rooms": [{"id": "../../config", "name": "Living"}], "devices": [{"id": "dv1", "entity": "light.a"}], "items": [{"id": ""}]}]}
    out = ids.clean_ids(plan)
    assert out["id"] == "imgsrcxonerroralert1"
    assert out["name"] == bad  # names are text, escaped where shown
    assert out["floors"][0]["rooms"][0]["id"] == "config"
    assert out["floors"][0]["devices"][0]["id"] == "dv1"
    assert len(out["floors"][0]["items"][0]["id"]) == 12
