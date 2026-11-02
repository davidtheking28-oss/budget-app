import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import { useProspects } from '../clients/useProspects.js';
import { marketingMetrics, sumMarketing, funnelStats, monthFunnel, sumFunnel, leadMonthKey, percentLabel, periodsFor, shortLabel } from './bizMath.js';
import MonthPicker, { monthName } from './MonthPicker.jsx';
import TrendChart from './TrendChart.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { fmt } from '../format.js';
import styles from './Business.module.css';
import metrics from './MetricsView.module.css';

const cost = value => (value === null ? 'אין' : fmt(value));
const count = value => (value ? value : '—');

function MarketingStats({ m, title }) {
  return (
    <div className={styles.grid4 + ' ' + styles.summaryStats + ' ' + metrics.marketingStats} role="group" aria-label={title}>
      <div className={styles.stat}><div className={styles.statLabel}>עלות ממוצעת לעוקב</div><div className={styles.statValue}>{cost(m.costPerFollower)}</div><div className={styles.statNote}>בוסטים / עוקבים חדשים</div></div>
      <div className={styles.stat}><div className={styles.statLabel}>עלות לפגישת התאמה</div><div className={styles.statValue}>{cost(m.costPerMeeting)}</div><div className={styles.statNote}>בוסטים / פגישות התאמה</div></div>
      <div className={styles.stat}><div className={styles.statLabel}>עלות ללקוח חדש</div><div className={styles.statValue}>{cost(m.costPerClient)}</div><div className={styles.statNote}>בוסטים / סגירות</div></div>
      <div className={styles.stat}><div className={styles.statLabel}>אחוז סגירה</div><div className={styles.statValue}>{percentLabel(m.closeRate)}</div><div className={styles.statNote}>סגירות / פגישות התאמה</div></div>
    </div>
  );
}

