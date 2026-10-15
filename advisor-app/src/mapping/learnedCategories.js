const STORAGE_KEY = 'advisor_learned_categories';
const MAX_ENTRIES = 400;
const NEUTRAL = ['שונות', 'אחר'];

export function normalizeDescription(desc) {
  return String(desc || '').toLowerCase().replace(/[\d.,!?"'()[\]{}:;₪$%*+#@/\\-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function read(store) {
  try { return JSON.parse(store?.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

export function learnCategory(desc, category, store = globalThis.localStorage) {
  const key = normalizeDescription(desc);
  if (key.length < 2 || !category || NEUTRAL.includes(category)) return;
  const learned = read(store);
  delete learned[key];
  learned[key] = category;
  const keys = Object.keys(learned);
  if (keys.length > MAX_ENTRIES) keys.slice(0, keys.length - MAX_ENTRIES).forEach(k => delete learned[k]);
  try { store?.setItem(STORAGE_KEY, JSON.stringify(learned)); } catch { /* storage unavailable */ }
}

export function lookupLearnedCategory(desc, store = globalThis.localStorage) {
  const key = normalizeDescription(desc);
  if (!key) return null;
  const learned = read(store);
  if (learned[key]) return learned[key];
  let best = null;
  let bestLen = 0;
  for (const [k, cat] of Object.entries(learned)) {
    if (k.length > bestLen && k.length >= 3 && key.includes(k)) { best = cat; bestLen = k.length; }
  }
  return best;
}
