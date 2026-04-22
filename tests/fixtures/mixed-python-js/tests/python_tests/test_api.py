"""Tests for mixed repo Python/FastAPI backend."""
import sys
from pathlib import Path

# Add src/ to path for mixed_repo imports
fixture_root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(fixture_root / "src"))

from fastapi.testclient import TestClient
from mixed_repo.api import app

client = TestClient(app)


def test_list_items():
    response = client.get("/api/items")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_create_item():
    response = client.post("/api/items", json={"name": "widget", "price": 19.99})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "widget"
    assert data["price"] == 19.99
