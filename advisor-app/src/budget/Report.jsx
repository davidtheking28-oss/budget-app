import { useContext, useEffect, useState } from 'react';
import { useClientBudget, BudgetModeContext } from './useClientBudget.js';
import { monthSummary, effectiveLimit } from './budgetMath.js';
import { computeInsights } from './insights.js';
import { useAdvisorProfile } from '../auth/useAdvisorProfile.js';
import { initials } from '../clientIdentity.js';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import Logo from '../components/Logo.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { MONTH_NAMES } from './monthUtils.js';
import styles from './Report.module.css';
import { fmt } from '../format.js';

export default function Report({ clientUserId, advisorId, year, month, email, onClose }) {
  const { data, loading, error, reload } = useClientBudget(clientUserId);
  const { profile } = useAdvisorProfile(advisorId);
  const budgetMode = useContext(BudgetModeContext);
  const [shareId, setShareId] = useState(undefined); // undefined = loading, null = none active
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setShareId(undefined);
    supabase.from('report_shares').select('id')
      .eq('advisor_id', advisorId).eq('client_id', clientUserId)
      .eq('year', year).eq('month', month).is('revoked_at', null)
      .maybeSingle()
      .then(({ data: row }) => { if (!cancelled) setShareId(row?.id ?? null); });
    return () => { cancelled = true; };
  }, [advisorId, clientUserId, year, month]);

  async function createShare() {
    if (sharing) return;
    setSharing(true);
    const { data: id, error: err } = await supabase.rpc('create_report_share', {
      p_client_id: clientUserId, p_year: year, p_month: month, p_mode: budgetMode
    });
    setSharing(false);
    if (err || !id) { toast('שגיאה ביצירת הקישור', 'error'); return; }
    setShareId(id);
    const url = `${window.location.origin}${window.location.pathname}?share=${id}`;
    try { await navigator.clipboard.writeText(url); toast('הקישור הועתק', 'success'); }
    catch { toast('הקישור נוצר, אך ההעתקה נכשלה', 'info'); }
  }

  async function revokeShare() {
    if (sharing || !shareId) return;
    setSharing(true);
    const { error: err } = await supabase.rpc('revoke_report_share', { p_id: shareId });
    setSharing(false);
    if (err) { toast('שגיאה בביטול הקישור', 'error'); return; }
    setShareId(null);
    toast('הקישור בוטל', 'success');
  }

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton height="48px" radius="12px" style={{ marginBottom: 20 }} />
        <Skeleton height="200px" radius="14px" />
      </div>
    );
  }

  const summary = monthSummary(data, year, month);
  const insights = computeInsights(data, year, month);
  const cats = Object.keys(data.budgets || {}).filter(c => data.budgets[c]).sort();

  return (
    <div className={styles.page} dir="rtl">
      <div className={styles.printButton}>
        <Button onClick={() => window.print()}>הדפס</Button>
        <Button variant="ghost" className={styles.closeButton} onClick={onClose}>סגור</Button>
        {shareId === undefined ? null : shareId ? (
          <div className={styles.shareRow}>
            <button type="button" className={styles.shareLink} onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?share=${shareId}`); toast('הקישור הועתק', 'success'); }}>
              העתק קישור ללקוח
            </button>
            <Button variant="ghost" disabled={sharing} onClick={revokeShare}>בטל קישור</Button>
          </div>
        ) : (
          <Button variant="ghost" disabled={sharing} onClick={createShare}>שתף עם הלקוח</Button>
        )}
      </div>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {profile?.logo_url ? <img className={styles.advisorLogo} src={profile.logo_url} width="26" height="26" alt="" /> : <Logo size="sm" />}
          <div>
            <h1 className={styles.title}>{profile?.display_name ? `${profile.display_name} · דוח חודשי` : 'דוח חודשי'}</h1>
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
