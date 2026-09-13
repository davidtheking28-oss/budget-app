import { useEffect, useState } from 'react';

// Keeps one query-param in sync with a piece of local state, without touching
// any of the other params App.jsx's own URL-sync effect owns (client/nav/y/m/mode).
// `nullValue` is the state value that means "remove the param" (e.g. null/'all').
export function useUrlParam(key, nullValue) {
  const [value, setValue] = useState(() => new URLSearchParams(window.location.search).get(key) ?? nullValue);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (value === nullValue || value == null) params.delete(key);
    else params.set(key, value);
    const query = params.toString();
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [key, value, nullValue]);

  return [value, setValue];
}
