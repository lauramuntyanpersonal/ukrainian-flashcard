const STORAGE_KEY = 'ukrainian-flashcards-sets-v1';
const WORD_BANK_KEY = 'ukrainian-flashcards-word-bank-v1';
const USERNAME_KEY = 'ukrainian-flashcards-username-v1';
const CONTEXT_PROGRESS_KEY = 'ukrainian-flashcards-context-progress-v1';

const demoSets = [];

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
const setNameInput = document.getElementById('set-name-input');
const chunkSetCheckbox = document.getElementById('chunk-set-checkbox');
const chunkSizeRow = document.getElementById('chunk-size-row');
const setSizeInput = document.getElementById('set-size-input');
const createSetFromWordBankButton = document.getElementById('create-set-from-word-bank');
const closeSetBuilderButton = document.getElementById('close-set-builder');
const app = document.getElementById('app');
const studyPanel = document.getElementById('study-panel');
const flashcard = document.getElementById('flashcard');
const studyTitle = document.getElementById('study-title');
const studyHeaderCopy = document.querySelector('.study-header-copy');
const backButton = document.getElementById('back-button');
const navBackButton = document.getElementById('nav-back-button');
const deleteCardButton = document.getElementById('delete-card-btn');
const beginStudyButton = document.getElementById('begin-study-btn');
const contextGameStartButton = document.getElementById('context-game-start-btn');
const studySetHeaderButton = document.getElementById('study-set-header-button');
const studySettingsButton = document.getElementById('study-settings-button');
const studySettingsMenu = document.getElementById('study-settings-menu');
const shuffleCardsButton = document.getElementById('shuffle-cards-button');
const setReviewList = document.getElementById('set-review-list');
const contextGame = document.getElementById('context-game');
const contextGameMeaning = document.getElementById('context-game-meaning');
const contextGamePhrase = document.getElementById('context-game-phrase');
const contextGameAnswer = document.getElementById('context-game-answer');
const contextGameSubmit = document.getElementById('context-game-submit');
const contextGameFeedback = document.getElementById('context-game-feedback');
const contextGameNext = document.getElementById('context-game-next');
const contextGameEnd = document.getElementById('context-game-end');
const contextResults = document.getElementById('context-results');
const contextResultsScore = document.getElementById('context-results-score');
const contextResultsMistakes = document.getElementById('context-results-mistakes');
const contextResultsContinue = document.getElementById('context-results-continue');
const contextConfetti = document.getElementById('context-confetti');
const studyActions = document.querySelector('.study-actions');
const studyFooter = document.querySelector('.study-footer');
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanels = document.querySelectorAll('.tab-panel');
const refreshWordsButton = document.getElementById('refresh-words-button');
const wordCountLabel = document.getElementById('word-count');
const wordSortSelect = document.getElementById('word-sort-select');
const setSortSelect = document.getElementById('set-sort-select');
const toggleAddWordFormButton = document.getElementById('toggle-add-word-form');
const addWordForm = document.getElementById('add-word-form');
const addWordFrontInput = document.getElementById('add-word-front');
const addWordBackInput = document.getElementById('add-word-back');
const addWordPhraseInput = document.getElementById('add-word-phrase');
const tabBar = document.querySelector('.tab-bar');
const usernameInput = document.getElementById('username-input');
const saveUsernameButton = document.getElementById('save-username-button');
const usernameStatus = document.getElementById('username-status');
const usernameModal = document.getElementById('username-modal');
const startUsernameInput = document.getElementById('start-username-input');
const startSaveUsernameButton = document.getElementById('start-save-username-button');
const accountButton = document.getElementById('account-button');
const appUpdateButton = document.getElementById('update-button');

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
let activeAudio = null;
let contextInitialViewportHeight = null;
let contextProgress = null;
let contextQueue = [];

function readContextProgress() {
  try {
    const allProgress = JSON.parse(localStorage.getItem(getScopedKey(CONTEXT_PROGRESS_KEY)) || '{}');
    return allProgress && typeof allProgress === 'object' ? allProgress : {};
  } catch (error) {
    return {};
  }
}

function saveContextProgress() {
  localStorage.setItem(getScopedKey(CONTEXT_PROGRESS_KEY), JSON.stringify({
    ...readContextProgress(),
    [currentSetId]: contextProgress,
  }));
}

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

