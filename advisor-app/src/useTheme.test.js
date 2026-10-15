import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function setup({ stored = {}, systemDark = false } = {}) {
  const data = { ...stored };
  const metas = [{ content: '' }, { content: '' }];
  const attrs = {};
  vi.stubGlobal('localStorage', {
    getItem: key => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: key => { delete data[key]; }
  });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: systemDark }) });
  vi.stubGlobal('document', {
    documentElement: { setAttribute: (key, value) => { attrs[key] = value; } },
    querySelectorAll: () => metas.map(meta => ({ setAttribute: (key, value) => { meta.content = value; } }))
  });
  return { data, metas, attrs };
}

describe('useTheme module startup', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it('follows a dark system without saving it as a manual choice', async () => {
    const env = setup({ systemDark: true });
    await import('./useTheme.js');
    expect(env.attrs['data-theme']).toBe('dark');
    expect(env.data.advisor_theme_choice).toBeUndefined();
    expect(env.metas.map(meta => meta.content)).toEqual(['#0b1110', '#0b1110']);
  });

  it('honors a manual choice over the system theme', async () => {
    const env = setup({ stored: { advisor_theme_choice: 'light' }, systemDark: true });
    await import('./useTheme.js');
    expect(env.attrs['data-theme']).toBe('light');
    expect(env.metas.map(meta => meta.content)).toEqual(['#f5f6f2', '#f5f6f2']);
  });

  it('ignores the legacy key that used to persist the first system reading', async () => {
    const env = setup({ stored: { advisor_theme: 'light' }, systemDark: true });
    await import('./useTheme.js');
    expect(env.attrs['data-theme']).toBe('dark');
  });
});
