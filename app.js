const STORAGE_KEY = 'ukrainian-flashcards-sets-v1';
const WORD_BANK_KEY = 'ukrainian-flashcards-word-bank-v1';
const USERNAME_KEY = 'ukrainian-flashcards-username-v1';

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
const uploadStatus = document.getElementById('upload-status');
const selectionPanel = document.getElementById('selection-panel');
const selectionList = document.getElementById('selection-list');
const createSelectedSetButton = document.getElementById('create-selected-set');
const selectAllRowsButton = document.getElementById('select-all-rows');
const setList = document.getElementById('set-list');
const wordsList = document.getElementById('words-list');
const addSetButton = document.getElementById('add-set-button');
const setBuilder = document.getElementById('set-builder');
const setBuilderList = document.getElementById('set-builder-list');
const newSetNameInput = document.getElementById('new-set-name-input');
const createSetFromWordBankButton = document.getElementById('create-set-from-word-bank');
const app = document.getElementById('app');
const studyPanel = document.getElementById('study-panel');
const flashcard = document.getElementById('flashcard');
const studyTitle = document.getElementById('study-title');
const backButton = document.getElementById('back-button');
const navBackButton = document.getElementById('nav-back-button');
const deleteCardButton = document.getElementById('delete-card-btn');
const beginStudyButton = document.getElementById('begin-study-btn');
const setReviewList = document.getElementById('set-review-list');
const studyActions = document.querySelector('.study-actions');
const studyFooter = document.querySelector('.study-footer');
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanels = document.querySelectorAll('.tab-panel');
const refreshWordsButton = document.getElementById('refresh-words-button');
const tabBar = document.querySelector('.tab-bar');
const usernameInput = document.getElementById('username-input');
const saveUsernameButton = document.getElementById('save-username-button');
const usernameStatus = document.getElementById('username-status');
const usernameModal = document.getElementById('username-modal');
const startUsernameInput = document.getElementById('start-username-input');
const startSaveUsernameButton = document.getElementById('start-save-username-button');

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
let pendingUploadRows = [];
let selectedWordIndexes = new Set();
let isDraggingWordSelection = false;
let draggingSelectionMode = true;

function toId(value) {
  return `${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-` + Date.now().toString(36);
}

function getCurrentUsername() {
  const stored = localStorage.getItem(USERNAME_KEY);
  const username = String(stored || '').trim();
  const safeUsername = username || 'default';
  if (!username) {
    localStorage.setItem(USERNAME_KEY, safeUsername);
  }
  return safeUsername;
}

function setCurrentUsername(username) {
  const safeUsername = String(username || '').trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
  const finalUsername = safeUsername || 'default';
  localStorage.setItem(USERNAME_KEY, finalUsername);
  return finalUsername;
}

function hasUsername() {
  return Boolean(getCurrentUsername()) && getCurrentUsername() !== 'default';
}

function ensureUsernamePrompt() {
  const username = getCurrentUsername();
  const shouldShowPrompt = username === 'default';

  if (usernameModal) {
    usernameModal.classList.toggle('hidden', !shouldShowPrompt);
  }

  if (startUsernameInput && shouldShowPrompt) {
    startUsernameInput.value = '';
    startUsernameInput.focus();
  }

  if (usernameInput && !shouldShowPrompt) {
    usernameInput.value = username;
  }

  return !shouldShowPrompt;
}

function getScopedKey(baseKey) {
  return `${baseKey}:${getCurrentUsername()}`;
}

function getCloudConfig() {
  const cfg = window.FLASHCARDS_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    return null;
  }
  return cfg;
}

