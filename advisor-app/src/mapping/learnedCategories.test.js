import { describe, it, expect } from 'vitest';
import { learnCategory, lookupLearnedCategory, normalizeDescription } from './learnedCategories.js';

function memoryStore() {
  const data = {};
  return { getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
}

describe('learnedCategories', () => {
  it('normalizes digits and punctuation out of descriptions', () => {
    expect(normalizeDescription('  רמי לוי 123, סניף-4 ')).toBe('רמי לוי סניף');
  });

  it('returns the learned category for the same merchant', () => {
    const store = memoryStore();
    learnCategory('קפה גרג 2231', 'תחביבים', store);
    expect(lookupLearnedCategory('קפה גרג 9981', store)).toBe('תחביבים');
  });

  it('matches a longer description that contains a learned merchant', () => {
    const store = memoryStore();
    learnCategory('גרג', 'תחביבים', store);
    expect(lookupLearnedCategory('קפה גרג רמת גן', store)).toBe('תחביבים');
  });

  it('does not learn neutral categories', () => {
    const store = memoryStore();
    learnCategory('סוחר מסתורי', 'שונות', store);
    expect(lookupLearnedCategory('סוחר מסתורי', store)).toBeNull();
  });
});
