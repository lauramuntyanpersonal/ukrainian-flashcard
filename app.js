const STORAGE_KEY = 'ukrainian-flashcards-sets-v1';

const demoSets = [
  {
    id: 'demo-ukrainian',
    name: 'Daily Ukrainian',
    description: 'Starter phrases for everyday use.',
    cards: [
      {
        id: 'card-1',
        front: 'привіт',
        back: 'hello',
        phrase: 'Привіт! Як справи?',
        phrase_translation: 'Hi! How are you?',
        note: 'Common greeting',
      },
      {
        id: 'card-2',
        front: 'дякую',
        back: 'thank you',
        phrase: 'Дякую за допомогу.',
        phrase_translation: 'Thank you for your help.',
        note: 'Polite phrase',
      },
    ],
  },
];

const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const setNameInput = document.getElementById('set-name');
const setDescriptionInput = document.getElementById('set-description');
const uploadStatus = document.getElementById('upload-status');
const setList = document.getElementById('set-list');
const app = document.getElementById('app');
const studyPanel = document.getElementById('study-panel');
const studyTitle = document.getElementById('study-title');
const backButton = document.getElementById('back-button');
const resetButton = document.getElementById('reset-button');

const frontText = document.getElementById('front-text');
const backText = document.getElementById('back-text');
const phraseText = document.getElementById('phrase-text');
const phraseTranslation = document.getElementById('phrase-translation');
const noteText = document.getElementById('note-text');
const backSide = document.getElementById('back-side');

let currentSetId = null;
let currentIndex = 0;
let flipped = false;
let currentCards = [];

function toId(value) {
  return `${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-` + Date.now().toString(36);
}

function readSets() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoSets));
    return demoSets;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : demoSets;
  } catch (error) {
    return demoSets;
  }
}

function saveSets(sets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
}

