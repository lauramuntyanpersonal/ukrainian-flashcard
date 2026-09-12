from __future__ import annotations

import csv
import io
import json
import os
import re
import uuid
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
DATA_FILE = DATA_DIR / "sets.json"

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024


def ensure_storage() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    UPLOAD_DIR.mkdir(exist_ok=True)
    if not DATA_FILE.exists():
        sample = {
            "sets": [
                {
                    "id": "daily-ukrainian",
                    "name": "Daily Ukrainian",
                    "description": "A starter set with everyday vocabulary and sentence context.",
                    "cards": [
                        {
                            "id": "card-1",
                            "front": "привіт",
                            "back": "hello",
                            "phrase": "Привіт! Як справи?",
                            "phrase_translation": "Hi! How are you?",
                            "note": "Common greeting",
                        },
                        {
                            "id": "card-2",
                            "front": "дякую",
                            "back": "thank you",
                            "phrase": "Дякую за допомогу.",
                            "phrase_translation": "Thank you for your help.",
                            "note": "Useful polite phrase",
                        },
                    ],
                }
            ]
        }
        DATA_FILE.write_text(json.dumps(sample, ensure_ascii=False, indent=2), encoding="utf-8")


def load_sets() -> list[dict[str, Any]]:
    ensure_storage()
    try:
        with DATA_FILE.open("r", encoding="utf-8") as f:
            payload = json.load(f)
        if isinstance(payload, dict):
            sets = payload.get("sets", [])
        else:
            sets = payload or []
        return isinstance(sets, list) and sets or []
    except (json.JSONDecodeError, OSError):
        return []


def save_sets(sets: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    DATA_FILE.write_text(json.dumps({"sets": sets}, ensure_ascii=False, indent=2), encoding="utf-8")


def first_nonempty(mapping: dict[str, Any], keys: list[str]) -> str:
    for key in keys:
        value = mapping.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    slug = slug.strip("-")
    return slug or f"set-{uuid.uuid4().hex[:8]}"


def build_card(raw: dict[str, Any], index: int) -> dict[str, Any] | None:
    front = first_nonempty(raw, ["front", "ukrainian", "word", "term", "text", "lemma"])
    back = first_nonempty(raw, ["back", "english", "translation", "meaning", "value", "translation_en"])
    if not front or not back:
        return None

    phrase = first_nonempty(raw, ["phrase", "example_uk", "sentence", "example", "context_uk", "phrase_uk"])
    phrase_translation = first_nonempty(raw, ["phrase_translation", "example_en", "translation_phrase", "context_en", "sentence_translation"])
    note = first_nonempty(raw, ["note", "notes", "comment", "category", "part_of_speech"])

    return {
        "id": str(raw.get("id") or f"card-{index}-{uuid.uuid4().hex[:8]}"),
        "front": front,
        "back": back,
        "phrase": phrase,
        "phrase_translation": phrase_translation,
        "note": note,
    }


def normalize_cards(items: Any) -> list[dict[str, Any]]:
    if not isinstance(items, list):
        return []
    cards: list[dict[str, Any]] = []
    for index, item in enumerate(items):
        if isinstance(item, dict):
            card = build_card(item, index)
            if card:
                cards.append(card)
    return cards


def import_json_cards(file_obj) -> list[dict[str, Any]]:
    payload = json.loads(file_obj.read().decode("utf-8"))
    if isinstance(payload, dict):
        for key in ["cards", "words", "flashcards", "items", "entries", "data"]:
            if isinstance(payload.get(key), list):
                return normalize_cards(payload[key])
        return normalize_cards([payload])
    if isinstance(payload, list):
        return normalize_cards(payload)
    raise ValueError("JSON file must be a list of words or contain a cards/words/items array.")


def import_csv_cards(file_obj) -> list[dict[str, Any]]:
    text = file_obj.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("CSV file is missing a header row.")

    cards: list[dict[str, Any]] = []
    for index, row in enumerate(reader):
        if not row:
            continue
        mapping = {str(k).strip().lower(): v for k, v in row.items() if k is not None}
        card = build_card({
            "front": first_nonempty(mapping, ["front", "ukrainian", "word", "term", "text", "lemma"]),
            "back": first_nonempty(mapping, ["back", "english", "translation", "meaning", "value", "translation_en"]),
            "phrase": first_nonempty(mapping, ["phrase", "example_uk", "sentence", "example", "context_uk", "phrase_uk"]),
            "phrase_translation": first_nonempty(mapping, ["phrase_translation", "example_en", "translation_phrase", "context_en", "sentence_translation"]),
            "note": first_nonempty(mapping, ["note", "notes", "comment", "category", "part_of_speech"]),
        }, index)
        if card:
            cards.append(card)
    return cards


def parse_uploaded_cards(file_obj, filename: str) -> list[dict[str, Any]]:
    lowered = filename.lower()
    if lowered.endswith(".json"):
        return import_json_cards(file_obj)
    if lowered.endswith(".csv"):
        return import_csv_cards(file_obj)
    raise ValueError("Only .json and .csv files are supported.")


@app.route("/")
def index():
    sets = load_sets()
    return render_template("index.html", sets=sets)


@app.route("/study/<set_id>")
def study_set(set_id: str):
    sets = load_sets()
    target = next((s for s in sets if s.get("id") == set_id), None)
    if not target:
        return render_template("index.html", sets=sets, error="Set not found."), 404
    return render_template("study.html", study_set=target)


@app.route("/upload-set", methods=["POST"])
def upload_set():
    try:
        uploaded = request.files.get("file")
        if not uploaded or not uploaded.filename:
            return jsonify({"error": "Please choose a CSV or JSON file."}), 400

        set_name = (request.form.get("set_name") or uploaded.filename.rsplit(".", 1)[0]).strip()
        if not set_name:
            set_name = "New Ukrainian Set"

        uploaded.seek(0)
        cards = parse_uploaded_cards(uploaded, uploaded.filename)
        if not cards:
            return jsonify({"error": "No usable cards were found in that file."}), 400

        sets = load_sets()
        new_set = {
            "id": slugify(f"{set_name}-{len(sets) + 1}"),
            "name": set_name,
            "description": request.form.get("description", "Custom vocabulary set").strip() or "Custom vocabulary set",
            "cards": cards,
        }
        sets.insert(0, new_set)
        save_sets(sets)
        return jsonify({"success": True, "set_id": new_set["id"], "name": new_set["name"]})
    except (ValueError, json.JSONDecodeError) as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/sets")
def api_sets():
    return jsonify({"sets": load_sets()})


@app.route("/api/sets/<set_id>")
def api_single_set(set_id: str):
    sets = load_sets()
    target = next((s for s in sets if s.get("id") == set_id), None)
    if not target:
        return jsonify({"error": "Set not found."}), 404
    return jsonify({"set": target})


if __name__ == "__main__":
    ensure_storage()
    app.run(host="0.0.0.0", port=5001, debug=True)
