"""Test configuration for python-flask fixture."""
import sys
from pathlib import Path

# Add parent directory so app.py can be imported
fixture_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(fixture_root))
