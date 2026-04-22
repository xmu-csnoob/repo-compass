"""Utility functions."""
import math


def safe_divide(a, b):
    """Divide two numbers, returning None if denominator is zero."""
    if b == 0:
        return None
    return a / b


def round_and_square(x):
    """Round x to nearest int and square it."""
    return math.pow(round(x), 2)
