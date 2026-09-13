import { toast } from '../toast.js';

// Shared jsonb-array mutation helpers, used by every budget_data list-editing
// screen (Subscriptions, Credit, Planning, Assets). Kept in one place so the
// screens themselves stay split by domain instead of by "which helper do I need".
export function addItem(save, key, item) {
  return save(cur => ({ [key]: [...(cur[key] || []), { id: Date.now() + Math.random(), ...item }] }));
}
export function updateItem(save, key, id, patch) {
  return save(cur => ({ [key]: (cur[key] || []).map(x => x.id === id ? { ...x, ...patch } : x) }));
}
export async function removeItem(save, key, id, message = 'הפריט נמחק') {
  let removed;
  const ok = await save(cur => {
    removed = (cur[key] || []).find(x => x.id === id);
    return { [key]: (cur[key] || []).filter(x => x.id !== id) };
  });
  if (ok && removed) {
    toast(message, 'success', {
      label: 'בטל',
      onClick: () => save(cur => ({ [key]: [...(cur[key] || []), removed] }))
    });
  }
  return ok;
}
