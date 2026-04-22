"""Test configuration for python-library fixture."""
import sys
from pathlib import Path

# Add src/ to path so tests can import python_lib_repo directly
fixture_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(fixture_root / "src"))
