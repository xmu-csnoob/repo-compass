"""Tests for mixed repo frontend (TypeScript/React)."""
import sys
from pathlib import Path

fixture_root = Path(__file__).resolve().parents[2]

# Verify App.tsx exists at the expected nested path
app_tsx = fixture_root / "frontend" / "src" / "App.tsx"
assert app_tsx.exists(), f"App.tsx not found at {app_tsx}"


def test_app_tsx_exists():
    """Verify the React entry component exists at the nested path."""
    assert app_tsx.exists()


def test_app_tsx_has_content():
    """Verify App.tsx is not empty."""
    content = app_tsx.read_text()
    assert len(content) > 0
    assert "App" in content or "app" in content.lower()
