// Shared jsonb-array mutation helpers, used by every budget_data list-editing
// screen (Subscriptions, Credit, Planning, Assets). Kept in one place so the
// screens themselves stay split by domain instead of by "which helper do I need".
export function addItem(save, key, item) {
  return save(cur => ({ [key]: [...(cur[key] || []), { id: Date.now() + Math.random(), ...item }] }));
}
export function updateItem(save, key, id, patch) {
  return save(cur => ({ [key]: (cur[key] || []).map(x => x.id === id ? { ...x, ...patch } : x) }));
}
export function removeItem(save, key, id) {
  return save(cur => ({ [key]: (cur[key] || []).filter(x => x.id !== id) }));
}
