# Phase 2 Python Fixture Candidates

**Status:** Wave 0 preparation — collecting structural profiles only
**Constraint:** NO golden expectations — fixtures will be approved by Codex in Wave 3

---

## Fixture Type 1: Python CLI Fixture

**Purpose:** Test CLI repo detection, console_scripts entry point, and command extraction.

### Canonical Structural Profile

```
python-cli-repo/
├── pyproject.toml          # REQUIRED: has [project.scripts] or [project console-scripts]
├── src/
│   └── python_cli_repo/
│       ├── __init__.py
│       ├── __main__.py    # REQUIRED: enables `python -m python_cli_repo`
│       └── cli.py         # REQUIRED: contains argparse/click/typer definition
├── README.md
└── tests/
    └── test_cli.py
```

### Key Detection Signals

| Signal | Where Found | Phase 2 Use |
|--------|-------------|-------------|
| `pyproject.toml` | root | manifest detection |
| `[project.scripts]` | pyproject.toml | CLI entrypoint candidate |
| `__main__.py` | package root | secondary CLI bootstrap |
| `argparse` / `click` / `typer` | source files | bootstrap action inference |

### Structural Variants to Cover

- **Variant A:** `src/` layout with `__main__.py` (modern)
- **Variant B:** flat layout with `__main__.py` (simple)
- **Variant C:** `setup.py` instead of `pyproject.toml` (legacy)

### Noise Profile

Minimal noise expected. Only `__pycache__` may appear.

---

## Fixture Type 2: Python Library Fixture

**Purpose:** Test library repo detection, module structure, and `__init__.py` handling.

### Canonical Structural Profile

```
python-library-repo/
├── pyproject.toml          # REQUIRED: no [project.scripts], library-only
├── src/
│   └── python_library_repo/
│       ├── __init__.py    # REQUIRED: public API surface
│       ├── core.py        # REQUIRED: core module with real logic
│       └── utils.py
├── README.md
├── tests/
│   └── test_core.py
└── LICENSE
```

### Key Detection Signals

| Signal | Where Found | Phase 2 Use |
|--------|-------------|-------------|
| `pyproject.toml` | root | manifest detection |
| No `[project.scripts]` | pyproject.toml | distinguishes library from CLI |
| `__init__.py` | package root | module presence signal |
| `src/` layout | filesystem | standard library layout |

### Structural Variants to Cover

- **Variant A:** `src/` layout (modern, PEP 517/518 canonical)
- **Variant B:** flat layout with `__init__.py` (older but common)
- **Variant C:** `packages/` layout (legacy setuptools)

### Anti-Noise Notes

- `__init__.py` is **signal**, not noise — but must not dominate ranking
- Exclude `tests/` from module-link analysis
- No `console_scripts` should exist

---

## Fixture Type 3: Python Web/Service Fixture (FastAPI)

**Purpose:** Test ASGI framework detection, API route structure, and service entrypoint.

### Canonical Structural Profile

```
python-fastapi-repo/
├── pyproject.toml          # REQUIRED: fastapi in dependencies
├── app/
│   ├── __init__.py
│   ├── main.py             # REQUIRED: FastAPI app instance + route definitions
│   ├── routers/
│   │   ├── __init__.py
│   │   └── items.py        # REQUIRED: sample route with @router.get
│   └── models/
│       └── item.py
├── tests/
│   └── test_api.py
└── README.md
```

### Key Detection Signals

| Signal | Where Found | Phase 2 Use |
|--------|-------------|-------------|
| `pyproject.toml` with `fastapi` | root | framework detection |
| `app/main.py` with `FastAPI()` | app/ | app bootstrap candidate |
| `@router.get` / `@app.get` | source | API route candidate |
| `uvicorn` | dependencies | ASGI runner signal |

### Structural Variants to Cover

- **Variant A:** `app/` module layout (recommended)
- **Variant B:** flat `main.py` at root (simple)
- **Variant C:** `api/` instead of `app/` naming (alternative convention)

---

## Fixture Type 4: Python Web/Service Fixture (Flask)

**Purpose:** Test WSGI framework detection and Flask-specific patterns.

### Canonical Structural Profile

```
python-flask-repo/
├── pyproject.toml          # REQUIRED: flask in dependencies
├── app.py                  # REQUIRED: Flask app instance OR
├── run.py                  # ALTERNATIVE: run.py with app factory
├── templates/              # Flask template folder
│   └── index.html
├── static/                 # Flask static folder
│   └── style.css
├── tests/
│   └── test_app.py
└── README.md
```

### Key Detection Signals

| Signal | Where Found | Phase 2 Use |
|--------|-------------|-------------|
| `pyproject.toml` with `flask` | root | framework detection |
| `Flask()` instantiation | app.py | app bootstrap candidate |
| `@app.route` | source | route candidate |
| `templates/` / `static/` | root | Flask convention signal |

### Anti-Noise Notes

- `templates/` and `static/` should be classified as `generated` or `unknown` role, not `source`
- Do NOT mistake `app.py` for a CLI entrypoint

---

## Fixture Type 5: Python Web/Service Fixture (Django)

**Purpose:** Test Django project structure detection.

### Canonical Structural Profile

