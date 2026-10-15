import { describe, it, expect } from 'vitest';
import { categorizeByDictionary } from './categorizeDict.js';

describe('categorizeByDictionary', () => {
  it('prefers the longest matching keyword', () => {
    expect(categorizeByDictionary('סופר פארם סניף 12', 'expense')).toBe('פארם');
    expect(categorizeByDictionary('רמי לוי שיווק', 'expense')).toBe('מזון לבית');
  });

  it('maps restaurants and delivery to eating out', () => {
    expect(categorizeByDictionary('וולט תל אביב', 'expense')).toBe('אוכל בחוץ ובילויים');
  });

  it('returns null for unknown descriptions', () => {
    expect(categorizeByDictionary('xqzv 123', 'expense')).toBeNull();
    expect(categorizeByDictionary('', 'expense')).toBeNull();
  });

  it('only returns an income category for income lines', () => {
    expect(categorizeByDictionary('משכורת חודשית', 'income')).toBe('שכר');
    expect(categorizeByDictionary('משכורת חודשית', 'expense')).toBeNull();
  });

  it('classifies electricity as a fixed expense and overseas shops as foreign orders', () => {
    expect(categorizeByDictionary('תשלום חשמל', 'expense')).toBe('חשמל');
    expect(categorizeByDictionary('ALIEXPRESS.COM', 'expense')).toBe('הזמנות מחו״ל');
    expect(categorizeByDictionary('חשמלאי יוסי', 'expense')).toBe('שונות');
  });
});
