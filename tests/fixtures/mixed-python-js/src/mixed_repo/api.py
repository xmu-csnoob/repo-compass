"""FastAPI backend for mixed repo."""
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class Item(BaseModel):
    name: str
    price: float


_db: list[Item] = []


@app.get("/api/items")
def list_items():
    return _db


@app.post("/api/items")
def create_item(item: Item):
    _db.append(item)
    return item