function removeLegacyDemoSetsFromStorage() {
  const seenKeys = Object.keys(localStorage);

  seenKeys.forEach((key) => {
    if (!key.startsWith('ukrainian-flashcards-sets-v1:')) return;

    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return;

      const cleaned = parsed.filter((set) => {
        if (!set || typeof set !== 'object') return true;
        const name = String(set.name || '').trim().toLowerCase();
        const id = String(set.id || '').trim().toLowerCase();
        return name !== 'daily ukrainian' && name !== 'daily-ukrainian' && id !== 'daily-ukrainian' && id !== 'demo-ukrainian';
      });

      if (cleaned.length !== parsed.length) {
        localStorage.setItem(key, JSON.stringify(cleaned));
      }
    } catch (error) {
      // Ignore malformed legacy storage entries.
    }
  });
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
    const hasLocalWordData = !!localStorage.getItem(getScopedKey(WORD_BANK_KEY));
    const hasLocalSetData = !!localStorage.getItem(getScopedKey(STORAGE_KEY));

    if (!hasLocalWordData || !hasLocalSetData) {
      localStorage.setItem(getScopedKey(WORD_BANK_KEY), JSON.stringify(Array.isArray(data.words) ? data.words : []));
      localStorage.setItem(getScopedKey(STORAGE_KEY), JSON.stringify(Array.isArray(data.sets) ? data.sets : []));
    }

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
    const localWords = readWordBank();
    const localSets = readSets();
    const payload = {
      username,
      data: {
        words: Array.isArray(localWords) ? localWords : [],
        sets: Array.isArray(localSets) ? localSets : [],
      },
    };

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

    return payload.data;
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
  const displayName = username === 'default' ? 'Account' : username;

  if (usernameInput) {
    usernameInput.value = username === 'default' ? '' : username;
  }

  if (accountButton) {
    accountButton.textContent = displayName;
    accountButton.title = hasUsername() ? `Account: ${username}` : 'Set account';
  }

  if (usernameStatus) {
    usernameStatus.textContent = hasUsername() ? `Current user: ${username}` : 'Current user: not set';
  }
}

function deleteWordByIndex(index) {
  const nextWords = readWordBank().filter((_, wordIndex) => wordIndex !== index);
  saveWordBank(nextWords);
  renderWordList();
  showStatus('Word deleted.', 'success');
}

function getWordSortPreference() {
  const stored = localStorage.getItem('ukrainian-flashcards-word-sort-v1');
  return stored === 'oldest' ? 'oldest' : 'newest';
}

function setWordSortPreference(sortOrder) {
  const safeOrder = sortOrder === 'oldest' ? 'oldest' : 'newest';
  localStorage.setItem('ukrainian-flashcards-word-sort-v1', safeOrder);
}

function getSetSortPreference() {
  const stored = localStorage.getItem('ukrainian-flashcards-set-sort-v1');
  return stored === 'oldest' ? 'oldest' : 'newest';
}

function setSetSortPreference(sortOrder) {
  const safeOrder = sortOrder === 'oldest' ? 'oldest' : 'newest';
  localStorage.setItem('ukrainian-flashcards-set-sort-v1', safeOrder);
}

function renderWordList() {
  const words = readWordBank();
  const sortOrder = getWordSortPreference();
  const orderedWords = sortOrder === 'oldest' ? [...words] : [...words].reverse();

  if (wordCountLabel) {
    const totalWordText = `${words.length} ${words.length === 1 ? 'word' : 'words'}`;
    wordCountLabel.textContent = totalWordText;
  }

  if (wordSortSelect) {
    wordSortSelect.value = sortOrder;
  }

  if (!orderedWords.length) {
    wordsList.innerHTML = '<p class="empty-state">No words yet. Upload a CSV or JSON to build your word bank.</p>';
    return;
  }

  const visibleWords = orderedWords.map((word) => ({
    ...word,
    displayIndex: words.indexOf(word),
    setNames: getWordMembershipInfo(word),
  }));

  wordsList.innerHTML = visibleWords
    .map(({ displayIndex, setNames, ...word }) => {
      const membershipLabel = setNames.length ? `In set: ${setNames.join(', ')}` : 'Not in any set';
      return `
        <div class="word-row" data-word-index="${displayIndex}">
          <button type="button" class="word-delete-action" data-word-index="${displayIndex}" aria-label="Delete word ${word.front || 'word'}">Delete</button>
          <div class="word-content" data-word-index="${displayIndex}">
            <div class="word-main">
              <strong>${word.front || 'Untitled word'}</strong>
              <span>${word.back || word.phrase || word.note || 'No definition yet'}</span>
            </div>
            ${word.phrase ? `<small class="word-phrase">${word.phrase}</small>` : ''}
            <small class="word-set-status">${membershipLabel}</small>
          </div>
        </div>
      `;
    })
    .join('');

  wordsList.querySelectorAll('.word-delete-action').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      deleteWordByIndex(Number(button.dataset.wordIndex));
    });
  });

  wordsList.querySelectorAll('.word-row').forEach((row) => {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    const maxOffset = 96;

    const applyOffset = (offset) => {
      const clamped = Math.max(-maxOffset, Math.min(0, offset));
      const content = row.querySelector('.word-content');
      if (content) {
        content.style.transform = `translateX(${clamped}px)`;
      }
    };

    const resetSwipe = () => {
      row.classList.remove('is-swiped');
      applyOffset(0);
      isDragging = false;
    };

    row.addEventListener('pointerdown', (event) => {
      startX = event.clientX;
      currentX = event.clientX;
      isDragging = true;
      row.setPointerCapture(event.pointerId);
    });

    row.addEventListener('pointermove', (event) => {
      if (!isDragging) return;
      const delta = event.clientX - startX;
      currentX = event.clientX;
      const isAlreadySwiped = row.classList.contains('is-swiped');

      if (delta < 0) {
        const offset = Math.max(delta, -maxOffset);
        applyOffset(isAlreadySwiped ? Math.min(offset, 0) : offset);
      } else if (isAlreadySwiped) {
        const offset = Math.min(delta, 0);
        applyOffset(offset);
      }
    });

    row.addEventListener('pointerup', () => {
      if (!isDragging) return;
      const delta = currentX - startX;
      if (delta <= -52) {
        row.classList.add('is-swiped');
        applyOffset(-maxOffset);
      } else if (delta >= 48 && row.classList.contains('is-swiped')) {
        resetSwipe();
      } else {
        if (row.classList.contains('is-swiped')) {
          applyOffset(-maxOffset);
        } else {
          resetSwipe();
        }
      }
      isDragging = false;
    });

    row.addEventListener('pointerleave', () => {
      if (!isDragging) return;
      const delta = currentX - startX;
      if (delta <= -52) {
        row.classList.add('is-swiped');
        applyOffset(-maxOffset);
      } else {
        resetSwipe();
      }
      isDragging = false;
    });

    row.addEventListener('pointercancel', resetSwipe);
  });
}

