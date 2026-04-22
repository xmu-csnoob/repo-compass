"""Views for myapp."""
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods


_db = {}


@require_http_methods(["GET"])
def item_list(request):
    return JsonResponse(list(_db.values()), safe=False)


@require_http_methods(["POST"])
def item_create(request):
    import json
    data = json.loads(request.body)
    id = len(_db) + 1
    item = {"id": id, **data}
    _db[id] = item
    return JsonResponse(item, status=201)
