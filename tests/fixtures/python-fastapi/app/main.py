"""FastAPI application main entry point."""
from fastapi import FastAPI
from app.routers import items

app = FastAPI()

app.include_router(items.router)


@app.get("/")
def root():
    return {"message": "FastAPI fixture service"}


@app.get("/health")
def health():
    return {"status": "ok"}