function deleteSetById(setId) {
  const nextSets = readSets().filter((set) => set.id !== setId);
  saveSets(nextSets);
  renderSetList();
  renderWordList();
  showStatus('Set deleted.', 'success');
}

function getWordKey(word) {
  if (!word || typeof word !== 'object') return '';
  return word.id || [word.front || '', word.back || '', word.phrase || '', word.note || ''].join('|');
}

function getUnassignedWords() {
  const words = readWordBank();
  const assignedKeys = new Set();

  readSets().forEach((set) => {
    (Array.isArray(set.cards) ? set.cards : []).forEach((card) => {
      const cardKey = getWordKey(card);
      if (cardKey) assignedKeys.add(cardKey);
    });
  });

  return words.filter((word) => {
    const key = getWordKey(word);
    return key && !assignedKeys.has(key);
  });
}

function getWordMembershipInfo(word) {
  const sets = readSets();
  const wordKey = getWordKey(word);

  const matchingSets = sets.filter((set) => {
    const cards = Array.isArray(set.cards) ? set.cards : [];
    return cards.some((card) => getWordKey(card) === wordKey);
  });

  return matchingSets.map((set) => set.name);
}

function renameSetById(setId, nextName) {
  const trimmedName = String(nextName || '').trim();
  if (!trimmedName) return false;

  const nextSets = readSets().map((set) => {
    if (set.id !== setId) return set;
    return { ...set, name: trimmedName };
  });

  saveSets(nextSets);
  renderSetList();
  renderWordList();
  return true;
}

function renderSetList() {
  const sets = readSets();
  const sortOrder = getSetSortPreference();
  const orderedSets = sortOrder === 'oldest' ? [...sets].reverse() : [...sets];

  if (setSortSelect) {
    setSortSelect.value = sortOrder;
  }

  if (!orderedSets.length) {
    setList.innerHTML = '<p class="empty-state">No sets yet. Create one from your word bank.</p>';
    return;
  }

  setList.innerHTML = orderedSets
    .map((set) => `
      <div class="set-item" data-set-id="${set.id}">
        <button type="button" class="set-delete-action" data-set-id="${set.id}" aria-label="Delete set ${set.name}">Delete</button>
        <div class="set-item-main" data-set-id="${set.id}">
          <button type="button" class="set-item-button" data-set-id="${set.id}">
            <div class="set-item-copy">
              <strong>${set.name}</strong>
              <small>${(set.cards || []).length} cards</small>
            </div>
          </button>
          <button type="button" class="set-rename-action" data-set-id="${set.id}">Rename</button>
        </div>
      </div>
    `)
    .join('');

  setList.querySelectorAll('.set-item-button').forEach((button) => {
    button.addEventListener('click', () => {
      const row = button.closest('.set-item');
      if (row && row.classList.contains('is-swiped')) {
        row.classList.remove('is-swiped');
        return;
      }
      openSet(button.dataset.setId);
    });
  });

  setList.querySelectorAll('.set-rename-action').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const setId = button.dataset.setId;
      const set = readSets().find((entry) => entry.id === setId);
      const nextName = window.prompt('Rename this set', set?.name || '');
      if (nextName === null) return;
      renameSetById(setId, nextName);
    });
  });

  setList.querySelectorAll('.set-delete-action').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      deleteSetById(button.dataset.setId);
    });
  });

  setList.querySelectorAll('.set-item').forEach((row) => {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    const maxOffset = 96;

    const applyOffset = (offset) => {
      const clamped = Math.max(-maxOffset, Math.min(0, offset));
      row.querySelector('.set-item-main').style.transform = `translateX(${clamped}px)`;
    };

    const resetSwipe = () => {
      row.classList.remove('is-swiped');
      applyOffset(0);
      isDragging = false;
    };

    row.addEventListener('pointerdown', (event) => {
      startX = event.clientX;
      currentX = event.clientX;
      isDragging = true;
      row.setPointerCapture(event.pointerId);
    });

    row.addEventListener('pointermove', (event) => {
      if (!isDragging) return;
      const delta = event.clientX - startX;
      currentX = event.clientX;
      const isAlreadySwiped = row.classList.contains('is-swiped');

      if (delta < 0) {
        const offset = Math.max(delta, -maxOffset);
        applyOffset(isAlreadySwiped ? Math.min(offset, 0) : offset);
      } else if (isAlreadySwiped) {
        const offset = Math.min(delta, 0);
        applyOffset(offset);
      }
    });

    row.addEventListener('pointerup', () => {
      if (!isDragging) return;

      const delta = currentX - startX;
      if (delta <= -52) {
        row.classList.add('is-swiped');
        applyOffset(-maxOffset);
      } else if (delta >= 48 && row.classList.contains('is-swiped')) {
        resetSwipe();
      } else {
        if (row.classList.contains('is-swiped')) {
          applyOffset(-maxOffset);
        } else {
          resetSwipe();
        }
      }
      isDragging = false;
    });

    row.addEventListener('pointerleave', () => {
      if (!isDragging) return;
      const delta = currentX - startX;
      if (delta <= -52) {
        row.classList.add('is-swiped');
        applyOffset(-maxOffset);
      } else {
        resetSwipe();
      }
      isDragging = false;
    });

    row.addEventListener('pointercancel', resetSwipe);
  });
}