```
python-django-repo/
├── pyproject.toml
├── manage.py               # REQUIRED: Django management script
├── django_project/         # Django project package (same name as repo typically)
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── apps/                   # Django apps
│   └── myapp/
│       ├── __init__.py
│       ├── views.py        # REQUIRED: Django views
│       ├── models.py
│       └── urls.py
├── tests/
│   └── test_views.py
└── README.md
```

### Key Detection Signals

| Signal | Where Found | Phase 2 Use |
|--------|-------------|-------------|
| `manage.py` | root | Django project signal (P0) |
| `settings.py` | project package | Django configuration |
| `@app.route` / `path()` | urls.py | URL routing candidate |
| `apps/` or `<appname>/` layout | root | Django app pattern |

### Anti-Noise Notes

- `migrations/` directories should be classified as `generated` noise
- Do NOT rank migration files as signal

---

## Fixture Type 6: Noisy Python Fixture

**Purpose:** Test noise suppression — verify low-signal artifacts don't pollute ranking.

### Canonical Structural Profile

```
noisy-python-repo/
├── pyproject.toml
├── src/
│   └── noisy_repo/
│       ├── __init__.py
│       ├── core.py
│       └── generated/       # NOISE: generated code (should be defer_for_now)
│           └── output.py
├── .venv/                  # NOISE: virtualenv (should be excluded)
│   ├── lib/
│   └── Scripts/
├── __pycache__/            # NOISE: bytecode cache (should be excluded)
├── build/                  # NOISE: build artifacts (should be excluded)
│   └── dist/
├── dist/                   # NOISE: dist artifacts (should be excluded)
├── migrations/             # NOISE: database migrations (should be defer_for_now)
│   ├── __init__.py
│   └── 001_initial.py
└── tests/
    └── test_core.py
```

### Noise Classification Map

| Path Pattern | Phase 1 Role | Noise Decision |
|-------------|--------------|----------------|
| `.venv/` | `generated` | **Exclude** from scan |
| `__pycache__/` | `generated` | **Exclude** from scan |
| `build/` | `build` | **Exclude** from scan |
| `dist/` | `build` | **Exclude** from scan |
| `migrations/` | `generated` | **Defer** — include in defer_for_now |
| `*.pyc` | `generated` | **Exclude** via extension |
| `src/*/generated/` | `generated` | **Defer** |

### Ranking Expectations (Noisy Fixture)

- `core.py` should appear in `critical_paths` despite heavy noise
- `migrations/` should NOT appear in `critical_paths`
- `__init__.py` should not dominate if `core.py` has real content
- `defer_for_now` should include all noise paths

---

## Fixture Type 7: Mixed Python + JS/TS Fixture

**Purpose:** Test cross-language ranking where Python is primary.

### Canonical Structural Profile

```
mixed-python-js-repo/
├── pyproject.toml          # REQUIRED: Python manifest (primary)
├── package.json            # REQUIRED: JS manifest (secondary)
├── src/                    # Python source
│   └── mixed_repo/
│       ├── __init__.py
│       ├── api.py         # FastAPI/Flask app
│       └── models.py
├── frontend/               # JS/TS frontend
│   ├── package.json
│   ├── src/
│   │   └── App.tsx
│   └── vite.config.ts
├── tests/
│   ├── python_tests/
│   └── frontend_tests/
└── README.md
```

### Key Detection Signals

| Signal | Where Found | Phase 2 Use |
|--------|-------------|-------------|
| `pyproject.toml` AND `package.json` | root | mixed repo detection |
| Python package in `src/` | filesystem | Python primary language |
| `frontend/` or `src/` with TS | filesystem | JS secondary language |
| FastAPI/Flask in pyproject.toml | root | Python framework signal |

### Ranking Expectations (Mixed Fixture)

- Python `api.py` or `main.py` should appear in `key_paths` as `entry` role
- Frontend `App.tsx` should appear in `key_paths` as `entry` role
- Cross-language `module-link` edges should NOT be invented
- `frontend/` should NOT dominate if Python is the primary runtime

---

## Fixture Candidate Summary Table

| # | Fixture Type | Primary Manifest | Key File(s) | Noise to Suppress |
|---|--------------|-------------------|-------------|-------------------|
| 1 | Python CLI | `pyproject.toml` | `__main__.py`, CLI source | minimal |
| 2 | Python Library | `pyproject.toml` | `__init__.py`, core modules | minimal |
| 3 | FastAPI Web | `pyproject.toml` | `app/main.py`, routes | minimal |
| 4 | Flask Web | `pyproject.toml` | `app.py` / `run.py` | templates/, static/ |
| 5 | Django Web | `pyproject.toml` + `manage.py` | `settings.py`, `views.py` | migrations/ |
| 6 | Noisy Python | `pyproject.toml` | real source + noise dirs | .venv, __pycache__, migrations, build |
| 7 | Mixed P+JS | `pyproject.toml` + `package.json` | Python app + TS frontend | frontend noise |

---

## Next Steps

These structural profiles are **not golden expectations**. They define:

1. **Minimum viable structure** for each fixture type
2. **Required detection signals** that Phase 2 scan/extract should find
3. **Noise patterns** that Phase 2 suppression should handle

**Wave 3 (Codex):** Will approve which actual GitHub repos or synthetic fixtures to use as golden fixtures.

**Wave 0 action:** This document is ready for Codex review. Minimax should NOT create fixture repos yet — waiting for 0.4 gate.