async function syncUserDataFromCloud() {
  const cfg = getCloudConfig();
  const username = getCurrentUsername();
  if (!cfg || username === 'default') return null;

  try {
    const response = await fetch(`${cfg.supabaseUrl}/rest/v1/flashcards_users?username=eq.${encodeURIComponent(username)}&select=data`, {
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${cfg.supabaseAnonKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;
    const rows = await response.json();
    if (!rows || !rows.length) return null;

    const data = rows[0]?.data || { words: [], sets: [] };
    localStorage.setItem(getScopedKey(WORD_BANK_KEY), JSON.stringify(Array.isArray(data.words) ? data.words : []));
    localStorage.setItem(getScopedKey(STORAGE_KEY), JSON.stringify(Array.isArray(data.sets) ? data.sets : []));
    return data;
  } catch (error) {
    return null;
  }
}

async function syncUserDataToCloud() {
  const cfg = getCloudConfig();
  const username = getCurrentUsername();
  if (!cfg || username === 'default') return null;

  try {
    let remoteData = { words: [], sets: [] };
    const remoteResponse = await fetch(`${cfg.supabaseUrl}/rest/v1/flashcards_users?username=eq.${encodeURIComponent(username)}&select=data`, {
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${cfg.supabaseAnonKey}`,
        Accept: 'application/json',
      },
    });

    if (remoteResponse.ok) {
      const remoteRows = await remoteResponse.json();
      const remoteEntry = Array.isArray(remoteRows) && remoteRows.length ? remoteRows[0] : null;
      if (remoteEntry && remoteEntry.data) {
        remoteData = remoteEntry.data;
      }
    }

    const localWords = readWordBank();
    const localSets = readSets();
    const mergedData = {
      words: mergeUniqueWordEntries(remoteData.words || [], localWords),
      sets: mergeUniqueSets(remoteData.sets || [], localSets),
    };

    const payload = { username, data: mergedData };
    const response = await fetch(`${cfg.supabaseUrl}/rest/v1/flashcards_users?on_conflict=username`, {
      method: 'POST',
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${cfg.supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return null;
    }

    return mergedData;
  } catch (error) {
    return null;
  }
}

function readSets() {
  const key = getScopedKey(STORAGE_KEY);
  const raw = localStorage.getItem(key);
  if (!raw) {
    const fallback = localStorage.getItem(STORAGE_KEY) || JSON.stringify(demoSets);
    localStorage.setItem(key, fallback);
    return JSON.parse(fallback);
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : demoSets;
  } catch (error) {
    return demoSets;
  }
}

function saveSets(sets) {
  localStorage.setItem(getScopedKey(STORAGE_KEY), JSON.stringify(sets));
  if (getCloudConfig()) {
    syncUserDataToCloud();
  }
}

function readWordBank() {
  const key = getScopedKey(WORD_BANK_KEY);
  const raw = localStorage.getItem(key);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveWordBank(words) {
  localStorage.setItem(getScopedKey(WORD_BANK_KEY), JSON.stringify(words));
  if (getCloudConfig()) {
    syncUserDataToCloud();
  }
}

function mergeUniqueWordEntries(existingItems, incomingItems) {
  const combined = [...(Array.isArray(existingItems) ? existingItems : []), ...(Array.isArray(incomingItems) ? incomingItems : [])];
  const seen = new Set();

  return combined.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const signature = [
      item.front || '',
      item.back || '',
      item.phrase || '',
      item.note || '',
    ].join('|');

    if (!signature.trim()) return false;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function mergeUniqueSets(existingSets, incomingSets) {
  const map = new Map();
  const combined = [...(Array.isArray(existingSets) ? existingSets : []), ...(Array.isArray(incomingSets) ? incomingSets : [])];

  combined.forEach((set) => {
    if (!set || typeof set !== 'object') return;
    const id = set.id || set.name || `${Date.now()}-${Math.random()}`;
    const existing = map.get(id);

    if (!existing) {
      map.set(id, {
        ...set,
        cards: Array.isArray(set.cards) ? [...set.cards] : [],
      });
      return;
    }

    const mergedCards = mergeUniqueWordEntries(existing.cards || [], set.cards || []);
    map.set(id, {
      ...existing,
      ...set,
      cards: mergedCards,
    });
  });

  return [...map.values()];
}

function mergeWordBank(items) {
  const merged = mergeUniqueWordEntries(readWordBank(), items);
  saveWordBank(merged);
  return merged;
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getFirstNonEmpty(obj, candidates) {
  const normalized = Object.fromEntries(
    Object.entries(obj || {}).map(([key, value]) => [normalizeKey(key), value])
  );

  for (const key of candidates) {
    const normalizedKey = normalizeKey(key);
    const value = normalized[normalizedKey] ?? obj?.[key] ?? obj?.[key.toUpperCase()] ?? obj?.[key.toLowerCase()];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return '';
}

function makeCard(raw, idx) {
  const front = getFirstNonEmpty(raw, ['lemme', 'lemma', 'word', 'term', 'text', 'ukrainian', 'front', 'f', 'column_f']);
  const back = getFirstNonEmpty(raw, ['definition', 'word_definition', 'meaning', 'def', 'translation', 'english', 'back', 'i', 'column_i']);
  const phrase = getFirstNonEmpty(raw, ['subtitle', 'phrase', 'example', 'sentence', 'context', 'c', 'column_c']);
  const phraseTranslation = getFirstNonEmpty(raw, ['phrase_translation', 'example_en', 'translation_phrase', 'context_en', 'sentence_translation']);
  const note = getFirstNonEmpty(raw, ['note', 'notes', 'comment', 'category', 'part_of_speech']);

  if (!front || (!back && !phrase && !note)) return null;

  return {
    id: raw.id || `card-${idx}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    front,
    back: back || phrase || note,
    phrase: phrase || note || '',
    phrase_translation: phraseTranslation || '',
    note: note || '',
  };
}

function countUnquotedDelimiters(line, delimiter) {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      count += 1;
    }
  }

  return count;
}

function parseCsv(text) {
  const cleanedText = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!cleanedText) return [];

  const candidates = [',', ';', '\t', '|'];
  const firstLine = cleanedText.split(/\r?\n/).find((line) => line.trim()) || '';
  const delimiter = candidates
    .map((candidate) => ({ candidate, count: countUnquotedDelimiters(firstLine, candidate) }))
    .sort((a, b) => b.count - a.count)[0]?.candidate || ',';

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanedText.length; i++) {
    const char = cleanedText[i];

    if (char === '"') {
      if (inQuotes && cleanedText[i + 1] === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && cleanedText[i + 1] === '\n') {
        i += 1;
      }
      currentRow.push(currentField);
      if (currentRow.some((value) => String(value).trim())) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length || currentRow.length) {
    currentRow.push(currentField);
    if (currentRow.some((value) => String(value).trim())) {
      rows.push(currentRow);
    }
  }

  if (!rows.length) return [];

  const [header, ...values] = rows;
  if (!header || !header.length) return [];

  const normalizedHeaders = header.map((h) => normalizeKey(String(h).trim()));

  return values
    .filter((row) => row.some((value) => String(value).trim()))
    .map((row) => {
      const obj = {};
      normalizedHeaders.forEach((headerName, index) => {
        obj[headerName] = String(row[index] ?? '').trim();
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

function updateUsernameStatus() {
  const username = getCurrentUsername();
  if (usernameInput) {
    usernameInput.value = username === 'default' ? '' : username;
  }
  if (usernameStatus) {
    usernameStatus.textContent = hasUsername() ? `Current user: ${username}` : 'Current user: not set';
  }
}

function renderWordList() {
  const words = readWordBank();
  if (!words.length) {
    wordsList.innerHTML = '<p class="empty-state">No words yet. Upload a CSV or JSON to build your word bank.</p>';
    return;
  }

  wordsList.innerHTML = words
    .map((word, index) => `
      <div class="word-row" data-word-index="${index}">
        <div class="word-main">
          <strong>${word.front || 'Untitled word'}</strong>
          <span>${word.back || word.phrase || word.note || 'No definition yet'}</span>
        </div>
        ${word.phrase ? `<small class="word-phrase">${word.phrase}</small>` : ''}
      </div>
    `)
    .join('');
}

function deleteSetById(setId) {
  const nextSets = readSets().filter((set) => set.id !== setId);
  saveSets(nextSets);
  renderSetList();
  showStatus('Set deleted.', 'success');
}

function renderSetList() {
  const sets = readSets();
  if (!sets.length) {
    setList.innerHTML = '<p class="empty-state">No sets yet. Create one from your word bank.</p>';
    return;
  }

  setList.innerHTML = sets
    .map((set) => `
      <div class="set-item" data-set-id="${set.id}">
        <div class="set-delete-swipe" data-set-id="${set.id}">Delete</div>
        <button type="button" class="set-item-main" data-set-id="${set.id}">
          <div class="set-item-copy">
            <strong>${set.name}</strong>
            <small>${(set.cards || []).length} cards</small>
          </div>
        </button>
      </div>
    `)
    .join('');

  setList.querySelectorAll('.set-item-main').forEach((button) => {
    button.addEventListener('click', () => openSet(button.dataset.setId));
  });

  setList.querySelectorAll('.set-delete-swipe').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      deleteSetById(button.dataset.setId);
    });
  });

  setList.querySelectorAll('.set-item').forEach((row) => {
    let startX = 0;
    let startOffset = 0;
    let dragging = false;

    row.addEventListener('pointerdown', (event) => {
      startX = event.clientX;
      startOffset = 0;
      dragging = true;
      row.setPointerCapture(event.pointerId);
    });

    row.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const deltaX = event.clientX - startX;
      if (deltaX < 0) {
        const offset = Math.max(deltaX, -90);
        row.style.transform = `translateX(${offset}px)`;
        startOffset = offset;
      }
    });

    function resetRow() {
      dragging = false;
      row.style.transform = '';
      startOffset = 0;
    }

    row.addEventListener('pointerup', (event) => {
      if (startOffset <= -70) {
        event.stopPropagation();
        deleteSetById(row.dataset.setId);
      } else {
        resetRow();
      }
    });

    row.addEventListener('pointerleave', () => {
      if (!dragging) return;
      if (startOffset <= -70) {
        deleteSetById(row.dataset.setId);
      } else {
        resetRow();
      }
    });

    row.addEventListener('pointercancel', resetRow);
  });
}

function renderSetBuilderList() {
  const words = readWordBank();
  if (!setBuilderList) return;

  if (!words.length) {
    setBuilderList.innerHTML = '<p class="empty-state">No words yet. Upload a CSV or JSON file first.</p>';
    return;
  }

  setBuilderList.innerHTML = words
    .map((word, index) => `
      <button type="button" class="word-select-row ${selectedWordIndexes.has(index) ? 'selected' : ''}" data-word-index="${index}">
        <div>
          <strong>${word.front || 'Untitled word'}</strong>
          <small>${word.back || word.phrase || word.note || 'No definition yet'}</small>
        </div>
      </button>
    `)
    .join('');
}

function applyWordSelection(index, shouldSelect) {
  if (shouldSelect) {
    selectedWordIndexes.add(index);
  } else {
    selectedWordIndexes.delete(index);
  }

  if (setBuilderList) {
    const row = setBuilderList.querySelector(`[data-word-index="${index}"]`);
    if (row) {
      row.classList.toggle('selected', shouldSelect);
    }
  }
}

function createSetFromWordBank() {
  const words = readWordBank();
  const selected = [...selectedWordIndexes].map((index) => words[index]).filter(Boolean);

  if (!selected.length) {
    showStatus('Select at least one word before creating a set.', 'error');
    return;
  }

  const name = (newSetNameInput ? newSetNameInput.value.trim() : '').replace(/\s+/g, ' ');
  const finalName = name || `Custom set ${readSets().length + 1}`;

  const newSet = {
    id: toId(finalName),
    name: finalName,
    description: `${selected.length} cards`,
    cards: selected,
  };

  const nextSets = [newSet, ...readSets()];
  saveSets(nextSets);
  if (newSetNameInput) newSetNameInput.value = '';
  selectedWordIndexes.clear();
  if (setBuilder) setBuilder.classList.add('hidden');
  renderSetBuilderList();
  renderSetList();
  showStatus(`Created set: ${finalName}`, 'success');
}

function toggleSetBuilder() {
  if (!setBuilder) return;
  const isHidden = setBuilder.classList.toggle('hidden');
  if (!isHidden && newSetNameInput) {
    newSetNameInput.focus();
  }
  if (!setBuilder.classList.contains('hidden')) {
    renderSetBuilderList();
  }
}

function showStatus(message, kind = '') {
  uploadStatus.textContent = message;
  uploadStatus.className = `status ${kind}`.trim();
}

function renderPendingUploadRows() {
  if (!pendingUploadRows.length) {
    selectionPanel.classList.add('hidden');
    selectionList.innerHTML = '';
    return;
  }

  selectionPanel.classList.remove('hidden');
  selectionList.innerHTML = pendingUploadRows
    .map((card, index) => `
      <label class="selection-row">
        <input type="checkbox" data-row-index="${index}" checked />
        <span>
          <strong>${card.front}</strong>
          <small>${card.back || card.phrase || card.note || 'No details yet'}</small>
        </span>
      </label>
    `)
    .join('');
}

function createSetFromSelectedRows() {
  if (!pendingUploadRows.length) {
    showStatus('Upload a CSV or JSON file first.', 'error');
    return;
  }

  const checkedInputs = [...selectionList.querySelectorAll('input[type="checkbox"]:checked')];
  const selectedCards = checkedInputs
    .map((input) => pendingUploadRows[Number(input.dataset.rowIndex)])
    .filter(Boolean);

  if (!selectedCards.length) {
    showStatus('Select at least one row before creating a study set.', 'error');
    return;
  }

  const sets = readSets();
  const name = `Custom set ${sets.length + 1}`;
  const description = 'Custom vocabulary set';

  const newSet = {
    id: toId(name),
    name,
    description,
    cards: selectedCards,
  };

  saveSets([newSet, ...sets]);
  pendingUploadRows = [];
  renderPendingUploadRows();
  renderSetList();
  uploadForm.reset();
  showStatus(`Created set: ${name}`, 'success');
  openSet(newSet.id);
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

    pendingUploadRows = cards;
    mergeWordBank(cards);
    renderWordList();
    renderPendingUploadRows();
    showStatus(`Loaded ${cards.length} rows into your word bank. Pick the rows you want and create a flashcard set from them.`, 'success');
  } catch (error) {
    pendingUploadRows = [];
    renderPendingUploadRows();
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
  if (tabBar) {
    tabBar.classList.add('hidden');
  }
  if (navBackButton) {
    navBackButton.classList.remove('hidden');
  }
  studyTitle.textContent = set.name;
  showSetReviewMode();
}

function showMainView() {
  studyPanel.classList.add('hidden');
  app.classList.remove('hidden');
  if (setReviewList) setReviewList.classList.add('hidden');
  if (beginStudyButton) beginStudyButton.classList.add('hidden');
  if (flashcard) flashcard.classList.remove('hidden');
  if (studyActions) studyActions.classList.remove('hidden');
  if (studyFooter) studyFooter.classList.remove('hidden');
  currentSetId = null;
  currentIndex = 0;
  flipped = false;
  currentCards = [];
}

function renderSetReviewList() {
  if (!setReviewList || !currentCards.length) {
    if (setReviewList) setReviewList.innerHTML = '<p class="empty-state">No cards in this set yet.</p>';
    return;
  }

  setReviewList.innerHTML = currentCards
    .map((card, index) => `
      <div class="review-item">
        <strong>${index + 1}. ${card.front || 'Untitled word'}</strong>
        <small>${card.back || card.phrase || card.note || 'No definition yet'}</small>
        ${card.phrase ? `<small>Phrase: ${card.phrase}</small>` : ''}
      </div>
    `)
    .join('');
}

function showSetReviewMode() {
  if (setReviewList) {
    setReviewList.classList.remove('hidden');
    renderSetReviewList();
  }
  if (beginStudyButton) beginStudyButton.classList.remove('hidden');
  if (flashcard) flashcard.classList.add('hidden');
  if (studyActions) studyActions.classList.add('hidden');
  if (studyFooter) studyFooter.classList.add('hidden');
}

function beginStudySession() {
  if (setReviewList) setReviewList.classList.add('hidden');
  if (beginStudyButton) beginStudyButton.classList.add('hidden');
  if (flashcard) flashcard.classList.remove('hidden');
  if (studyActions) studyActions.classList.remove('hidden');
  if (studyFooter) studyFooter.classList.remove('hidden');
  renderCurrentCard();
}

function renderCurrentCard() {
  const card = currentCards[currentIndex];
  if (!card) {
    frontText.textContent = 'No cards left';
    backText.textContent = 'Delete or add a card to continue';
    phraseText.textContent = '';
    phraseTranslation.textContent = '';
    noteText.textContent = '';
    backSide.classList.add('hidden');
    flipped = false;
    return;
  }

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

function deleteCurrentCard() {
  if (!currentSetId || !currentCards.length) return;

  const currentCard = currentCards[currentIndex];
  if (!currentCard) return;

  const sets = readSets().map((set) => {
    if (set.id !== currentSetId) return set;
    return {
      ...set,
      cards: (set.cards || []).filter((card) => card.id !== currentCard.id),
    };
  });

  saveSets(sets);

  const updatedSet = sets.find((set) => set.id === currentSetId) || { cards: [] };
  currentCards = updatedSet.cards || [];

  if (!currentCards.length) {
    renderCurrentCard();
    renderSetList();
    showStatus('Card deleted.', 'success');
    return;
  }

  currentIndex = Math.min(currentIndex, currentCards.length - 1);
  renderCurrentCard();
  renderSetList();
  showStatus('Card deleted.', 'success');
}

uploadForm.addEventListener('submit', handleUpload);
createSelectedSetButton.addEventListener('click', createSetFromSelectedRows);
selectAllRowsButton.addEventListener('click', () => {
  const checkboxes = selectionList.querySelectorAll('input[type="checkbox"]');
  const allChecked = [...checkboxes].every((checkbox) => checkbox.checked);
  checkboxes.forEach((checkbox) => {
    checkbox.checked = !allChecked;
  });
});
backButton.addEventListener('click', showMainView);

refreshWordsButton.addEventListener('click', () => {
  renderWordList();
  showStatus('Word list refreshed.', 'success');
});

if (deleteCardButton) {
  deleteCardButton.addEventListener('click', deleteCurrentCard);
}

if (beginStudyButton) {
  beginStudyButton.addEventListener('click', beginStudySession);
}

function setActiveTab(selectedTab) {
  tabButtons.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === selectedTab));
  tabPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === selectedTab);
  });
}

