import { useEffect, useRef } from 'react';
import Logo from './Logo.jsx';
import styles from './TopNav.module.css';

export default function TopNav({ homeLinks, onBack, homeActive, onPrint, onPresent, nav, activeNav, onNavChange, theme, onToggleTheme, end }) {
  const globals = [
    onBack && { key: 'clients', label: 'הלקוחות שלי', onClick: onBack, active: homeActive },
    ...(homeLinks || []).map(l => ({ key: l.key, label: l.label, onClick: l.onClick, active: l.active })),
    onPrint && { key: 'report', label: 'דוח חודשי', onClick: onPrint },
    onPresent && { key: 'present', label: 'תמונת מצב ללקוח', onClick: onPresent }
  ].filter(Boolean);

  const subRef = useRef(null);
  useEffect(() => {
    subRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [activeNav]);

  return (
    <header className={styles.top}>
      <div className={styles.bar}>
        <div className={styles.brand}><Logo size="sm" /><span>שקל שקל · יועץ</span></div>
        <nav className={styles.links} aria-label="ניווט ראשי">
          {globals.map(g => (
            <button key={g.key} type="button" className={styles.pill + (g.active ? ' ' + styles.pillOn : '')} onClick={g.onClick} aria-current={g.active ? 'page' : undefined}>{g.label}</button>
          ))}
        </nav>
        <div className={styles.end}>
          {onToggleTheme && (
            <button type="button" className={styles.themeBtn} onClick={onToggleTheme} aria-pressed={theme === 'dark'} aria-label={theme === 'dark' ? 'עבור למצב בהיר' : 'עבור למצב כהה'}>
              {theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
            </button>
          )}
          {end}
        </div>
      </div>
      {nav && nav.length > 0 && (
        <nav ref={subRef} className={styles.sub} aria-label="ניווט לקוח">
          {nav.map((n, i) => (
            <span key={n.key} className={styles.subItem}>
              {i > 0 && n.group !== nav[i - 1].group && <span className={styles.sep} aria-hidden="true" />}
              <button type="button" className={styles.tab + (n.key === activeNav ? ' ' + styles.tabOn : '')} onClick={() => onNavChange(n.key)} aria-current={n.key === activeNav ? 'page' : undefined}>{n.label}</button>
            </span>
          ))}
        </nav>
      )}
    </header>
  );
}
