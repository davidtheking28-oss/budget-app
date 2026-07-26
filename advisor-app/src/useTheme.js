import { useCallback, useState } from 'react';

const KEY = 'advisor_theme';

function resolve() {
  const stored = localStorage.getItem(KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(KEY, theme);
}

// Applied at module load, before React first renders, so charts that read the
// computed CSS variables during render never see the wrong theme.
apply(resolve());

export function useTheme() {
  const [theme, setTheme] = useState(resolve);

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      // Applied synchronously so the re-render this triggers already reads the
      // new variables; a useEffect would run too late for that pass.
      apply(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
