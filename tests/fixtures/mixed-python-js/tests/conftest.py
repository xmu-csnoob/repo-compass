"""Test configuration for mixed-python-js fixture."""
import sys
from pathlib import Path

# Add src/ to path so mixed_repo can be imported
fixture_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(fixture_root / "src"))

# Also add fixture root for frontend path checks
sys.path.insert(0, str(fixture_root))
