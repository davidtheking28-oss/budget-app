let listeners = [];
let idSeq = 0;

export function toast(message, kind = 'info') {
  const id = ++idSeq;
  const item = { id, message, kind };
  listeners.forEach(fn => fn(item));
  return id;
}

export function subscribeToast(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}
