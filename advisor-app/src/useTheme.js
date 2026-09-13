import { useCallback, useState } from 'react';

const KEY = 'advisor_theme';

function resolve() {
  const stored = localStorage.getItem(KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const THEME_COLOR = { light: '#eef3f1', dark: '#0b1110' };

function apply(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(KEY, theme);
  // The <meta name="theme-color"> tags in index.html only track the OS's
  // prefers-color-scheme; a manual toggle here overrides the OS setting, so
  // the browser chrome color must follow that override too.
  document.querySelectorAll('meta[name="theme-color"]').forEach(el => el.setAttribute('content', THEME_COLOR[theme]));
}

// Applied at module load, before React first renders, so charts that read the
// computed CSS variables during render never see the wrong theme.
apply(resolve());

export function useTheme() {
  const [theme, setTheme] = useState(resolve);

  const toggle = useCallback(() => {
    // A short-lived class, not a permanent global transition — scoping it to
    // just the toggle moment eases the light/dark flip without slowing down
    // every other hover/press transition in the app the rest of the time.
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    setTimeout(() => root.classList.remove('theme-transitioning'), 220);
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