function getFirstNonEmpty(obj, candidates) {
  for (const key of candidates) {
    const value = obj[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function makeCard(raw, idx) {
  const front = getFirstNonEmpty(raw, ['front', 'ukrainian', 'word', 'term', 'text', 'lemma']);
  const back = getFirstNonEmpty(raw, ['back', 'english', 'translation', 'meaning', 'value', 'translation_en']);
  if (!front || !back) return null;

  return {
    id: raw.id || `card-${idx}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    front,
    back,
    phrase: getFirstNonEmpty(raw, ['phrase', 'example_uk', 'sentence', 'example', 'context_uk', 'phrase_uk']),
    phrase_translation: getFirstNonEmpty(raw, ['phrase_translation', 'example_en', 'translation_phrase', 'context_en', 'sentence_translation']),
    note: getFirstNonEmpty(raw, ['note', 'notes', 'comment', 'category', 'part_of_speech']),
  };
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return [];

  const rows = [];
  let current = [];
  let inQuotes = false;
  let field = '';

  const pushField = () => {
    current.push(field);
    field = '';
  };

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        pushField();
      } else if (char === '\n' && inQuotes) {
        field += char;
      } else {
        field += char;
      }
    }
    pushField();
    rows.push(current);
    current = [];
  }

  const [header, ...values] = rows;
  const headers = header.map(h => h.trim().toLowerCase());
  return values
    .filter(row => row.some(value => String(value).trim()))
    .map(row => {
      const obj = {};
      headers.forEach((headerName, index) => {
        obj[headerName] = row[index] ? row[index].trim() : '';
      });
      return obj;
    });
}

function parseUploadedFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const lower = file.name.toLowerCase();

        if (lower.endsWith('.json')) {
          const parsed = JSON.parse(text);
          const items = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.cards) ? parsed.cards : (parsed && Array.isArray(parsed.words) ? parsed.words : []));
          resolve(items.map((item, index) => makeCard(item, index)).filter(Boolean));
          return;
        }

        if (lower.endsWith('.csv')) {
          const rows = parseCsv(text);
          const cards = rows.map((row, index) => makeCard(row, index)).filter(Boolean);
          resolve(cards);
          return;
        }

        reject(new Error('Only CSV and JSON files are supported.'));
      } catch (error) {
        reject(new Error('That file could not be read. Please check the format.'));
      }
    };

    reader.onerror = () => reject(new Error('The file could not be loaded.'));
    reader.readAsText(file);
  });
}

function renderSetList() {
  const sets = readSets();
  if (!sets.length) {
    setList.innerHTML = '<p class="empty-state">No sets yet. Upload your first CSV or JSON file.</p>';
    return;
  }

  setList.innerHTML = sets
    .map((set) => `
      <button type="button" class="set-item" data-set-id="${set.id}">
        <div>
          <strong>${set.name}</strong>
          <small>${(set.cards || []).length} cards</small>
        </div>
        <span>Study →</span>
      </button>
    `)
    .join('');

  setList.querySelectorAll('.set-item').forEach((button) => {
    button.addEventListener('click', () => openSet(button.dataset.setId));
  });
}

function showStatus(message, kind = '') {
  uploadStatus.textContent = message;
  uploadStatus.className = `status ${kind}`.trim();
}

async function handleUpload(event) {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!file) {
    showStatus('Please choose a CSV or JSON file.', 'error');
    return;
  }

  showStatus('Uploading...', '');

  try {
    const cards = await parseUploadedFile(file);
    if (!cards.length) {
      showStatus('No valid cards were found in that file.', 'error');
      return;
    }

    const sets = readSets();
    const name = setNameInput.value.trim() || file.name.replace(/\.[^.]+$/, '');
    const description = setDescriptionInput.value.trim() || 'Custom vocabulary set';

    const newSet = {
      id: toId(name),
      name,
      description,
      cards,
    };

    saveSets([newSet, ...sets]);
    renderSetList();
    showStatus(`Set uploaded: ${name}`, 'success');
    uploadForm.reset();
    openSet(newSet.id);
  } catch (error) {
    showStatus(error.message, 'error');
  }
}

function openSet(setId) {
  const sets = readSets();
  const set = sets.find((item) => item.id === setId);
  if (!set) return;

  currentSetId = setId;
  currentIndex = 0;
  flipped = false;
  currentCards = set.cards || [];
  app.classList.add('hidden');
  studyPanel.classList.remove('hidden');
  studyTitle.textContent = set.name;
  renderCurrentCard();
}

function showMainView() {
  studyPanel.classList.add('hidden');
  app.classList.remove('hidden');
  currentSetId = null;
  currentIndex = 0;
  flipped = false;
  currentCards = [];
}

function renderCurrentCard() {
  const card = currentCards[currentIndex];
  if (!card) return;

  frontText.textContent = card.front || 'No term';
  backText.textContent = card.back || 'No translation';
  phraseText.textContent = card.phrase ? `Example: ${card.phrase}` : 'No phrase saved';
  phraseTranslation.textContent = card.phrase_translation || '';
  noteText.textContent = card.note ? `Note: ${card.note}` : '';

  backSide.classList.add('hidden');
  flipped = false;
}

function flipCard() {
  const card = currentCards[currentIndex];
  if (!card) return;
  flipped = !flipped;
  backSide.classList.toggle('hidden', !flipped);
}

function goNext() {
  if (!currentCards.length) return;
  currentIndex = (currentIndex + 1) % currentCards.length;
  renderCurrentCard();
}

function speakText(text) {
  if (!text || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'uk-UA';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function handleSpeak() {
  const card = currentCards[currentIndex];
  if (!card) return;
  speakText(flipped ? card.back : card.front);
}

function handleKnown() {
  goNext();
}

function handleAgain() {
  flipCard();
}

uploadForm.addEventListener('submit', handleUpload);
backButton.addEventListener('click', showMainView);
resetButton.addEventListener('click', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demoSets));
  renderSetList();
  showStatus('Demo data restored.', 'success');
});

document.getElementById('flip-btn').addEventListener('click', flipCard);
document.getElementById('next-btn').addEventListener('click', goNext);
document.getElementById('speak-btn').addEventListener('click', handleSpeak);
document.getElementById('known-btn').addEventListener('click', handleKnown);
document.getElementById('again-btn').addEventListener('click', handleAgain);
flashcard.addEventListener('click', flipCard);

renderSetList();
showStatus('');
