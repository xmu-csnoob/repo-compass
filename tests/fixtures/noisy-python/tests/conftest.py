"""Test configuration for noisy-python fixture."""
import sys
from pathlib import Path

# Add src/ to path so tests can import noisy_repo directly
fixture_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(fixture_root / "src"))
