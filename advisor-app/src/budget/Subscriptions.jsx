import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { stableColor } from '../categories.js';
import { formatDate } from './monthUtils.js';
import { toast } from '../toast.js';
import { addItem, updateItem, removeItem } from './itemHelpers.js';
import styles from './Subscriptions.module.css';

const fmt = n => '₪' + Math.ceil(n).toLocaleString('he-IL');
const CYCLE_LABELS = { monthly: 'חודשי', annual: 'שנתי', weekly: 'שבועי' };
export function monthlyEquivalent(cycle, amount) {
  return { monthly: amount, annual: amount / 12, weekly: amount * 4.33 }[cycle] ?? amount;
}
const SUB_CATEGORIES = ['סטרימינג', 'מוזיקה', 'פודקאסטים', 'תוכנה', 'כלי AI', 'אחסון ענן', 'כושר', 'משחקי וידאו', 'עיתונות', 'חינוך', 'אחר'];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

const ICONS = {
  subs: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19" /></svg>
};

export default function Subscriptions({ clientUserId, advisorId }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);

  const [subForm, setSubForm] = useState({ name: '', category: SUB_CATEGORIES[0], amount: '', cycle: 'monthly', nextDate: '' });
  const [editingSubId, setEditingSubId] = useState(null);

  function resetSubForm() { setSubForm({ name: '', category: SUB_CATEGORIES[0], amount: '', cycle: 'monthly', nextDate: '' }); setEditingSubId(null); }
  async function submitSub() {
    const amount = parseFloat(subForm.amount);
    if (!subForm.name.trim()) { toast('מה שם השירות?', 'error'); return; }
    if (!amount || amount <= 0) { toast('כמה עולה המנוי?', 'error'); return; }
    const patch = { name: subForm.name.trim(), category: subForm.category, amount, cycle: subForm.cycle, nextDate: subForm.nextDate };
    const ok = editingSubId != null ? await updateItem(save, 'subscriptions', editingSubId, patch) : await addItem(save, 'subscriptions', { ...patch, active: true });
    if (!ok) return;
    toast(editingSubId != null ? 'המנוי עודכן' : 'המנוי נוסף', 'success');
    resetSubForm();
  }
  function startEditSub(s) { setEditingSubId(s.id); setSubForm({ name: s.name || '', category: s.category || SUB_CATEGORIES[0], amount: s.amount || '', cycle: s.cycle || 'monthly', nextDate: s.nextDate || '' }); }

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return (
      <div>
        <Skeleton height="60px" radius="8px" style={{ marginBottom: 10 }} />
        <Skeleton height="60px" radius="8px" />
      </div>
    );
  }

  const subs = data.subscriptions || [];
  // matches subME() in the client app: an inactive subscription contributes nothing
  const monthlySubsCost = subs.reduce((s, x) => s + (x.active ? monthlyEquivalent(x.cycle, x.amount || 0) : 0), 0);
  const subShares = subs
    .filter(s => s.active)
    .map(s => ({ name: s.name, monthly: monthlyEquivalent(s.cycle, s.amount || 0) }))
    .sort((a, b) => b.monthly - a.monthly);
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const renewingSoon = subs.filter(s => s.nextDate && new Date(s.nextDate) <= in7Days && new Date(s.nextDate) >= new Date());

  return (
    <div>
      {renewingSoon.length > 0 && (
        <div className={styles.renewalBanner} role="status" aria-live="polite">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          {renewingSoon.map(s => `${s.name} מתחדש ב-${formatDate(s.nextDate)}`).join(' · ')}
        </div>
      )}
      {subs.length > 0 && (
        <div className={styles.statStrip}>
          <div className={styles.stat}><div className={styles.statValue}>{fmt(monthlySubsCost)}</div><div className={styles.statLabel}>לחודש במנויים</div></div>
        </div>
      )}
      <div className={styles.section}>
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconSubs}>{ICONS.subs}</span>מנויים<span className={styles.countBadge}>{subs.length}</span>{monthlySubsCost > 0 ? ` · ${fmt(monthlySubsCost)} לחודש` : ''}</div>
        {!subs.length && <div className={styles.sectionEmpty}>אין מנויים רשומים</div>}
        <div className={styles.form}>
          <input className={styles.input} placeholder="שם המנוי" aria-label="שם המנוי" value={subForm.name} onChange={e => setSubForm({ ...subForm, name: e.target.value })} />
          <select aria-label="קטגוריית המנוי" className={styles.input} value={subForm.category} onChange={e => setSubForm({ ...subForm, category: e.target.value })}>
            {SUB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className={styles.input} type="number" inputMode="decimal" placeholder="סכום" aria-label="סכום המנוי" value={subForm.amount} onChange={e => setSubForm({ ...subForm, amount: e.target.value })} />
          <select aria-label="תדירות החיוב" className={styles.input} value={subForm.cycle} onChange={e => setSubForm({ ...subForm, cycle: e.target.value })}>
            <option value="monthly">חודשי</option>
            <option value="annual">שנתי</option>
            <option value="weekly">שבועי</option>
          </select>
          <input className={styles.input} type="date" placeholder="חידוש הבא" aria-label="תאריך החידוש הבא" value={subForm.nextDate} onChange={e => setSubForm({ ...subForm, nextDate: e.target.value })} />
          <Button onClick={submitSub}>{editingSubId != null ? 'שמור' : 'הוסף מנוי'}</Button>
          {editingSubId != null && <Button variant="ghost" onClick={resetSubForm}>ביטול</Button>}
        </div>
        {subShares.length > 1 && (
          <div className={styles.miniBar}>
            {subShares.map(s => (
              <div
                key={s.name}
                className={styles.miniBarSeg}
                style={{ width: (s.monthly / monthlySubsCost * 100) + '%', background: stableColor(s.name) }}
                title={s.name}
              />
            ))}
          </div>
        )}
        {subs.length ? (
          <div className={styles.list}>
            {subs.map((s, i) => {
              const days = daysUntil(s.nextDate);
              const soon = days !== null && days >= 0 && days <= 7;
              const overdue = days !== null && days < 0;
              return (
                <div key={s.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
                  <div className={styles.rowMain} role="button" tabIndex={0} onClick={() => startEditSub(s)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEditSub(s))}>
                    <div className={styles.nameRow}>
                      {subShares.length > 1 && <span className={styles.dot} style={{ background: stableColor(s.name) }} />}
                      <div>
                        <div className={styles.name}>{s.name}{overdue && <span className={styles.overdueBadge}>באיחור</span>}{soon && <span className={styles.soonBadge}>בעוד {days === 0 ? 'היום' : days + ' ימים'}</span>}</div>
                        <div className={styles.meta}>{CYCLE_LABELS[s.cycle] || s.cycle}{s.nextDate ? ' · חידוש ' + formatDate(s.nextDate) : ''}</div>
                      </div>
                    </div>
                    <div className={styles.amount}>{fmt(s.amount || 0)}</div>
                  </div>
                  <DeleteButton onClick={() => removeItem(save, 'subscriptions', s.id)} />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
