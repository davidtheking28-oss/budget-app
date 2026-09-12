import Logo from './Logo.jsx';
import styles from './IconRail.module.css';

const svgProps = { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export default function IconRail({ onBack, homeActive, onSearch, onPrint, onPresent, nav, activeNav, onNavChange, theme, onToggleTheme }) {
  const globalActions = [
    onBack && {
      key: 'clients',
      label: 'הלקוחות שלי',
      onClick: onBack,
      icon: <svg {...svgProps}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-5.8 6.5-5.8s6.5 2.2 6.5 5.8" /><path d="M17 8.5a3 3 0 0 0 0 5" /><path d="M18.5 20c0-2.6-.9-4.4-2.3-5.4" /></svg>
    },
    onSearch && {
      key: 'search',
      label: 'חיפוש לקוח',
      onClick: onSearch,
      icon: <svg {...svgProps}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
    }
  ].filter(Boolean);

  const trailingActions = [
    onPrint && {
      key: 'report',
      label: 'דוח חודשי',
      onClick: onPrint,
      icon: <svg {...svgProps}><path d="M6 9V2h9l3 3v4M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2" /><path d="M6 14h12v8H6z" /></svg>
    },
    onPresent && {
      key: 'present',
      label: 'תמונת מצב ללקוח',
      onClick: onPresent,
      icon: <svg {...svgProps}><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" /><circle cx="12" cy="12" r="3.2" /></svg>
    }
  ].filter(Boolean);

  return (
    <div className={styles.rail}>
      <div className={styles.mark} aria-hidden="true"><Logo /></div>
      <nav className={styles.actions} aria-label="ניווט">
        {globalActions.map(a => (
          <button
            key={a.key}
            type="button"
            className={styles.railBtn + (a.key === 'clients' && homeActive ? ' ' + styles.railBtnActive : '')}
            onClick={a.onClick}
            aria-label={a.label}
            title={a.label}
            aria-current={a.key === 'clients' && homeActive ? 'page' : undefined}
          >
            {a.icon}
            <span className={styles.label}>{a.label}</span>
          </button>
        ))}

        {globalActions.length > 0 && nav && nav.length > 0 && <span className={styles.divider} aria-hidden="true" />}

        {nav && nav.map((n, i) => {
          const groupStart = i === 0 || n.group !== nav[i - 1].group;
          return [
            groupStart && i > 0 ? <span key={n.key + '-div'} className={styles.divider} aria-hidden="true" /> : null,
            <button
              key={n.key}
              type="button"
              className={styles.railBtn + (n.key === activeNav ? ' ' + styles.railBtnActive : '')}
              onClick={() => onNavChange(n.key)}
              aria-label={n.label}
              title={n.label}
              aria-current={n.key === activeNav ? 'page' : undefined}
            >
              {n.icon}
              <span className={styles.label}>{n.label}</span>
            </button>
          ];
        })}

        {nav && nav.length > 0 && trailingActions.length > 0 && <span className={styles.divider} aria-hidden="true" />}

        {trailingActions.map(a => (
          <button key={a.key} type="button" className={styles.railBtn} onClick={a.onClick} aria-label={a.label} title={a.label}>
            {a.icon}
            <span className={styles.label}>{a.label}</span>
          </button>
        ))}
      </nav>
      {onToggleTheme && (
        <button
          type="button"
          className={styles.railBtn + ' ' + styles.themeBtn}
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'עבור למצב בהיר' : 'עבור למצב כהה'}
          title={theme === 'dark' ? 'עבור למצב בהיר' : 'עבור למצב כהה'}
          aria-pressed={theme === 'dark'}
        >
          {theme === 'dark'
            ? <svg {...svgProps}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M17.7 6.3l1.4-1.4M4.9 19.1l1.4-1.4" /></svg>
            : <svg {...svgProps}><path d="M20 13.2A8.2 8.2 0 0 1 10.8 4a8.5 8.5 0 1 0 9.2 9.2z" /></svg>}
          <span className={styles.label}>{theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}</span>
        </button>
      )}
    </div>
  );
}
