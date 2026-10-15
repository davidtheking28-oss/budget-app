import { useCallback, useEffect, useState } from 'react';

const KEY = 'advisor_theme_choice';

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve() {
  const stored = localStorage.getItem(KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return systemTheme();
}

const THEME_COLOR = { light: '#f5f6f2', dark: '#0b1110' };

function apply(theme) {
  document.documentElement.setAttribute('data-theme', theme);
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

  useEffect(() => {
    const sync = () => {
      if (localStorage.getItem(KEY)) return;
      const next = systemTheme();
      apply(next);
      setTheme(next);
    };
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    query?.addEventListener?.('change', sync);
    window.addEventListener('pageshow', sync);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    const timers = [300, 1200, 3500].map(ms => setTimeout(sync, ms));
    return () => {
      query?.removeEventListener?.('change', sync);
      window.removeEventListener('pageshow', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
      timers.forEach(clearTimeout);
    };
  }, []);

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
      localStorage.setItem(KEY, next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
