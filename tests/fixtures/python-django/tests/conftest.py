"""Test configuration for python-django fixture."""
import sys
from pathlib import Path

# Add parent directory so apps.myapp can be resolved
fixture_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(fixture_root))
