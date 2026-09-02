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
import { fmt } from '../format.js';

const CYCLE_LABELS = { monthly: 'חודשי', annual: 'שנתי', weekly: 'שבועי' };
export function monthlyEquivalent(cycle, amount) {
  return { monthly: amount, annual: amount / 12, weekly: amount * 4.33 }[cycle] ?? amount;
}
const SUB_CATEGORIES = ['סטרימינג', 'מוזיקה', 'פודקאסטים', 'תוכנה', 'כלי AI', 'אחסון ענן', 'כושר', 'משחקי וידאו', 'עיתונות', 'חינוך', 'אחר'];
const INSURANCE_TYPES = ['בריאות', 'חיים', 'רכוש', 'תאונות אישיות'];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

const ICONS = {
  subs: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19" /></svg>,
  planning: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
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

  const [insForm, setInsForm] = useState({ name: '', monthly: '', type: INSURANCE_TYPES[0] });
  const [editingInsId, setEditingInsId] = useState(null);
  const [groomForm, setGroomForm] = useState({ name: '', monthly: '' });
  const [editingGroomId, setEditingGroomId] = useState(null);
  const [eventForm, setEventForm] = useState({ name: '', annual: '' });
  const [editingEventId, setEditingEventId] = useState(null);
  const [eduForm, setEduForm] = useState({ name: '', monthly: '' });
  const [editingEduId, setEditingEduId] = useState(null);
  const [annualExpForm, setAnnualExpForm] = useState({ name: '', annual: '' });
  const [editingAnnualExpId, setEditingAnnualExpId] = useState(null);

  function resetInsForm() { setInsForm({ name: '', monthly: '', type: INSURANCE_TYPES[0] }); setEditingInsId(null); }
  async function submitInsurance() {
    const monthly = parseFloat(insForm.monthly) || 0;
    if (!insForm.name.trim() || !monthly) { toast('נדרשים שם ביטוח וסכום חודשי', 'error'); return; }
    const patch = { name: insForm.name.trim(), monthly, type: insForm.type };
    const ok = editingInsId != null ? await updateItem(save, 'insurances', editingInsId, patch) : await addItem(save, 'insurances', patch);
    if (!ok) return;
    toast(editingInsId != null ? 'הביטוח עודכן' : 'ביטוח נוסף', 'success');
    resetInsForm();
  }
  function startEditInsurance(x) { setEditingInsId(x.id); setInsForm({ name: x.name || '', monthly: x.monthly || '', type: x.type || INSURANCE_TYPES[0] }); }

  function resetGroomForm() { setGroomForm({ name: '', monthly: '' }); setEditingGroomId(null); }
  async function submitGroom() {
    const monthly = parseFloat(groomForm.monthly) || 0;
    if (!groomForm.name.trim() || !monthly) { toast('נדרשים שם וסכום חודשי', 'error'); return; }
    const patch = { name: groomForm.name.trim(), monthly };
    const ok = editingGroomId != null ? await updateItem(save, 'grooming', editingGroomId, patch) : await addItem(save, 'grooming', patch);
    if (!ok) return;
    toast(editingGroomId != null ? 'הפריט עודכן' : 'פריט נוסף', 'success');
    resetGroomForm();
  }
  function startEditGroom(x) { setEditingGroomId(x.id); setGroomForm({ name: x.name || '', monthly: x.monthly || '' }); }

  function resetEventForm() { setEventForm({ name: '', annual: '' }); setEditingEventId(null); }
  async function submitEvent() {
    const annual = parseFloat(eventForm.annual) || 0;
    if (!eventForm.name.trim() || !annual) { toast('נדרשים שם ועלות שנתית', 'error'); return; }
    const patch = { name: eventForm.name.trim(), annual };
    const ok = editingEventId != null ? await updateItem(save, 'events', editingEventId, patch) : await addItem(save, 'events', patch);
    if (!ok) return;
    toast(editingEventId != null ? 'האירוע עודכן' : 'אירוע נוסף', 'success');
    resetEventForm();
  }
  function startEditEvent(x) { setEditingEventId(x.id); setEventForm({ name: x.name || '', annual: x.annual || '' }); }

  function resetEduForm() { setEduForm({ name: '', monthly: '' }); setEditingEduId(null); }
  async function submitEdu() {
    const monthly = parseFloat(eduForm.monthly) || 0;
    if (!eduForm.name.trim() || !monthly) { toast('נדרשים שם וסכום חודשי', 'error'); return; }
    const patch = { name: eduForm.name.trim(), monthly };
    const ok = editingEduId != null ? await updateItem(save, 'education', editingEduId, patch) : await addItem(save, 'education', patch);
    if (!ok) return;
    toast(editingEduId != null ? 'הפריט עודכן' : 'פריט נוסף', 'success');
    resetEduForm();
  }
  function startEditEdu(x) { setEditingEduId(x.id); setEduForm({ name: x.name || '', monthly: x.monthly || '' }); }

  function resetAnnualExpForm() { setAnnualExpForm({ name: '', annual: '' }); setEditingAnnualExpId(null); }
  async function submitAnnualExp() {
    const annual = parseFloat(annualExpForm.annual) || 0;
    if (!annualExpForm.name.trim() || !annual) { toast('נדרשים שם ועלות שנתית', 'error'); return; }
    const patch = { name: annualExpForm.name.trim(), annual };
    const ok = editingAnnualExpId != null ? await updateItem(save, 'annualExpenses', editingAnnualExpId, patch) : await addItem(save, 'annualExpenses', patch);
    if (!ok) return;
    toast(editingAnnualExpId != null ? 'ההוצאה עודכנה' : 'הוצאה נוספה', 'success');
    resetAnnualExpForm();
  }
  function startEditAnnualExp(x) { setEditingAnnualExpId(x.id); setAnnualExpForm({ name: x.name || '', annual: x.annual || '' }); }

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
  const activeSubsCount = subs.filter(x => x.active).length;
  // matches subME() in the client app: an inactive subscription contributes nothing
  const monthlySubsCost = subs.reduce((s, x) => s + (x.active ? monthlyEquivalent(x.cycle, x.amount || 0) : 0), 0);
  const subShares = subs
    .filter(s => s.active)
    .map(s => ({ name: s.name, monthly: monthlyEquivalent(s.cycle, s.amount || 0) }))
    .sort((a, b) => b.monthly - a.monthly);
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const renewingSoon = subs.filter(s => s.nextDate && new Date(s.nextDate) <= in7Days && new Date(s.nextDate) >= new Date());

  const insurances = [...(data.insurances || [])].sort((a, b) => (b.monthly || 0) - (a.monthly || 0));
  const insurancesMonthly = insurances.reduce((s, x) => s + (x.monthly || 0), 0);
  const grooming = [...(data.grooming || [])].sort((a, b) => (b.monthly || 0) - (a.monthly || 0));
  const groomingMonthly = grooming.reduce((s, x) => s + (x.monthly || 0), 0);
  const events = [...(data.events || [])].sort((a, b) => (b.annual || 0) - (a.annual || 0));
  const eventsMonthly = events.reduce((s, x) => s + (x.annual || 0) / 12, 0);
  const education = [...(data.education || [])].sort((a, b) => (b.monthly || 0) - (a.monthly || 0));
  const educationMonthly = education.reduce((s, x) => s + (x.monthly || 0), 0);
  const annualExpenses = [...(data.annualExpenses || [])].sort((a, b) => (b.annual || 0) - (a.annual || 0));
  const annualExpensesMonthly = annualExpenses.reduce((s, x) => s + (x.annual || 0) / 12, 0);

  return (
    <div>
      <div className={styles.brandHeader}>
        <div className={styles.brandHeaderLeft}>
          <span className={styles.brandIcon} aria-hidden="true">{ICONS.subs}</span>
          <div>
            <div className={styles.brandTitle}>מנויים וביטוחים</div>
            <div className={styles.brandSub}>כל ההתחייבויות הקבועות במקום אחד</div>
          </div>
        </div>
      </div>

      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>מנויים פעילים</div>
          <div className={styles.kpiValue}>{activeSubsCount}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>עלות חודשית כוללת</div>
          <div className={styles.kpiValue}>{fmt(monthlySubsCost)}</div>
        </div>
      </div>

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
      <div className={styles.sectionsGrid}>
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

      <div className={styles.section}>
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconFixed}>{ICONS.planning}</span>ביטוחים<span className={styles.countBadge}>{insurances.length}</span>{insurancesMonthly > 0 ? ` · ${fmt(insurancesMonthly)} לחודש` : ''}</div>
        {!insurances.length && <div className={styles.sectionEmpty}>אין ביטוחים רשומים</div>}
        <div className={styles.form}>
          <input className={styles.input} placeholder="שם הביטוח" aria-label="שם הביטוח" value={insForm.name} onChange={e => setInsForm({ ...insForm, name: e.target.value })} />
          <select aria-label="סוג הביטוח" className={styles.input} value={insForm.type} onChange={e => setInsForm({ ...insForm, type: e.target.value })}>
            {INSURANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className={styles.input} type="number" inputMode="decimal" placeholder="סכום חודשי" aria-label="סכום חודשי לביטוח" value={insForm.monthly} onChange={e => setInsForm({ ...insForm, monthly: e.target.value })} />
          <Button onClick={submitInsurance}>{editingInsId != null ? 'שמור' : 'הוסף ביטוח'}</Button>
          {editingInsId != null && <Button variant="ghost" onClick={resetInsForm}>ביטול</Button>}
        </div>
        {insurances.length ? (
          <div className={styles.list}>
            {insurances.map((x, i) => (
              <div key={x.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
                <div className={styles.rowMain} role="button" tabIndex={0} onClick={() => startEditInsurance(x)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEditInsurance(x))}>
                  <div>
                    <div className={styles.name}>{x.name}</div>
                    {x.type && <div className={styles.meta}>{x.type}</div>}
                  </div>
                  <div className={styles.amount}>{fmt(x.monthly || 0)}</div>
                </div>
                <DeleteButton onClick={() => removeItem(save, 'insurances', x.id)} />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconFixed}>{ICONS.planning}</span>טיפוח וקוסמטיקה<span className={styles.countBadge}>{grooming.length}</span>{groomingMonthly > 0 ? ` · ${fmt(groomingMonthly)} לחודש` : ''}</div>
        {!grooming.length && <div className={styles.sectionEmpty}>אין פריטים רשומים</div>}
        <div className={styles.form}>
          <input className={styles.input} placeholder="שם הפריט" aria-label="שם הפריט" value={groomForm.name} onChange={e => setGroomForm({ ...groomForm, name: e.target.value })} />
          <input className={styles.input} type="number" inputMode="decimal" placeholder="סכום חודשי" aria-label="סכום חודשי" value={groomForm.monthly} onChange={e => setGroomForm({ ...groomForm, monthly: e.target.value })} />
          <Button onClick={submitGroom}>{editingGroomId != null ? 'שמור' : 'הוסף'}</Button>
          {editingGroomId != null && <Button variant="ghost" onClick={resetGroomForm}>ביטול</Button>}
        </div>
        {grooming.length ? (
          <div className={styles.list}>
            {grooming.map((x, i) => (
              <div key={x.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
                <div className={styles.rowMain} role="button" tabIndex={0} onClick={() => startEditGroom(x)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEditGroom(x))}>
                  <div className={styles.name}>{x.name}</div>
                  <div className={styles.amount}>{fmt(x.monthly || 0)}</div>
                </div>
                <DeleteButton onClick={() => removeItem(save, 'grooming', x.id)} />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconFixed}>{ICONS.planning}</span>אירועים ומתנות<span className={styles.countBadge}>{events.length}</span>{eventsMonthly > 0 ? ` · ${fmt(eventsMonthly)} לחודש` : ''}</div>
        {!events.length && <div className={styles.sectionEmpty}>אין אירועים רשומים</div>}
        <div className={styles.form}>
          <input className={styles.input} placeholder="שם האירוע" aria-label="שם האירוע" value={eventForm.name} onChange={e => setEventForm({ ...eventForm, name: e.target.value })} />
          <input className={styles.input} type="number" inputMode="decimal" placeholder="עלות שנתית" aria-label="עלות שנתית" value={eventForm.annual} onChange={e => setEventForm({ ...eventForm, annual: e.target.value })} />
          <Button onClick={submitEvent}>{editingEventId != null ? 'שמור' : 'הוסף'}</Button>
          {editingEventId != null && <Button variant="ghost" onClick={resetEventForm}>ביטול</Button>}
        </div>
        {events.length ? (
          <div className={styles.list}>
            {events.map((x, i) => (
              <div key={x.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
                <div className={styles.rowMain} role="button" tabIndex={0} onClick={() => startEditEvent(x)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEditEvent(x))}>
                  <div className={styles.name}>{x.name}</div>
                  <div className={styles.amount}>{fmt(x.annual || 0)}</div>
                </div>
                <DeleteButton onClick={() => removeItem(save, 'events', x.id)} />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconFixed}>{ICONS.planning}</span>חינוך וחוגים<span className={styles.countBadge}>{education.length}</span>{educationMonthly > 0 ? ` · ${fmt(educationMonthly)} לחודש` : ''}</div>
        {!education.length && <div className={styles.sectionEmpty}>אין פריטים רשומים</div>}
        <div className={styles.form}>
          <input className={styles.input} placeholder="שם הפריט" aria-label="שם הפריט" value={eduForm.name} onChange={e => setEduForm({ ...eduForm, name: e.target.value })} />
          <input className={styles.input} type="number" inputMode="decimal" placeholder="סכום חודשי" aria-label="סכום חודשי" value={eduForm.monthly} onChange={e => setEduForm({ ...eduForm, monthly: e.target.value })} />
          <Button onClick={submitEdu}>{editingEduId != null ? 'שמור' : 'הוסף'}</Button>
          {editingEduId != null && <Button variant="ghost" onClick={resetEduForm}>ביטול</Button>}
        </div>
        {education.length ? (
          <div className={styles.list}>
            {education.map((x, i) => (
              <div key={x.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
                <div className={styles.rowMain} role="button" tabIndex={0} onClick={() => startEditEdu(x)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEditEdu(x))}>
                  <div className={styles.name}>{x.name}</div>
                  <div className={styles.amount}>{fmt(x.monthly || 0)}</div>
                </div>
                <DeleteButton onClick={() => removeItem(save, 'education', x.id)} />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconFixed}>{ICONS.planning}</span>הוצאות שנתיות<span className={styles.countBadge}>{annualExpenses.length}</span>{annualExpensesMonthly > 0 ? ` · ${fmt(annualExpensesMonthly)} לחודש` : ''}</div>
        {!annualExpenses.length && <div className={styles.sectionEmpty}>אין הוצאות רשומות</div>}
        <div className={styles.form}>
          <input className={styles.input} placeholder="שם ההוצאה" aria-label="שם ההוצאה" value={annualExpForm.name} onChange={e => setAnnualExpForm({ ...annualExpForm, name: e.target.value })} />
          <input className={styles.input} type="number" inputMode="decimal" placeholder="עלות שנתית" aria-label="עלות שנתית" value={annualExpForm.annual} onChange={e => setAnnualExpForm({ ...annualExpForm, annual: e.target.value })} />
          <Button onClick={submitAnnualExp}>{editingAnnualExpId != null ? 'שמור' : 'הוסף'}</Button>
          {editingAnnualExpId != null && <Button variant="ghost" onClick={resetAnnualExpForm}>ביטול</Button>}
        </div>
        {annualExpenses.length ? (
          <div className={styles.list}>
            {annualExpenses.map((x, i) => (
              <div key={x.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
                <div className={styles.rowMain} role="button" tabIndex={0} onClick={() => startEditAnnualExp(x)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEditAnnualExp(x))}>
                  <div className={styles.name}>{x.name}</div>
                  <div className={styles.amount}>{fmt(x.annual || 0)}</div>
                </div>
                <DeleteButton onClick={() => removeItem(save, 'annualExpenses', x.id)} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
      </div>
    </div>
  );
}
