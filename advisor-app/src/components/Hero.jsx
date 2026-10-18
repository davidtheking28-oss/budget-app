import styles from './Hero.module.css';

const isNumeric = v => typeof v === 'string' && !/[֐-׿]/.test(v);
const cls = (base, tone, v) => base + (TONE[tone] ? ' ' + TONE[tone] : '') + (isNumeric(v) ? ' ' + styles.ltr : '');

const TONE = { pos: styles.pos, neg: styles.neg, income: styles.income, expense: styles.expense, neutral: styles.neutral };

export default function Hero({ label, value, tone, note, side = [], compact = false, visual = null }) {
  const body = (
    <>
      <div className={styles.main}>
        <div className={styles.label}>{label}</div>
        <div className={cls(styles.value + (compact ? ' ' + styles.valueCompact : ''), tone, value)}>{value}</div>
        {note && <div className={styles.note}>{note}</div>}
      </div>
      {side.length > 0 && (
        <div className={styles.side}>
          {side.map(s => (
            <div key={s.label} className={styles.sideItem}>
              <div className={styles.label}>{s.label}</div>
              <div className={cls(styles.sideValue + (s.secondary ? ' ' + styles.sideValueSecondary : ''), s.tone, s.value)}>{s.value}</div>
              {s.meta && <div className={styles.sideMeta}>{s.meta}</div>}
            </div>
          ))}
        </div>
      )}
    </>
  );
  return (
    <section className={styles.hero}>
      {visual ? <><div className={styles.leftCol}>{body}</div><div className={styles.visual}>{visual}</div></> : body}
    </section>
  );
}
