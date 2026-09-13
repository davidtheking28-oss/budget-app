import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { monthSummary, effectiveLimit } from './budgetMath.js';
import { computeInsights } from './insights.js';
import { initials } from '../clientIdentity.js';
import Logo from '../components/Logo.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { MONTH_NAMES } from './monthUtils.js';
import styles from './Report.module.css';
import { fmt } from '../format.js';

// The public counterpart of Report.jsx: no session, no Shell, no client
// context — just the RPC result rendered read-only. Kept as its own small
// component rather than folded into Report.jsx so the authenticated path
// stays untouched; the markup below intentionally mirrors it.
export default function SharedReport({ token }) {
  const [payload, setPayload] = useState(undefined); // undefined = loading, null = error
  useEffect(() => {
    let cancelled = false;
    supabase.rpc('get_shared_report', { p_token: token }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data?.found) { setPayload(null); return; }
      setPayload(data);
    });
    return () => { cancelled = true; };
  }, [token]);

  if (payload === undefined) {
    return (
      <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <Skeleton height="48px" radius="12px" style={{ marginBottom: 20 }} />
        <Skeleton height="200px" radius="14px" />
      </div>
    );
  }
  if (payload === null) {
    return <ErrorState message="הקישור לא נמצא, או שבוטל על ידי היועץ" />;
  }

  const { year, month, client_email: email, advisor_display_name: advisorName, advisor_logo_url: logoUrl, data } = payload;
  const summary = monthSummary(data, year, month);
  const insights = computeInsights(data, year, month);
  const cats = Object.keys(data.budgets || {}).filter(c => data.budgets[c]).sort();

  return (
    <div className={styles.page} dir="rtl">
      <div className={styles.printButton}>
        <Button onClick={() => window.print()}>הדפס</Button>
      </div>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {logoUrl ? <img className={styles.advisorLogo} src={logoUrl} width="26" height="26" alt="" /> : <Logo size="sm" />}
          <div>
            <h1 className={styles.title}>{advisorName ? `${advisorName} · דוח חודשי` : 'דוח חודשי'}</h1>
            <div className={styles.sub + ' ' + styles.clientRow}>
              <span className={styles.clientAvatar} aria-hidden="true">{initials(email)}</span>
              {email}
            </div>
          </div>
        </div>
        <div className={styles.sub}>{MONTH_NAMES[month]} {year}</div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.stat}><div className={styles.statLabel}>הכנסות</div><div className={styles.statValue + ' ' + styles.income}>{fmt(summary.income)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>הוצאות</div><div className={styles.statValue + ' ' + styles.expense}>{fmt(summary.expense)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>מאזן</div><div className={styles.statValue + ' ' + (summary.net < 0 ? styles.expense : styles.net)}>{fmt(summary.net)}</div></div>
      </div>

      {cats.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>תקציב מול ביצוע</h2>
          <table>
            <thead><tr><th>קטגוריה</th><th>תקציב</th><th>בפועל</th></tr></thead>
            <tbody>
              {cats.map(c => (
                <tr key={c}>
                  <td>{c}</td>
                  <td>{fmt(effectiveLimit(data, c, year, month))}</td>
                  <td>{fmt(summary.spentByCat[c] || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {insights.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>תובנות</h2>
          {insights.map((ins, i) => <div key={i} className={styles.insight}>{ins.text}</div>)}
        </>
      )}

      {(data.goals || []).length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>יעדי חיסכון</h2>
          <table>
            <thead><tr><th>יעד</th><th>נחסך</th><th>מטרה</th></tr></thead>
            <tbody>
              {data.goals.map(g => (
                <tr key={g.id}><td>{g.name}</td><td>{fmt(g.saved || 0)}</td><td>{fmt(g.target || 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
