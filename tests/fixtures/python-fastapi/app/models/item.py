"""Item model for FastAPI fixture."""
from pydantic import BaseModel


class Item(BaseModel):
    """Sample item model."""
    name: str
    description: str | None = None
    price: float
