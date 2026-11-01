import { useEffect, useRef } from 'react';
import Logo from './Logo.jsx';
import styles from './TopNav.module.css';

export default function TopNav({ tabs, homeLinks, onBack, homeActive, onPrint, onPresent, nav, activeNav, onNavChange, theme, onToggleTheme, end, hideBrand }) {
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
        {!hideBrand && <div className={styles.brand}><Logo size="sm" /><span>שקל שקל · יועץ</span></div>}
        <nav className={styles.links} aria-label="ניווט ראשי">
          {tabs && tabs.map(t => (
            <button key={t.key} type="button" className={styles.deptTab + (t.active ? ' ' + styles.deptTabOn : '')} onClick={t.onClick} aria-current={t.active ? 'page' : undefined}>
              <span className={styles.deptIcon} aria-hidden="true">{t.icon}</span>{t.label}
            </button>
          ))}
          {!tabs && globals.map(g => (
            <button key={g.key} type="button" className={styles.pill + (g.active ? ' ' + styles.pillOn : '')} onClick={g.onClick} aria-current={g.active ? 'page' : undefined}>{g.label}</button>
          ))}
        </nav>
        <div className={styles.end}>
          {onToggleTheme && (
            <button type="button" className={styles.themeBtn} onClick={onToggleTheme} aria-pressed={theme === 'dark'} aria-label={theme === 'dark' ? 'עבור למצב בהיר' : 'עבור למצב כהה'}>
              {theme === 'dark'
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M17.7 6.3l1.4-1.4M4.9 19.1l1.4-1.4" /></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 13.2A8.2 8.2 0 0 1 10.8 4a8.5 8.5 0 1 0 9.2 9.2z" /></svg>}
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
