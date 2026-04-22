# Python Flask Fixture

A minimal Flask service demonstrating WSGI patterns.

## Structure

- `pyproject.toml` — declares `flask` dependency
- `app.py` — Flask app factory with REST endpoints
- `templates/index.html` — Jinja2 template
- `static/style.css` — static asset

## Notes

- `templates/` and `static/` are Flask application assets, not noise
- `app.py` contains `Flask()` instantiation and `@app.route` decorators
