export function readWorkspace(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

export function writeWorkspace(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { return; }
}
