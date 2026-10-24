import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import { useProspects } from '../clients/useProspects.js';
import { marketingMetrics, sumMarketing, funnelStats, leadMonthKey, percentLabel, ymKey } from './bizMath.js';
import MonthPicker, { monthName } from './MonthPicker.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { fmt } from '../format.js';
import styles from './Business.module.css';

const cost = value => (value === null ? 'אין' : fmt(value));
const count = value => (value ? value : '—');

function MarketingStats({ m, title }) {
  return (
    <div className={styles.grid4} role="group" aria-label={title}>
      <div className={styles.stat}><div className={styles.statLabel}>עלות ממוצעת לעוקב</div><div className={styles.statValue}>{cost(m.costPerFollower)}</div><div className={styles.statNote}>תקציב לעוקבים / עוקבים חדשים</div></div>
      <div className={styles.stat}><div className={styles.statLabel}>עלות לפגישת התאמה</div><div className={styles.statValue}>{cost(m.costPerMeeting)}</div><div className={styles.statNote}>Boosts / פגישות התאמה</div></div>
      <div className={styles.stat}><div className={styles.statLabel}>עלות ללקוח חדש</div><div className={styles.statValue}>{cost(m.costPerClient)}</div><div className={styles.statNote}>Boosts / סגירות</div></div>
      <div className={styles.stat}><div className={styles.statLabel}>אחוז סגירה</div><div className={styles.statValue}>{percentLabel(m.closeRate)}</div><div className={styles.statNote}>סגירות / פגישות התאמה</div></div>
    </div>
  );
}

function MarketingTable({ rows }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr><th>חודש</th><th>עוקבים</th><th>עלות לעוקב</th><th>פגישות</th><th>עלות לפגישה</th><th>סגירות</th><th>עלות ללקוח</th><th>אחוז סגירה</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td>{r.label}</td><td className={styles.num}>{count(r.m.followers)}</td><td className={styles.num}>{cost(r.m.costPerFollower)}</td>
              <td className={styles.num}>{count(r.m.meetings)}</td><td className={styles.num}>{cost(r.m.costPerMeeting)}</td>
              <td className={styles.num}>{count(r.m.closings)}</td><td className={styles.num}>{cost(r.m.costPerClient)}</td><td className={styles.num}>{percentLabel(r.m.closeRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FunnelStats({ s, title }) {
  return (
    <div className={styles.grid4} role="group" aria-label={title}>
      <div className={styles.stat}><div className={styles.statLabel}>לידים</div><div className={styles.statValue}>{s.total}</div><div className={styles.statNote}>נכנסו בתקופה</div></div>
      <div className={styles.stat}><div className={styles.statLabel}>אחוז הגעה</div><div className={styles.statValue}>{percentLabel(s.showRate)}</div><div className={styles.statNote}>{s.showed} הגיעו מתוך {s.total} לידים</div></div>
      <div className={styles.stat}><div className={styles.statLabel}>אחוז רלוונטיות</div><div className={styles.statValue}>{percentLabel(s.relevantRate)}</div><div className={styles.statNote}>{s.relevant} רלוונטיים מתוך {s.showed} שהגיעו</div></div>
      <div className={styles.stat}><div className={styles.statLabel}>אחוז סגירה</div><div className={styles.statValue}>{percentLabel(s.closeRate)}</div><div className={styles.statNote}>{s.closed} נסגרו מתוך {s.relevant} רלוונטיים</div></div>
    </div>
  );
}

function FunnelTable({ rows }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr><th>חודש</th><th>לידים</th><th>הגיעו</th><th>רלוונטיים</th><th>נסגרו</th><th>אחוז הגעה</th><th>אחוז רלוונטיות</th><th>אחוז סגירה</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td>{r.label}</td><td className={styles.num}>{count(r.s.total)}</td><td className={styles.num}>{count(r.s.showed)}</td><td className={styles.num}>{count(r.s.relevant)}</td><td className={styles.num}>{count(r.s.closed)}</td>
              <td className={styles.num}>{percentLabel(r.s.showRate)}</td><td className={styles.num}>{percentLabel(r.s.relevantRate)}</td><td className={styles.num}>{percentLabel(r.s.closeRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketingBody({ advisorId, ym, scope }) {
  const { records, loading, error, reload } = useBizRecords(advisorId, 'marketing_month');
  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;
  const byPeriod = Object.fromEntries(records.map(r => [r.period, r.data]));
  const years = scope === 'full' ? [...new Set(records.map(r => r.period.slice(0, 4)))].sort().reverse() : [String(ym.year)];
  const rows = scope === 'full'
    ? years.map(y => ({ label: y, m: sumMarketing(Array.from({ length: 12 }, (_, i) => byPeriod[ymKey(Number(y), i)] || {})) }))
    : Array.from({ length: 12 }, (_, i) => ({ label: monthName(i), m: marketingMetrics(byPeriod[ymKey(ym.year, i)] || {}) }));
  const stats = scope === 'month'
    ? marketingMetrics(byPeriod[ymKey(ym.year, ym.month)] || {})
    : sumMarketing(records.filter(r => years.includes(r.period.slice(0, 4))).map(r => r.data));
  return (
    <>
      <MarketingStats m={stats} title="מדדי שיווק" />
      <section className={styles.card}><div className={styles.cardHead}><h3 className={styles.cardTitle}>מגמות לאורך הזמן</h3></div><MarketingTable rows={rows} /></section>
    </>
  );
}

function SalesBody({ advisorId, ym, scope }) {
  const { prospects, loading, error, reload } = useProspects(advisorId);
  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;
  const rows = Array.from({ length: 12 }, (_, i) => ({ label: monthName(i), s: funnelStats(prospects.filter(p => leadMonthKey(p) === ymKey(ym.year, i))) }));
  const stats = scope === 'month' ? funnelStats(prospects.filter(p => leadMonthKey(p) === ymKey(ym.year, ym.month))) : funnelStats(prospects.filter(p => leadMonthKey(p).startsWith(String(ym.year))));
  return (
    <>
      <FunnelStats s={stats} title="מדדי מכירות" />
      <section className={styles.card}><div className={styles.cardHead}><h3 className={styles.cardTitle}>מגמות לאורך השנה</h3></div><FunnelTable rows={rows} /></section>
    </>
  );
}

export default function MetricsView({ advisorId, kind, scope }) {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const subject = kind === 'marketing' ? 'שיווק' : 'מכירות';
  const heading = scope === 'month' ? `${subject}: ${monthName(ym.month)} ${ym.year}` : scope === 'year' ? `${subject}: ${ym.year}` : `${subject}: כל התקופה`;
  return (
    <div className={styles.stack}>
      <section className={styles.bigCard}>
        <div className={styles.cardHead} style={{ marginBottom: 0 }}>
          <h3 className={styles.cardTitle}>{heading}</h3>
          {scope !== 'full' && <MonthPicker year={ym.year} month={ym.month} withMonth={scope === 'month'} onChange={(year, month) => setYm({ year, month })} />}
        </div>
      </section>
      {kind === 'marketing' ? <MarketingBody advisorId={advisorId} ym={ym} scope={scope} /> : <SalesBody advisorId={advisorId} ym={ym} scope={scope} />}
    </div>
  );
}
