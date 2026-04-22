"""Tests for noisy Python repo."""
from noisy_repo import fetch_data, process


def test_process():
    data = [1, 2, 3]
    result = process(data)
    assert result["count"] == 3
    assert len(result["items"]) == 3