function renderSetBuilderList() {
  const words = readWordBank();
  if (!setBuilderList) return;

  if (chunkSetCheckbox && chunkSetCheckbox.checked) {
    setBuilderList.innerHTML = '<p class="empty-state">Chunking uses the unassigned words automatically. No word selection needed.</p>';
    return;
  }

  if (!words.length) {
    setBuilderList.innerHTML = '<p class="empty-state">No words yet. Upload a CSV or JSON file first.</p>';
    return;
  }

  setBuilderList.innerHTML = words
    .map((word, index) => `
      <label class="word-select-row ${selectedWordIndexes.has(index) ? 'selected' : ''}" data-word-index="${index}">
        <input type="checkbox" data-word-index="${index}" ${selectedWordIndexes.has(index) ? 'checked' : ''} />
        <div>
          <strong>${word.front || 'Untitled word'}</strong>
          <small>${word.back || word.phrase || word.note || 'No definition yet'}</small>
        </div>
      </label>
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
    const row = setBuilderList.querySelector(`.word-select-row[data-word-index="${index}"]`);
    if (row) {
      row.classList.toggle('selected', shouldSelect);
    }
    const checkbox = setBuilderList.querySelector(`input[data-word-index="${index}"]`);
    if (checkbox) {
      checkbox.checked = shouldSelect;
    }
  }
}

function chunkWords(items, chunkSize) {
  const safeChunkSize = Number.isFinite(chunkSize) && chunkSize > 0 ? Math.floor(chunkSize) : 50;
  const chunks = [];

  for (let index = 0; index + safeChunkSize <= items.length; index += safeChunkSize) {
    chunks.push(items.slice(index, index + safeChunkSize));
  }

  return chunks;
}

function updateSetBuilderMode() {
  const isChunked = Boolean(chunkSetCheckbox && chunkSetCheckbox.checked);
  if (chunkSizeRow) {
    chunkSizeRow.classList.toggle('hidden', !isChunked);
  }
  if (setNameInput) {
    setNameInput.placeholder = isChunked ? 'Base name for chunked sets' : 'Name this set';
  }
  if (setBuilderList) {
    renderSetBuilderList();
  }
}

function createSetFromWordBank() {
  if (chunkSetCheckbox && chunkSetCheckbox.checked) {
    createChunkedSetsFromWordBank();
    return;
  }

  const words = readWordBank();
  const selected = [...selectedWordIndexes].map((index) => words[index]).filter(Boolean);

  if (!selected.length) {
    showStatus('Select at least one word before creating a set.', 'error');
    return;
  }

  const name = (setNameInput ? setNameInput.value.trim() : '').replace(/\s+/g, ' ');
  const finalName = name || `Custom set ${readSets().length + 1}`;

  const newSet = {
    id: toId(finalName),
    name: finalName,
    description: `${selected.length} cards`,
    cards: selected,
  };

  const nextSets = [newSet, ...readSets()];
  saveSets(nextSets);
  if (setNameInput) setNameInput.value = '';
  selectedWordIndexes.clear();
  if (setBuilder) setBuilder.classList.add('hidden');
  renderSetBuilderList();
  renderSetList();
  renderWordList();
  showStatus(`Created set: ${finalName}`, 'success');
}

function createChunkedSetsFromWordBank() {
  const words = readWordBank();
  const unassignedWords = getUnassignedWords();
  const selected = [...selectedWordIndexes].map((index) => words[index]).filter(Boolean);
  const eligibleWords = selected.length
    ? selected.filter((word) => unassignedWords.some((candidate) => getWordKey(candidate) === getWordKey(word)))
    : unassignedWords;

  if (!eligibleWords.length) {
    showStatus('There are no unassigned words left to chunk into sets.', 'error');
    return;
  }

  const chunkSizeValue = Number(setSizeInput ? setSizeInput.value : 50);
  const chunkSize = Number.isFinite(chunkSizeValue) && chunkSizeValue > 0 ? Math.min(500, Math.floor(chunkSizeValue)) : 50;
  const baseName = (setNameInput ? setNameInput.value.trim() : '').replace(/\s+/g, ' ') || 'Chunked set';
  const chunks = chunkWords(eligibleWords, chunkSize);

  if (!chunks.length) {
    showStatus(`Not enough words for a full ${chunkSize}-word chunk. The remaining words stay unassigned.`, 'error');
    return;
  }

  const builtSets = chunks.map((chunk, index) => ({
    id: toId(`${baseName} ${index + 1}`),
    name: chunks.length === 1 ? baseName : `${baseName} ${index + 1}`,
    description: `${chunk.length} cards`,
    cards: chunk,
    sourceMode: 'chunked',
  }));

  const nextSets = [...builtSets, ...readSets()];
  saveSets(nextSets);

  if (setNameInput) setNameInput.value = '';
  if (setSizeInput) setSizeInput.value = String(chunkSize);
  selectedWordIndexes.clear();
  if (setBuilder) setBuilder.classList.add('hidden');
  renderSetBuilderList();
  renderSetList();
  renderWordList();
  showStatus(`Created ${builtSets.length} set${builtSets.length === 1 ? '' : 's'} from ${eligibleWords.length} unassigned words.`, 'success');
}

function resetSetBuilderState() {
  selectedWordIndexes.clear();
  if (setNameInput) setNameInput.value = '';
  if (chunkSetCheckbox) chunkSetCheckbox.checked = false;
  if (setSizeInput) setSizeInput.value = '50';
  if (setBuilderList) renderSetBuilderList();
  updateSetBuilderMode();
}

function toggleSetBuilder() {
  if (!setBuilder) return;
  const isHidden = setBuilder.classList.toggle('hidden');
  if (!isHidden && setNameInput) {
    setNameInput.focus();
  }
  if (!setBuilder.classList.contains('hidden')) {
    renderSetBuilderList();
  }
  updateSetBuilderMode();
  if (isHidden) {
    resetSetBuilderState();
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
  if (accountButton) accountButton.classList.add('hidden');
  if (appUpdateButton) appUpdateButton.classList.add('hidden');
  if (tabBar) {
    tabBar.classList.add('hidden');
  }
  if (navBackButton) {
    navBackButton.classList.remove('hidden');
  }
  window.scrollTo(0, 0);
  studyTitle.textContent = set.name;
  showSetReviewMode();
}

function showMainView() {
  studyPanel.classList.add('hidden');
  studyPanel.classList.remove('context-writing-active');
  studyPanel.classList.remove('keyboard-visible');
  app.classList.remove('hidden');
  if (accountButton) accountButton.classList.remove('hidden');
  if (appUpdateButton) appUpdateButton.classList.remove('hidden');
  if (studySettingsMenu) studySettingsMenu.classList.add('hidden');
  if (setReviewList) setReviewList.classList.add('hidden');
  if (beginStudyButton) beginStudyButton.classList.add('hidden');
  if (contextGameStartButton) contextGameStartButton.classList.add('hidden');
  if (contextGameEnd) contextGameEnd.classList.add('hidden');
  if (studySetHeaderButton) studySetHeaderButton.classList.add('hidden');
  if (contextGame) contextGame.classList.add('hidden');
  if (contextResults) contextResults.classList.add('hidden');
  if (contextResults) contextResults.classList.add('hidden');
  if (studyTitle) studyTitle.classList.remove('hidden');
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
  if (studyTitle) studyTitle.classList.remove('hidden');
  if (setReviewList) {
    setReviewList.classList.remove('hidden');
    renderSetReviewList();
  }
  if (beginStudyButton) beginStudyButton.classList.add('hidden');
  if (studySetHeaderButton) studySetHeaderButton.classList.remove('hidden');
  if (flashcard) flashcard.classList.add('hidden');
  if (studyActions) studyActions.classList.add('hidden');
  if (studyFooter) studyFooter.classList.add('hidden');
}

function renderContextResults() {
  const total = contextProgress?.total || currentCards.length;
  const correct = contextProgress?.correct || 0;
  const mistakes = Object.values(contextProgress?.mistakes || {})
    .sort((a, b) => b.count - a.count);

  contextResultsScore.textContent = `${correct} correct out of ${total} words`;
  contextResultsMistakes.innerHTML = mistakes.length
    ? `<strong>Most common mistakes</strong>${mistakes.slice(0, 5).map((mistake) => `<span>${mistake.front} - ${mistake.back}: ${mistake.count} mistake${mistake.count === 1 ? '' : 's'}</span>`).join('')}`
    : '<span>No mistakes recorded yet.</span>';
}

function showContextResults(completed = false) {
  studyPanel.classList.remove('context-writing-active');
  studyPanel.classList.remove('keyboard-visible');
  if (contextGame) contextGame.classList.add('hidden');
  if (contextResults) contextResults.classList.remove('hidden');
  if (contextConfetti) {
    contextConfetti.innerHTML = completed
      ? Array.from({ length: 18 }, (_, index) => `<span style="left:${(index * 17) % 100}%; background:hsl(${index * 35}, 75%, 55%); animation-delay:${(index % 5) * 45}ms"></span>`).join('')
      : '';
  }
  renderContextResults();
}

function showStudyOptions() {
  studyPanel.classList.remove('context-writing-active');
  studyPanel.classList.remove('keyboard-visible');
  if (studyTitle) studyTitle.classList.remove('hidden');
  if (setReviewList) setReviewList.classList.add('hidden');
  if (studySetHeaderButton) studySetHeaderButton.classList.add('hidden');
  if (beginStudyButton) beginStudyButton.classList.remove('hidden');
  if (contextGameStartButton) contextGameStartButton.classList.remove('hidden');
  if (contextGameEnd) contextGameEnd.classList.add('hidden');
  if (contextGame) contextGame.classList.add('hidden');
  if (contextResults) contextResults.classList.add('hidden');
}

function beginStudySession() {
  studyPanel.classList.remove('context-writing-active');
  studyPanel.classList.remove('keyboard-visible');
  if (setReviewList) setReviewList.classList.add('hidden');
  if (beginStudyButton) beginStudyButton.classList.add('hidden');
  if (contextGameStartButton) contextGameStartButton.classList.add('hidden');
  if (contextGameEnd) contextGameEnd.classList.add('hidden');
  if (studySetHeaderButton) studySetHeaderButton.classList.add('hidden');
  if (studyTitle) studyTitle.classList.add('hidden');
  if (contextGame) contextGame.classList.add('hidden');
  if (contextResults) contextResults.classList.add('hidden');
  if (flashcard) flashcard.classList.remove('hidden');
  if (studyActions) studyActions.classList.remove('hidden');
  if (studyFooter) studyFooter.classList.remove('hidden');
  renderCurrentCard();
}

function normalizeAnswer(value) {
  return String(value || '').trim().toLocaleLowerCase('uk-UA').replace(/\s+/g, ' ');
}

function getContextCard() {
  const cardId = contextQueue[contextProgress?.position || 0];
  return currentCards.find((card) => card.id === cardId) || null;
}

function buildContextProgress(savedProgress) {
  const allCardIds = currentCards.map((card) => card.id);
  if (savedProgress && !Array.isArray(savedProgress.queue) && Number.isInteger(savedProgress.index)) {
    return {
      queue: allCardIds,
      position: Math.min(savedProgress.index, allCardIds.length),
      total: currentCards.length,
      correct: savedProgress.correct || 0,
      attempts: savedProgress.attempts || 0,
      mistakes: savedProgress.mistakes || {},
      complete: false,
    };
  }

  if (savedProgress && Array.isArray(savedProgress.queue) && !savedProgress.complete) {
    return {
      ...savedProgress,
      queue: savedProgress.queue.filter((id) => allCardIds.includes(id)),
      position: Math.min(savedProgress.position || 0, savedProgress.queue.length),
      total: savedProgress.total || currentCards.length,
      mistakes: savedProgress.mistakes || {},
    };
  }

  return {
    queue: allCardIds,
    position: 0,
    total: currentCards.length,
    correct: 0,
    attempts: 0,
    mistakes: {},
    complete: false,
  };
}

function renderContextGameCard() {
  const card = getContextCard();
  if (!card) return;

  currentIndex = currentCards.findIndex((candidate) => candidate.id === card.id);

  contextGameMeaning.textContent = card.back || 'Translate the word from context';
  contextGamePhrase.textContent = card.phrase || `(${card.front})`;
  contextGameAnswer.value = '';
  contextGameFeedback.textContent = '';
  contextGameFeedback.className = 'status';
  contextGameNext.classList.add('hidden');
}

function startContextWritingGame() {
  if (!currentCards.length) return;
  studyPanel.classList.add('context-writing-active');
  studyPanel.classList.remove('keyboard-visible');
  contextInitialViewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  if (setReviewList) setReviewList.classList.add('hidden');
  if (beginStudyButton) beginStudyButton.classList.add('hidden');
  if (studySetHeaderButton) studySetHeaderButton.classList.add('hidden');
  if (studyTitle) studyTitle.classList.add('hidden');
  if (flashcard) flashcard.classList.add('hidden');
  if (studyActions) studyActions.classList.add('hidden');
  if (studyFooter) studyFooter.classList.add('hidden');
  if (contextGame) contextGame.classList.remove('hidden');
  if (contextGameEnd) contextGameEnd.classList.remove('hidden');
  if (contextResults) contextResults.classList.add('hidden');
  const savedProgress = readContextProgress()[currentSetId];
  contextProgress = buildContextProgress(savedProgress);
  contextQueue = contextProgress.queue;
  currentIndex = 0;
  renderContextGameCard();
}

function updateContextKeyboardLayout() {
  if (!studyPanel.classList.contains('context-writing-active')) return;

  const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const keyboardVisible = contextInitialViewportHeight !== null
    && contextInitialViewportHeight - viewportHeight > 120;
  studyPanel.classList.toggle('keyboard-visible', keyboardVisible);
}

function advanceContextGame() {
  const currentScrollPosition = window.scrollY;
  const currentPanelScrollPosition = studyPanel.scrollTop;
  if ((contextProgress.position || 0) >= contextQueue.length - 1) {
    contextProgress.complete = true;
    contextProgress.position = contextQueue.length;
    saveContextProgress();
    showContextResults(true);
    return;
  }
  contextProgress.position += 1;
  saveContextProgress();
  renderContextGameCard();
  window.scrollTo(0, currentScrollPosition);
  studyPanel.scrollTop = currentPanelScrollPosition;
  contextGameAnswer.focus({ preventScroll: true });
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

function openGoogleTranslateText(text, language = 'uk-UA') {
  if (!text) return;

  const cleanText = String(text).trim();
  if (!cleanText) return;

  const targetLanguage = language === 'uk-UA' ? 'uk' : 'en';
  const fromLanguage = language === 'uk-UA' ? 'uk' : 'en';
  const translateUrl = `https://translate.google.com/?sl=${fromLanguage}&tl=${targetLanguage}&text=${encodeURIComponent(cleanText)}&op=translate`;
  window.open(translateUrl, '_blank', 'noopener,noreferrer');
}

function playGoogleTranslateAudio(text, language = 'uk-UA') {
  if (!text) return;

  const cleanText = String(text).trim();
  if (!cleanText) return;

  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
  }

  const targetLanguage = language === 'uk-UA' ? 'uk' : 'en';
  const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(cleanText)}&tl=${targetLanguage}&total=1&idx=0&textlen=${cleanText.length}`;

  const audio = new Audio(googleUrl);
  activeAudio = audio;
  audio.volume = 1;
  audio.play().catch(() => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = language;
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      activeAudio = null;
      return;
    }

    openGoogleTranslateText(cleanText, language);
    activeAudio = null;
  });
}

function speakText(text, language = 'uk-UA') {
  if (!text) return;

  const cleanText = String(text).trim();
  if (!cleanText) return;

  const browserSpeechAvailable = 'speechSynthesis' in window && window.speechSynthesis && window.speechSynthesis.getVoices().length > 0;
  if (browserSpeechAvailable) {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = language;
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return;
  }

  playGoogleTranslateAudio(cleanText, language);
}

function handleSpeak() {
  const card = currentCards[currentIndex];
  if (!card) return;
  const activeText = flipped ? card.back : card.front;
  const language = flipped ? 'en-US' : 'uk-UA';
  speakText(activeText, language);
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
backButton.addEventListener('click', () => {
  const contextGameIsOpen = contextGame && !contextGame.classList.contains('hidden');
  const contextResultsAreOpen = contextResults && !contextResults.classList.contains('hidden');
  if (contextGameIsOpen || contextResultsAreOpen) {
    showStudyOptions();
    return;
  }
  showMainView();
});

refreshWordsButton.addEventListener('click', () => {
  renderWordList();
  showStatus('Word list refreshed.', 'success');
});

if (wordSortSelect) {
  wordSortSelect.addEventListener('change', (event) => {
    const nextSort = event.target.value === 'oldest' ? 'oldest' : 'newest';
    setWordSortPreference(nextSort);
    renderWordList();
  });
}

if (setSortSelect) {
  setSortSelect.addEventListener('change', (event) => {
    const nextSort = event.target.value === 'oldest' ? 'oldest' : 'newest';
    setSetSortPreference(nextSort);
    renderSetList();
  });
}

function applyWordInputKeyboardHints() {
  if (addWordFrontInput) {
    addWordFrontInput.setAttribute('lang', 'uk-UA');
    addWordFrontInput.setAttribute('inputmode', 'text');
    addWordFrontInput.setAttribute('autocapitalize', 'none');
    addWordFrontInput.setAttribute('autocorrect', 'off');
  }

  if (addWordBackInput) {
    addWordBackInput.setAttribute('lang', 'en-US');
    addWordBackInput.setAttribute('inputmode', 'latin');
    addWordBackInput.setAttribute('autocapitalize', 'sentences');
    addWordBackInput.setAttribute('autocorrect', 'on');
  }

  if (addWordPhraseInput) {
    addWordPhraseInput.setAttribute('lang', 'uk-UA');
    addWordPhraseInput.setAttribute('inputmode', 'text');
    addWordPhraseInput.setAttribute('autocapitalize', 'sentences');
    addWordPhraseInput.setAttribute('autocorrect', 'off');
  }
}

if (toggleAddWordFormButton && addWordForm) {
  toggleAddWordFormButton.addEventListener('click', () => {
    const isHidden = addWordForm.classList.toggle('hidden');
    toggleAddWordFormButton.textContent = isHidden ? 'Add word' : 'Close';
    if (!isHidden) {
      applyWordInputKeyboardHints();
      if (addWordFrontInput) {
        addWordFrontInput.focus();
      }
    }
  });
}

if (addWordForm) {
  applyWordInputKeyboardHints();
  addWordForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const front = (addWordFrontInput ? addWordFrontInput.value : '').trim();
    const back = (addWordBackInput ? addWordBackInput.value : '').trim();
    const phrase = (addWordPhraseInput ? addWordPhraseInput.value : '').trim();

    if (!front || !back) {
      showStatus('Please enter both a word and its meaning.', 'error');
      return;
    }

    const nextWords = mergeUniqueWordEntries(readWordBank(), [{
      id: `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      front,
      back,
      phrase,
      note: '',
    }]);

    saveWordBank(nextWords);
    renderWordList();
    addWordForm.reset();
    addWordForm.classList.add('hidden');
    toggleAddWordFormButton.textContent = 'Add word';
    showStatus('Word added.', 'success');
  });
}

