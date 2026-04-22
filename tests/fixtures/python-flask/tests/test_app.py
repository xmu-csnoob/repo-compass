"""Tests for python-flask fixture."""
import sys
from pathlib import Path

# Import from parent directory (app.py at repo root)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app as flask_app

import pytest


@pytest.fixture
def client():
    """Flask test client."""
    return flask_app.app.test_client()


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json["message"] == "Flask fixture service"


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json["status"] == "ok"


def test_list_items_empty(client):
    response = client.get("/items")
    assert response.status_code == 200
    assert response.json == []


def test_create_and_get_item(client):
    response = client.post("/items", json={"name": "pen", "price": 1.5})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "pen"
    assert data["price"] == 1.5
    assert "id" in data

    item_id = data["id"]
    response = client.get(f"/items/{item_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "pen"
