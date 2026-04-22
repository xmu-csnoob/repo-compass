"""Tests for python-django fixture views."""
import sys
from pathlib import Path

# Add fixture root to path for django_project and apps imports
fixture_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(fixture_root))

import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_project.settings")

import django
django.setup()

from apps.myapp.views import item_list, item_create


def test_item_list_view():
    """Test item_list view returns a JSONResponse."""
    from django.test import RequestFactory
    from django.http import JsonResponse

    factory = RequestFactory()
    request = factory.get("/items")
    response = item_list(request)
    assert isinstance(response, JsonResponse)


def test_item_create_view():
    """Test item_create view returns 201 with created item."""
    from django.test import RequestFactory
    from django.http import JsonResponse
    import json

    factory = RequestFactory()
    request = factory.post(
        "/items",
        data=json.dumps({"name": "gizmo", "price": 12.99}),
        content_type="application/json"
    )
    response = item_create(request)
    assert response.status_code == 201
    data = json.loads(response.content)
    assert data["name"] == "gizmo"
