"""Items router with sample REST endpoints."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/items", tags=["items"])


class Item(BaseModel):
    name: str
    description: str | None = None
    price: float


_db: dict[int, Item] = {}


@router.get("/")
def list_items():
    return list(_db.values())


@router.post("/")
def create_item(item: Item):
    id = len(_db) + 1
    _db[id] = item
    return {"id": id, **item.model_dump()}


@router.get("/{item_id}")
def get_item(item_id: int):
    if item_id not in _db:
        raise HTTPException(status_code=404, detail="Item not found")
    return _db[item_id]