function MarketingTable({ rows }) {
  const [showAll, setShowAll] = useState(false);
  const activeRows = rows.filter(r => [r.m.followers, r.m.boosts, r.m.budget, r.m.meetings, r.m.closings, r.f.total, r.f.meetings, r.f.showed, r.f.relevant, r.f.closed].some(value => (Number(value) || 0) !== 0));
  const visibleRows = showAll ? rows : activeRows;
  return (
    <div>
      <div className={styles.reportToolbar}>
        <span className={styles.cardSub} role="status">{activeRows.length} חודשים עם פעילות מתוך {rows.length}</span>
        {activeRows.length < rows.length && <label className={styles.toolbar}><input type="checkbox" className={styles.check} checked={showAll} onChange={e => setShowAll(e.target.checked)} />הצג גם חודשים ללא פעילות</label>}
      </div>
      {!visibleRows.length && <p className={styles.empty}>אין פעילות בתקופה שנבחרה</p>}
      <div className={styles.tableWrap + ' ' + styles.reportScroll} tabIndex={0} role="region" aria-label="פירוט חודשי — גלול לצפייה בכל העמודות">
      <table className={styles.table + ' ' + styles.reportTable + ' ' + metrics.detailTable}>
        <thead><tr><th>חודש</th><th>פגישות רלוונטיות שהתקיימו</th><th>פגישות</th><th>לידים</th><th>עוקבים שנוספו</th><th>תקציב שיווק</th><th>עלות לעוקב</th><th>עלות לפגישה</th><th>עלות לפגישה רלוונטית</th><th>עלות ללקוח</th></tr></thead>
        <tbody>
          {visibleRows.map(r => (
            <tr key={r.label}>
              <td>{r.label}</td><td className={styles.num}>{count(r.f.relevant)}</td><td className={styles.num}>{count(r.m.meetings)}</td>
              <td className={styles.num}>{count(r.f.total)}</td><td className={styles.num}>{count(r.m.followers)}</td><td className={styles.num}>{fmt(r.m.budget)}</td>
              <td className={styles.num}>{cost(r.m.costPerFollower)}</td><td className={styles.num}>{cost(r.m.costPerMeeting)}</td>
              <td className={styles.num}>{cost(r.f.relevant > 0 ? r.m.boosts / r.f.relevant : null)}</td><td className={styles.num}>{cost(r.m.costPerClient)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function FunnelStats({ s, title }) {
  return (
    <div role="group" aria-label={title}>
      <div className={metrics.funnelStages}>
        <div className={metrics.funnelStage}><div className={styles.statLabel}>לידים</div><strong>{s.total}</strong><div className={styles.statNote}>נכנסו בתקופה</div></div>
        <div className={metrics.funnelStage}><div className={styles.statLabel}>פגישות שנקבעו</div><strong>{s.meetings}</strong><div className={styles.statNote}>מתוך {s.total} לידים</div></div>
        <div className={metrics.funnelStage}><div className={styles.statLabel}>הגיעו לפגישה</div><strong>{s.showed}</strong><div className={styles.statNote}>מתוך {s.total} לידים</div></div>
        <div className={metrics.funnelStage}><div className={styles.statLabel}>פגישות רלוונטיות</div><strong>{s.relevant}</strong><div className={styles.statNote}>מתוך {s.showed} שהגיעו</div></div>
        <div className={metrics.funnelStage + ' ' + metrics.funnelResult}><div className={styles.statLabel}>נסגרו</div><strong>{s.closed}</strong><div className={styles.statNote}>מתוך {s.relevant} רלוונטיים</div></div>
      </div>
      <div className={metrics.conversionRates}>
        <div><span>אחוז הגעה</span><strong>{percentLabel(s.showRate)}</strong><span className={styles.statNote}>הגיעו / לידים</span></div>
        <div><span>אחוז רלוונטיות</span><strong>{percentLabel(s.relevantRate)}</strong><span className={styles.statNote}>רלוונטיים / הגיעו</span></div>
        <div><span>אחוז סגירה</span><strong>{percentLabel(s.closeRate)}</strong><span className={styles.statNote}>נסגרו / רלוונטיים</span></div>
      </div>
    </div>
  );
}

const funnelCount = (s, value) => (s.total + s.meetings + s.showed + s.relevant + s.closed === 0 ? 'אין' : value);

function FunnelTable({ rows, total }) {
  const [showAll, setShowAll] = useState(false);
  const activeRows = rows.filter(r => [r.s.total, r.s.meetings, r.s.showed, r.s.relevant, r.s.closed].some(value => (Number(value) || 0) !== 0));
  const visibleRows = showAll ? rows : activeRows;
  return (
    <div>
      <div className={styles.reportToolbar}>
        <span className={styles.cardSub} role="status">{activeRows.length} חודשים עם פעילות מתוך {rows.length}</span>
        {activeRows.length < rows.length && <label className={styles.toolbar}><input type="checkbox" className={styles.check} checked={showAll} onChange={e => setShowAll(e.target.checked)} />הצג גם חודשים ללא פעילות</label>}
      </div>
      {!visibleRows.length && <p className={styles.empty}>אין פעילות בתקופה שנבחרה</p>}
      <div className={styles.tableWrap + ' ' + styles.reportScroll} tabIndex={0} role="region" aria-label="פירוט חודשי — גלול לצפייה בכל העמודות">
      <table className={styles.table + ' ' + styles.reportTable + ' ' + metrics.detailTable}>
        <thead><tr><th>חודש</th><th>לידים</th><th>פגישות</th><th>הגיעו</th><th>פגישות רלוונטיות</th><th>נסגרו</th><th>אחוז הגעה</th><th>אחוז רלוונטיות</th><th>אחוז סגירה</th></tr></thead>
        <tbody>
          {visibleRows.map(r => (
            <tr key={r.label}>
              <td>{r.label}</td><td className={styles.num}>{funnelCount(r.s, r.s.total)}</td><td className={styles.num}>{funnelCount(r.s, r.s.meetings)}</td><td className={styles.num}>{funnelCount(r.s, r.s.showed)}</td><td className={styles.num}>{funnelCount(r.s, r.s.relevant)}</td><td className={styles.num}>{funnelCount(r.s, r.s.closed)}</td>
              <td className={styles.num}>{percentLabel(r.s.showRate)}</td><td className={styles.num}>{percentLabel(r.s.relevantRate)}</td><td className={styles.num}>{percentLabel(r.s.closeRate)}</td>
            </tr>
          ))}
          <tr className={styles.reportTotal}>
            <td><strong>סה״כ לתקופה</strong></td><td className={styles.num}>{funnelCount(total, total.total)}</td><td className={styles.num}>{funnelCount(total, total.meetings)}</td><td className={styles.num}>{funnelCount(total, total.showed)}</td><td className={styles.num}>{funnelCount(total, total.relevant)}</td><td className={styles.num}>{funnelCount(total, total.closed)}</td>
            <td className={styles.num}>{percentLabel(total.showRate)}</td><td className={styles.num}>{percentLabel(total.relevantRate)}</td><td className={styles.num}>{percentLabel(total.closeRate)}</td>
          </tr>
        </tbody>
      </table>
      </div>
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
  const rows = periods.map((p, i) => ({ label: scope === 'year' ? monthName(i) : monthName(Number(p.slice(5)) - 1) + ' ' + p.slice(0, 4), m: months[i], f: monthFunnel(prospects, p) }));
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
        <div className={styles.grid4 + ' ' + styles.summaryStats + ' ' + metrics.marketingStats} role="group" aria-label="סיכום שנתי">
          <div className={styles.stat}><div className={styles.statLabel}>לידים שנכנסו השנה</div><div className={styles.statValue}>{yearLeads.length}</div><div className={styles.statNote}>לפי תאריך כניסת הליד</div></div>
          <div className={styles.stat}><div className={styles.statLabel}>לקוחות שנסגרו השנה</div><div className={styles.statValue}>{funnelStats(yearLeads).closed}</div><div className={styles.statNote}>סגירות ממודול המכירות</div></div>
          <div className={styles.stat}><div className={styles.statLabel}>עוקבים שנוספו השנה</div><div className={styles.statValue}>{stats.followers}</div><div className={styles.statNote}>סכום העוקבים החדשים בכל חודש</div></div>
          <div className={styles.stat}><div className={styles.statLabel}>תקציב שיווק (סה״כ)</div><div className={styles.statValue}>{fmt(stats.budget)}</div><div className={styles.statNote}>עוקבים {fmt(stats.followersBudget)} · בוסטים {fmt(stats.boosts)}</div></div>
        </div>
      )}
      <MarketingStats m={stats} title="מדדי שיווק" />
      {scope === 'month' && (
        <>
          <div className={styles.sectionLabel}>נתוני החודש</div>
          <div className={styles.tileGrid4}>
            <button type="button" className={styles.linkTile} onClick={() => onNavigate('marketing')}><span className={styles.linkTileTitle}>נתוני עוקבים</span><span className={styles.linkTileValue}>{stats.followers}</span><span className={styles.rowMeta}>{stats.followers} החודש</span></button>
            <button type="button" className={styles.linkTile} onClick={() => onNavigate('marketing')}><span className={styles.linkTileTitle}>לידים משיווק</span><span className={styles.linkTileValue}>{stats.meetings} פגישות</span><span className={styles.rowMeta}>{stats.closings} סגירות</span></button>
            <button type="button" className={styles.linkTile} onClick={() => onNavigate('marketing')}><span className={styles.linkTileTitle}>תקציב שיווק</span><span className={styles.linkTileValue}>{fmt(stats.budget)}</span><span className={styles.rowMeta}>עוקבים ובוסטים</span></button>
            <button type="button" className={styles.linkTile} onClick={() => onNavigate('marketing-full')}><span className={styles.linkTileTitle}>כל המדדים</span><span className={styles.linkTileValue}>{chartMetrics.filter(c => c.values[c.values.length - 1] > 0).length}/{chartMetrics.length}</span><span className={styles.rowMeta}>מדדים עם נתונים החודש</span></button>
          </div>
        </>
      )}
      <TrendChart labels={periods.map(shortLabel)} metrics={chartMetrics} footnote={footnoteOf(scope, stats.followers)} />
      {scope !== 'month' && <section className={styles.card}><div className={styles.cardHead}><h3 className={styles.cardTitle}>{scope === 'year' ? 'חודשי השנה' : 'חודשי התקופה'}</h3></div><MarketingTable rows={rows} /></section>}
    </>
  );
}

function SalesBody({ advisorId, ym, scope }) {
  const { prospects, loading, error, reload } = useProspects(advisorId);
  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;
  const periods = periodsFor(scope, ym, []);
  const months = periods.map(p => monthFunnel(prospects, p));
  const stats = scope === 'month' ? months[months.length - 1] : funnelStats(prospects.filter(p => leadMonthKey(p).startsWith(String(ym.year))));
  const chartMetrics = [
    { key: 'total', label: 'לידים', values: months.map(s => s.total), format: plain },
    { key: 'meetings', label: 'פגישות', values: months.map(s => s.meetings), format: plain },
    { key: 'showed', label: 'הגיעו', values: months.map(s => s.showed), format: plain },
    { key: 'relevant', label: 'פגישות רלוונטיות', values: months.map(s => s.relevant), format: plain },
    { key: 'closed', label: 'נסגרו', values: months.map(s => s.closed), format: plain },
    { key: 'showRate', label: 'אחוז הגעה', values: months.map(s => pct(s.showRate)), format: percent },
    { key: 'relevantRate', label: 'אחוז רלוונטיות', values: months.map(s => pct(s.relevantRate)), format: percent },
    { key: 'closeRate', label: 'אחוז סגירה', values: months.map(s => pct(s.closeRate)), format: percent }
  ];
  const rows = periods.map((p, i) => ({ label: scope === 'year' ? monthName(i) : monthName(Number(p.slice(5)) - 1) + ' ' + p.slice(0, 4), s: months[i] }));
  return (
    <>
      <section className={styles.bigCard}><div className={styles.cardHead}><h3 className={styles.cardTitle}>מליד ללקוח</h3><span className={styles.cardSub}>שלבי המכירה בתקופה הנבחרת</span></div><FunnelStats s={stats} title="מדדי מכירות" /><p className={styles.note}>שורת המדדים נמדדת על הלידים שנכנסו בתקופה הנבחרת. הגרף והטבלה נספרים לפי חודש האירוע.</p></section>
      <TrendChart labels={periods.map(shortLabel)} metrics={chartMetrics} footnote={footnoteOf(scope, stats.total)} />
      <section className={styles.card}><div className={styles.cardHead}><h3 className={styles.cardTitle}>{scope === 'year' ? 'חודשי השנה' : scope === 'month' ? '12 החודשים האחרונים' : 'חודשי התקופה'}</h3></div><FunnelTable rows={rows} total={sumFunnel(months)} /><details className={metrics.calculationNote}><summary>איך מחושבים הנתונים בטבלה?</summary><p className={styles.note}>לידים נספרים לפי חודש הכניסה. פגישות, הגיעו ופגישות רלוונטיות נספרות לפי חודש הפגישה. סגירות נספרות לפי חודש הסגירה. שורת הסיכום מחשבת כל אחוז מתוך הסכומים של כל התקופה, ולא כממוצע של האחוזים החודשיים.</p></details></section>
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
      <section className={styles.card + ' ' + metrics.periodHeader}>
        <div className={styles.cardHead} style={{ marginBottom: 0 }}>
          <h3 className={styles.cardTitle}>{heading}</h3>
          {scope !== 'full' && <MonthPicker year={ym.year} month={ym.month} withMonth={scope === 'month'} onChange={(year, month) => setYm({ year, month })} />}
        </div>
      </section>
      {kind === 'marketing' ? <MarketingBody advisorId={advisorId} ym={ym} scope={scope} onNavigate={onNavigate} /> : <SalesBody advisorId={advisorId} ym={ym} scope={scope} />}
    </div>
  );
}
