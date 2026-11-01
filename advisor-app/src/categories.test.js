import { describe, it, expect } from 'vitest';
import { withCustomCats } from './categories.js';

describe('withCustomCats', () => {
  it('inserts custom categories before the last item, skipping duplicates', () => {
    expect(withCustomCats(['א', 'ב', 'ג'], { customCats: ['ד', 'א'] })).toEqual(['א', 'ב', 'ד', 'ג']);
  });
  it('returns the list unchanged without settings', () => {
    const list = ['א', 'ב'];
    expect(withCustomCats(list, undefined)).toBe(list);
  });
});