function showHomeScreen() {
  app.classList.remove('hidden');
  studyPanel.classList.add('hidden');
  if (tabBar) {
    tabBar.classList.remove('hidden');
  }
  if (navBackButton) {
    navBackButton.classList.add('hidden');
  }
  setActiveTab('words');
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (tabBar) {
      tabBar.classList.remove('hidden');
    }
    if (navBackButton) {
      navBackButton.classList.add('hidden');
    }
    setActiveTab(button.dataset.tab);
  });
});

if (navBackButton) {
  navBackButton.addEventListener('click', showHomeScreen);
}

async function saveCurrentUsername(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) {
    showStatus('Please enter a username before continuing.', 'error');
    return false;
  }

  const username = setCurrentUsername(value);
  updateUsernameStatus();
  if (usernameModal) {
    usernameModal.classList.add('hidden');
  }
  await syncUserDataFromCloud();
  renderWordList();
  renderSetList();
  showStatus(`Saved user: ${username}`, 'success');
  return true;
}

if (saveUsernameButton) {
  saveUsernameButton.addEventListener('click', async () => {
    await saveCurrentUsername(usernameInput ? usernameInput.value : '');
  });
}

if (startSaveUsernameButton) {
  startSaveUsernameButton.addEventListener('click', async () => {
    await saveCurrentUsername(startUsernameInput ? startUsernameInput.value : '');
  });
}

