import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { withCustomCats, fixedCatsFor, expenseCatsFor, transactionCatsFor, EXPENSE_CATS, FIXED_CATS, INCOME_CATS, EXPENSE_CATS_BUSINESS, INCOME_CATS_BUSINESS } from './categories.js';

describe('withCustomCats', () => {
  it('inserts custom categories before the last item, skipping duplicates', () => {
    expect(withCustomCats(['א', 'ב', 'ג'], { customCats: ['ד', 'א'] })).toEqual(['א', 'ב', 'ד', 'ג']);
  });
  it('returns the list unchanged without settings', () => {
    const list = ['א', 'ב'];
    expect(withCustomCats(list, undefined)).toBe(list);
  });
});


describe('advisor and client category parity', () => {
  it('keeps all five base taxonomies identical', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    for (const [name, expected] of Object.entries({ EXPENSE_CATS, FIXED_CATS, INCOME_CATS, EXPENSE_CATS_BUSINESS, INCOME_CATS_BUSINESS })) {
      const array = html.split('\n').find(line => line.startsWith('const ' + name + ' ') || line.startsWith('const ' + name + '='));
      expect(Function('return ' + array.slice(array.indexOf('=') + 1))()).toEqual(expected);
    }
  });
  const data = { settings: { customCats: ['לימוד אישי', 'חשמל', 'לימוד אישי'], customFixedCats: ['אחזקת ציוד'] }, fixed_expenses: [{ id: 'משכנתא', amount: 3000 }], budgets: { 'לימוד אישי': 200, 'תחזוקת אתר': 300, 'משכנתא': 3000 }, transactions: [{ type: 'expense', cat: 'טיול עבודה', amount: 50 }] };
  it('keeps fixed categories separate from variable budgets and discovers saved custom names', () => {
    expect(fixedCatsFor(data)).toContain('אחזקת ציוד');expect(fixedCatsFor(data)).toContain('משכנתא');
    const variable = expenseCatsFor('personal', data);
    expect(variable).toEqual(expect.arrayContaining(['לימוד אישי', 'תחזוקת אתר', 'טיול עבודה']));
    expect(variable).not.toContain('חשמל');expect(variable).not.toContain('משכנתא');expect(new Set(variable).size).toBe(variable.length);
  });
  it('uses business categories in business budgets', () => {
    const variable = expenseCatsFor('business', data);
    expect(variable).toContain('שיווק ופרסום');expect(variable).toContain('אחר');expect(variable).not.toContain('מזון לבית');
  });
  it('offers both linked fixed and custom variable names when recording transactions', () => {
    expect(transactionCatsFor('personal', data, 'expense')).toEqual(expect.arrayContaining(['משכנתא', 'אחזקת ציוד', 'תחזוקת אתר']));
  });
});
