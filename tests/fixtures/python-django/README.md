# Python Django Fixture

A minimal Django project with one app.

## Structure

- `manage.py` — Django management script (P0 Django signal)
- `django_project/` — project package with `settings.py`, `urls.py`, `wsgi.py`
- `apps/myapp/` — Django app with `views.py`, `urls.py`, `models.py`

## Notes

- `manage.py` at root is the primary Django detection signal
- `migrations/` directories (not present here) would be noise to suppress
- `apps/myapp/views.py` contains Django view functions with `@require_http_methods`