if (usernameInput) {
  usernameInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await saveCurrentUsername(usernameInput.value);
    }
  });
}

if (startUsernameInput) {
  startUsernameInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await saveCurrentUsername(startUsernameInput.value);
    }
  });
}

if (addSetButton) {
  addSetButton.addEventListener('click', toggleSetBuilder);
}

if (createSetFromWordBankButton) {
  createSetFromWordBankButton.addEventListener('click', createSetFromWordBank);
}

if (setBuilderList) {
  setBuilderList.addEventListener('pointerdown', (event) => {
    const row = event.target.closest('.word-select-row');
    if (!row) return;
    event.preventDefault();
    const index = Number(row.dataset.wordIndex);
    const isSelected = selectedWordIndexes.has(index);
    draggingSelectionMode = !isSelected;
    isDraggingWordSelection = true;
    applyWordSelection(index, draggingSelectionMode);
  });

  setBuilderList.addEventListener('pointerover', (event) => {
    if (!isDraggingWordSelection) return;
    const row = event.target.closest('.word-select-row');
    if (!row) return;
    const index = Number(row.dataset.wordIndex);
    applyWordSelection(index, draggingSelectionMode);
  });
}

document.addEventListener('pointerup', () => {
  isDraggingWordSelection = false;
});

updateUsernameStatus();
ensureUsernamePrompt();
if (getCloudConfig()) {
  syncUserDataFromCloud();
}
setActiveTab('words');

document.getElementById('flip-btn').addEventListener('click', flipCard);
document.getElementById('next-btn').addEventListener('click', goNext);
document.getElementById('speak-btn').addEventListener('click', handleSpeak);
flashcard.addEventListener('click', flipCard);

renderPendingUploadRows();
renderWordList();
renderSetList();
showStatus('');
