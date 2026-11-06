// Editors synchronously register pending saves; navigation waits for durability.
export async function requestNavigation() {
  const detail = { pending: [] };
  try {
    window.dispatchEvent(new CustomEvent('budget:before-navigate', { detail }));
    const results = await Promise.all(detail.pending);
    return results.every(result => result !== false);
  } catch { return false; }
}