if (deleteCardButton) {
  deleteCardButton.addEventListener('click', deleteCurrentCard);
}

if (beginStudyButton) {
  beginStudyButton.addEventListener('click', beginStudySession);
}

if (contextGameStartButton) {
  contextGameStartButton.addEventListener('click', startContextWritingGame);
}

function checkContextAnswer() {
  const card = getContextCard();
    if (!card) return;

    const isCorrect = normalizeAnswer(contextGameAnswer.value) === normalizeAnswer(card.front);
    contextProgress.attempts = (contextProgress.attempts || 0) + 1;
    if (isCorrect) {
      contextProgress.correct = (contextProgress.correct || 0) + 1;
    } else {
      const mistakeKey = card.id || card.front;
      const existingMistake = contextProgress.mistakes[mistakeKey] || { front: card.front, back: card.back, count: 0 };
      existingMistake.count += 1;
      contextProgress.mistakes[mistakeKey] = existingMistake;
      if (!contextQueue.slice((contextProgress.position || 0) + 1).includes(card.id)) {
        contextQueue.push(card.id);
        contextProgress.queue = contextQueue;
      }
    }
    saveContextProgress();
    contextGameFeedback.textContent = isCorrect
      ? 'Correct!'
      : `Not quite. The word is ${card.front}.`;
    contextGameFeedback.className = `status ${isCorrect ? 'success' : 'error'}`;
    contextGameNext.classList.remove('hidden');
    contextGameAnswer.focus({ preventScroll: true });
}

