"""Flask application factory."""
from flask import Flask, jsonify, request

app = Flask(__name__)

# In-memory store
_db = {}


@app.route("/")
def root():
    return jsonify({"message": "Flask fixture service"})


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/items", methods=["GET"])
def list_items():
    return jsonify(list(_db.values()))


@app.route("/items", methods=["POST"])
def create_item():
    data = request.get_json()
    id = len(_db) + 1
    item = {"id": id, **data}
    _db[id] = item
    return jsonify(item), 201


@app.route("/items/<int:item_id>", methods=["GET"])
def get_item(item_id):
    if item_id not in _db:
        return jsonify({"error": "Item not found"}), 404
    return jsonify(_db[item_id])
