"""Tests for python-library fixture core module."""
from python_lib_repo.core import add, multiply


def test_add():
    assert add(2, 3) == 5
    assert add(-1, 1) == 0


def test_multiply():
    assert multiply(2, 3) == 6
    assert multiply(0, 99) == 0


def test_add_and_multiply():
    assert multiply(add(2, 3), 4) == 20
