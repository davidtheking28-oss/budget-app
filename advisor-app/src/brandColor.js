export const DEFAULT_BRAND = '#0a7a62';

export function brandStyle(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return undefined;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const lin = c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const dark = c => Math.round(c * 0.82);
  return {
    '--brand': hex,
    '--accent': hex,
    '--accent-rgb': `${r}, ${g}, ${b}`,
    '--accent-2': `rgb(${dark(r)}, ${dark(g)}, ${dark(b)})`,
    '--accent-ink': lum > 0.4 ? '#111111' : '#ffffff',
    '--accent-dim': `rgba(${r}, ${g}, ${b}, 0.1)`,
  };
}
