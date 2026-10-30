import { useEffect, useRef, useState } from 'react';

// Keeps one query-param in sync with a piece of local state, without touching
// any of the other params App.jsx's own URL-sync effect owns (client/nav/y/m/mode).
// `nullValue` is the state value that means "remove the param" (e.g. null/'all').
// With `history: true` each change adds a history entry, so the browser back and
// forward buttons move between screens instead of leaving the app.
export function useUrlParam(key, nullValue, initialValue = nullValue, { history = false } = {}) {
  const [value, setValue] = useState(() => new URLSearchParams(window.location.search).get(key) ?? initialValue);
  const mounted = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (value === nullValue || value == null) params.delete(key);
    else params.set(key, value);
    const query = params.toString();
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    const current = window.location.pathname + window.location.search;
    if (history && mounted.current && url !== current) window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
    mounted.current = true;
  }, [key, value, nullValue, history]);

  useEffect(() => {
    if (!history) return undefined;
    const onPop = () => setValue(new URLSearchParams(window.location.search).get(key) ?? initialValue);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [key, initialValue, history]);

  return [value, setValue];
}
