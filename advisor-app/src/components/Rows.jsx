import styles from './Rows.module.css';

export function CardGrid({ single, children }) {
  return <div className={styles.grid + (single ? ' ' + styles.single : '')}>{children}</div>;
}

export function Card({ title, children }) {
  return (
    <section className={styles.card}>
      {title && <h2 className={styles.title}>{title}</h2>}
      {children}
    </section>
  );
}

export function Bar({ pct, tone }) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  return (
    <div className={styles.bar} aria-hidden="true">
      <i className={tone ? styles[tone] : undefined} style={{ width: clamped + '%' }} />
    </div>
  );
}

export function Row({ name, sub, amount, amountTone, pct, barTone, children }) {
  return (
    <div className={styles.row}>
      <div className={styles.main}>
        <div className={styles.name}>{name}</div>
        {sub && <div className={styles.sub}>{sub}</div>}
        {pct != null && <Bar pct={pct} tone={barTone} />}
      </div>
      {amount != null && <div className={styles.amount + (amountTone ? ' ' + styles[amountTone] : '')}>{amount}</div>}
      {children}
    </div>
  );
}

export function KeyValue({ label, value, ltr }) {
  return (
    <div className={styles.row}>
      <div className={styles.sub}>{label}</div>
      <div className={styles.name + (ltr ? ' ' + styles.ltr : '')}>{value}</div>
    </div>
  );
}
