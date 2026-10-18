import { describe, it, expect } from 'vitest';
import { brandStyle } from './brandColor.js';

describe('brandStyle', () => {
  it('rejects anything but #rrggbb', () => {
    expect(brandStyle(null)).toBeUndefined();
    expect(brandStyle('red')).toBeUndefined();
    expect(brandStyle('#fff')).toBeUndefined();
    expect(brandStyle('#12345g')).toBeUndefined();
  });
  it('sets accent vars from the hex', () => {
    const s = brandStyle('#1a73e8');
    expect(s['--accent']).toBe('#1a73e8');
    expect(s['--brand']).toBe('#1a73e8');
    expect(s['--accent-rgb']).toBe('26, 115, 232');
  });
  it('picks readable text on the accent', () => {
    expect(brandStyle('#ffd400')['--accent-ink']).toBe('#111111');
    expect(brandStyle('#0a3d91')['--accent-ink']).toBe('#ffffff');
  });
});
