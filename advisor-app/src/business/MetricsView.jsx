import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import { useProspects } from '../clients/useProspects.js';
import { marketingMetrics, sumMarketing, funnelStats, leadMonthKey, percentLabel, periodsFor, shortLabel } from './bizMath.js';
import MonthPicker, { monthName } from './MonthPicker.jsx';
import TrendChart from './TrendChart.jsx';
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
      <div className={styles.stat}><div className={styles.statLabel}>פגישות</div><div className={styles.statValue}>{s.meetings}</div><div className={styles.statNote}>לידים שנקבעה להם פגישה</div></div>
      <div className={styles.stat}><div className={styles.statLabel}>הגיעו</div><div className={styles.statValue}>{s.showed}</div><div className={styles.statNote}>הגיעו לפגישה</div></div>
      <div className={styles.stat}><div className={styles.statLabel}>פגישות רלוונטיות</div><div className={styles.statValue}>{s.relevant}</div><div className={styles.statNote}>מתוך שהגיעו</div></div>
      <div className={styles.stat}><div className={styles.statLabel}>נסגרו</div><div className={styles.statValue}>{s.closed}</div><div className={styles.statNote}>לקוחות שנסגרו</div></div>
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

const pct = rate => Math.round((rate || 0) * 100);
const plain = v => String(v);
const money = v => fmt(v);
const percent = v => v + '%';

function footnoteOf(scope, last) {
  if (scope === 'month') return '12 החודשים האחרונים · החודש: ' + last;
  if (scope === 'year') return 'חודשי השנה · סך השנה: ' + last;
  return 'כל התקופה · סך הכול: ' + last;
}

function MarketingBody({ advisorId, ym, scope, onNavigate }) {
  const { records, loading, error, reload } = useBizRecords(advisorId, 'marketing_month');
  const { prospects } = useProspects(advisorId);
  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;
  const byPeriod = Object.fromEntries(records.map(r => [r.period, r.data]));
  const periods = periodsFor(scope, ym, records);
  const months = periods.map(p => marketingMetrics(byPeriod[p] || {}));
  const stats = scope === 'month' ? months[months.length - 1] : sumMarketing(periods.map(p => byPeriod[p] || {}));
  const yearLeads = prospects.filter(p => leadMonthKey(p).startsWith(String(ym.year)));
  const rows = periods.map((p, i) => ({ label: scope === 'year' ? monthName(i) : monthName(Number(p.slice(5)) - 1) + ' ' + p.slice(0, 4), m: months[i] }));
  const chartMetrics = [
    { key: 'followers', label: 'כמות עוקבים', values: months.map(m => m.followers), format: plain },
    { key: 'costPerFollower', label: 'עלות לעוקב', values: months.map(m => Math.round(m.costPerFollower || 0)), format: money },
    { key: 'costPerMeeting', label: 'עלות לפגישת התאמה', values: months.map(m => Math.round(m.costPerMeeting || 0)), format: money },
    { key: 'costPerClient', label: 'עלות ללקוח חדש', values: months.map(m => Math.round(m.costPerClient || 0)), format: money },
    { key: 'closeRate', label: 'אחוז סגירה', values: months.map(m => pct(m.closeRate)), format: percent }
  ];
  return (
    <>
      {scope === 'year' && (
        <div className={styles.grid4} role="group" aria-label="סיכום שנתי">
          <div className={styles.stat}><div className={styles.statLabel}>לידים שנכנסו השנה</div><div className={styles.statValue}>{yearLeads.length}</div><div className={styles.statNote}>לפי תאריך כניסת הליד</div></div>
          <div className={styles.stat}><div className={styles.statLabel}>לקוחות שנסגרו השנה</div><div className={styles.statValue}>{funnelStats(yearLeads).closed}</div><div className={styles.statNote}>סגירות ממודול המכירות</div></div>
          <div className={styles.stat}><div className={styles.statLabel}>עוקבים שנוספו השנה</div><div className={styles.statValue}>{stats.followers}</div><div className={styles.statNote}>סכום העוקבים החדשים בכל חודש</div></div>
          <div className={styles.stat}><div className={styles.statLabel}>תקציב שיווק (סה״כ)</div><div className={styles.statValue}>{fmt(stats.budget)}</div><div className={styles.statNote}>עוקבים {fmt(stats.followersBudget)} · Boosts {fmt(stats.boosts)}</div></div>
        </div>
      )}
      <MarketingStats m={stats} title="מדדי שיווק" />
      {scope === 'month' && (
        <>
          <div className={styles.sectionLabel}>נתוני החודש</div>
          <div className={styles.tileGrid4}>
            <button type="button" className={styles.linkTile} onClick={() => onNavigate('marketing')}><span className={styles.linkTileTitle}>נתוני עוקבים</span><span className={styles.linkTileValue}>{stats.followers}</span><span className={styles.rowMeta}>{stats.followers} החודש</span></button>
            <button type="button" className={styles.linkTile} onClick={() => onNavigate('marketing')}><span className={styles.linkTileTitle}>לידים משיווק</span><span className={styles.linkTileValue}>{stats.meetings} פגישות</span><span className={styles.rowMeta}>{stats.closings} סגירות</span></button>
            <button type="button" className={styles.linkTile} onClick={() => onNavigate('marketing')}><span className={styles.linkTileTitle}>תקציב שיווק</span><span className={styles.linkTileValue}>{fmt(stats.budget)}</span><span className={styles.rowMeta}>עוקבים ו-Boosts</span></button>
            <button type="button" className={styles.linkTile} onClick={() => onNavigate('marketing-full')}><span className={styles.linkTileTitle}>כל המדדים</span><span className={styles.linkTileValue}>{chartMetrics.filter(c => c.values[c.values.length - 1] > 0).length}/{chartMetrics.length}</span><span className={styles.rowMeta}>מדדים עם נתונים החודש</span></button>
          </div>
        </>
      )}
      <TrendChart labels={periods.map(shortLabel)} metrics={chartMetrics} footnote={footnoteOf(scope, stats.followers)} />
      <section className={styles.card}><div className={styles.cardHead}><h3 className={styles.cardTitle}>{scope === 'year' ? 'חודשי השנה' : scope === 'month' ? '12 החודשים האחרונים' : 'חודשי התקופה'}</h3></div><MarketingTable rows={rows} /></section>
    </>
  );
}

