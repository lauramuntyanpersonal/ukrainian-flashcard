# Ukrainian Flashcards

A mobile-friendly flashcard app for studying Ukrainian vocabulary and phrases.

## GitHub Pages static version

This project is built as a static web app so it can be hosted for free on GitHub Pages.

## How it works

- Upload a CSV or JSON file from your desktop.
- The app parses the file in the browser.
- The data is stored in the browser with `localStorage`.
- Updates are made by uploading a new file or by editing the stored data in the browser.

## Supported file formats

### CSV

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

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Open the repository in GitHub.
3. Go to Settings → Pages.
4. Set Source to the main branch and root folder.
5. Save.

Your site will be available at:

`https://<your-username>.github.io/<repo-name>/`

## Notes

This is a static version, so it does not have a Python backend or a server-side database. It is designed for a free GitHub Pages setup with desktop upload and local browser storage.