if (contextGameSubmit) {
  contextGameSubmit.addEventListener('click', checkContextAnswer);
}

if (contextGameAnswer) {
  contextGameAnswer.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      checkContextAnswer();
    }
  });

  contextGameAnswer.addEventListener('focus', () => {
    updateContextKeyboardLayout();
    window.setTimeout(updateContextKeyboardLayout, 250);
  });
  contextGameAnswer.addEventListener('blur', () => {
    if (!window.visualViewport) {
      studyPanel.classList.remove('keyboard-visible');
    }
  });
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateContextKeyboardLayout);
}

if (contextGameNext) {
  contextGameNext.addEventListener('click', advanceContextGame);
}

if (contextGameEnd) {
  contextGameEnd.addEventListener('click', () => {
    showContextResults(false);
  });
}

if (contextResultsContinue) {
  contextResultsContinue.addEventListener('click', () => {
    contextProgress = buildContextProgress(null);
    contextQueue = contextProgress.queue;
    saveContextProgress();
    contextResults.classList.add('hidden');
    contextGame.classList.remove('hidden');
    studyPanel.classList.add('context-writing-active');
    currentIndex = 0;
    renderContextGameCard();
  });
}

if (studySetHeaderButton) {
  studySetHeaderButton.addEventListener('click', showStudyOptions);
}