function SalesBody({ advisorId, ym, scope }) {
  const { prospects, loading, error, reload } = useProspects(advisorId);
  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;
  const periods = periodsFor(scope, ym, []);
  const months = periods.map(p => funnelStats(prospects.filter(l => leadMonthKey(l) === p)));
  const stats = scope === 'month' ? months[months.length - 1] : funnelStats(prospects.filter(p => leadMonthKey(p).startsWith(String(ym.year))));
  const chartMetrics = [
    { key: 'total', label: 'לידים', values: months.map(s => s.total), format: plain },
    { key: 'meetings', label: 'פגישות', values: months.map(s => s.meetings), format: plain },
    { key: 'showed', label: 'הגיעו', values: months.map(s => s.showed), format: plain },
    { key: 'closed', label: 'נסגרו', values: months.map(s => s.closed), format: plain },
    { key: 'showRate', label: 'אחוז הגעה', values: months.map(s => pct(s.showRate)), format: percent },
    { key: 'relevantRate', label: 'אחוז רלוונטיות', values: months.map(s => pct(s.relevantRate)), format: percent },
    { key: 'closeRate', label: 'אחוז סגירה', values: months.map(s => pct(s.closeRate)), format: percent }
  ];
  const rows = periods.map((p, i) => ({ label: scope === 'year' ? monthName(i) : monthName(Number(p.slice(5)) - 1) + ' ' + p.slice(0, 4), s: months[i] }));
  return (
    <>
      <FunnelStats s={stats} title="מדדי מכירות" />
      <TrendChart labels={periods.map(shortLabel)} metrics={chartMetrics} footnote={footnoteOf(scope, stats.total)} />
      <section className={styles.card}><div className={styles.cardHead}><h3 className={styles.cardTitle}>{scope === 'year' ? 'חודשי השנה' : scope === 'month' ? '12 החודשים האחרונים' : 'חודשי התקופה'}</h3></div><FunnelTable rows={rows} /></section>
    </>
  );
}

export default function MetricsView({ advisorId, kind, scope, onNavigate }) {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const subject = kind === 'marketing' ? 'שיווק' : 'מכירות';
  const heading = scope === 'month' ? `${subject}: ${monthName(ym.month)} ${ym.year}` : scope === 'year' ? `${subject}: שנת ${ym.year}` : `${subject}: כל התקופה`;
  return (
    <div className={styles.stack}>
      <section className={styles.bigCard}>
        <div className={styles.cardHead} style={{ marginBottom: 0 }}>
          <h3 className={styles.cardTitle}>{heading}</h3>
          {scope !== 'full' && <MonthPicker year={ym.year} month={ym.month} withMonth={scope === 'month'} onChange={(year, month) => setYm({ year, month })} />}
        </div>
      </section>
      {kind === 'marketing' ? <MarketingBody advisorId={advisorId} ym={ym} scope={scope} onNavigate={onNavigate} /> : <SalesBody advisorId={advisorId} ym={ym} scope={scope} />}
    </div>
  );
}
