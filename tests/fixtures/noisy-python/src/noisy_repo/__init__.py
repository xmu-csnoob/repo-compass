"""Noisy Python repo — real source package."""
import requests


def fetch_data(url):
    """Fetch data from a URL using requests."""
    response = requests.get(url, timeout=5)
    response.raise_for_status()
    return response.json()


def process(data):
    """Process raw data into structured form."""
    if not isinstance(data, list):
        return {"error": "expected list"}
    return {"count": len(data), "items": data[:10]}
