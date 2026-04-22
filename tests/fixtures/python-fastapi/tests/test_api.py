"""Tests for python-fastapi fixture."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "FastAPI fixture service"


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_items_endpoint_get():
    response = client.get("/items")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_items_endpoint_post():
    response = client.post("/items", json={"name": "widget", "price": 9.99})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "widget"
    assert data["price"] == 9.99
