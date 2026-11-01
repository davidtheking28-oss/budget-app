import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8');
const variables = block => Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]));
const light = variables(css.match(/:root\s*\{([^}]+)\}/)[1]);
const dark = { ...light, ...variables(css.match(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/)[1]) };
const resolve = (vars, key) => vars[key].startsWith('var(') ? resolve(vars, vars[key].slice(4, -1)) : vars[key];
const luminance = hex => {
  const [r, g, b] = [1, 3, 5].map(index => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

describe('small interactive text contrast', () => {
  for (const [name, vars] of Object.entries({ light, dark })) {
    it(`keeps active buttons, links and hover text readable in ${name} mode`, () => {
      for (const [foreground, background] of [
        ['--accent-ink', '--accent'],
        ['--accent', '--surface'],
        ['--accent', '--surface2'],
        ['--primary-ink', '--primary-hover']
      ]) {
        expect(contrast(resolve(vars, foreground), resolve(vars, background)), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
