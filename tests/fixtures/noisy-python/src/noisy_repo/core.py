"""Core module for noisy repo."""
import json
from .generated.output import transform


def run_pipeline(data):
    """Run the main data pipeline."""
    transformed = transform(data)
    return {"result": transformed}


def save_output(data, path):
    """Save output to a JSON file."""
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
