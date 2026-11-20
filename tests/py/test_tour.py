"""The light copy of a home that dashboard cards ask for. Run with:  python -m pytest tests/py"""
import importlib.util
import pathlib

spec = importlib.util.spec_from_file_location("tour", pathlib.Path(__file__).parents[2] / "custom_components" / "roost_atelier" / "tour.py")
tour = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tour)


def test_only_what_the_card_needs():
    plan = {"id": "h1", "name": "Home", "updated": 5, "floors": [{"name": "Ground", "height": 3, "rooms": [{"id": "r1", "name": "Living", "type": "living", "pts": [[0, 0], [4, 0], [4, 4]]}],
            "openings": [{"type": "door", "x": 4, "y": 2, "width": 0.9}], "items": [{"id": "sofa"}], "walls": [1],
            "devices": [{"id": "d1", "entity": "light.a", "kind": "light", "x": 1, "y": 1, "rule": "x"}, {"id": "d2", "kind": "light", "x": 2, "y": 2}]}]}
    photos = [{"key": "h1_0_all", "updated": 10}, {"key": "h1_0_pano_r1", "updated": 11}, {"key": "h1_1_all", "updated": 3}, {"key": "h10_0_all", "updated": 1}]
    out = tour.tour_data(plan, photos)
    f = out["floors"][0]
    assert out["version"] == 1 and out["id"] == "h1" and f["height"] == 3
    assert f["pictures"] == {"all": 10, "pano_r1": 11}
    assert [d["id"] for d in f["devices"]] == ["d1"] and "rule" not in f["devices"][0]
    assert "items" not in f and "walls" not in f
    assert f["openings"][0] == {"type": "door", "x": 4.0, "y": 2.0, "sill": 0.0, "height": 2.0}
