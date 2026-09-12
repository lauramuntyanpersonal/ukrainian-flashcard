# Ukrainian Flashcards

A lightweight mobile-friendly flashcard app for studying Ukrainian vocabulary and phrases. It accepts CSV or JSON uploads, stores each study set locally, and lets you review cards with a sentence example and pronunciation.

## Features

- Upload a CSV or JSON word list
- Add a new study set whenever you want
- Study on mobile with a responsive design
- Show the phrase or sentence where a word is used
- Read the flashcard aloud with browser speech synthesis
- Keep track of each set in a simple JSON file

## Supported file formats

### CSV

Use headers like:

```csv
front,back,phrase,phrase_translation,note
привіт,hello,Привіт! Як справи?,Hi! How are you?,common greeting
```

### JSON

```json
[
  {
    "front": "привіт",
    "back": "hello",
    "phrase": "Привіт! Як справи?",
    "phrase_translation": "Hi! How are you?",
    "note": "common greeting"
  }
]
```

## Run locally

```bash
cd ukrainian-flashcards
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Then open:

- http://localhost:5001/

## Notes

This project stores sets in `data/sets.json`, so you can add new sets without a database.
# ukrainian-flashcard