if (studySettingsButton && studySettingsMenu) {
  studySettingsButton.addEventListener('click', () => {
    studySettingsMenu.classList.toggle('hidden');
  });
}

if (shuffleCardsButton) {
  shuffleCardsButton.addEventListener('click', () => {
    for (let index = currentCards.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [currentCards[index], currentCards[randomIndex]] = [currentCards[randomIndex], currentCards[index]];
    }
    currentIndex = 0;
    flipped = false;
    if (studySettingsMenu) studySettingsMenu.classList.add('hidden');
    if (contextGame && !contextGame.classList.contains('hidden')) {
      renderContextGameCard();
    } else {
      renderCurrentCard();
    }
  });
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
  studyPanel.classList.remove('context-writing-active');
  studyPanel.classList.remove('keyboard-visible');
  if (accountButton) accountButton.classList.remove('hidden');
  if (appUpdateButton) appUpdateButton.classList.remove('hidden');
  if (studySettingsMenu) studySettingsMenu.classList.add('hidden');
  if (contextGame) contextGame.classList.add('hidden');
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

if (accountButton) {
  accountButton.addEventListener('click', () => {
    if (usernameModal) {
      const username = getCurrentUsername();
      if (startUsernameInput) {
        startUsernameInput.value = username === 'default' ? '' : username;
      }
      usernameModal.classList.remove('hidden');
      if (startUsernameInput) {
        startUsernameInput.focus();
      }
    }
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

if (closeSetBuilderButton) {
  closeSetBuilderButton.addEventListener('click', () => {
    if (!setBuilder) return;
    setBuilder.classList.add('hidden');
    resetSetBuilderState();
    if (addSetButton) {
      addSetButton.textContent = 'Add set';
    }
  });
}

if (chunkSetCheckbox) {
  chunkSetCheckbox.addEventListener('change', updateSetBuilderMode);
}

if (setBuilderList) {
  setBuilderList.addEventListener('change', (event) => {
    const checkbox = event.target.closest('input[type="checkbox"][data-word-index]');
    if (!checkbox) return;
    const index = Number(checkbox.dataset.wordIndex);
    applyWordSelection(index, checkbox.checked);
  });
}

removeLegacyDemoSetsFromStorage();
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
