import { useState } from 'react';
import AddForm from '../components/AddForm.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import ActionMenu from '../components/ActionMenu.jsx';
import EditButton from '../components/EditButton.jsx';
import CollapsibleSection from '../components/CollapsibleSection.jsx';
import { toast } from '../toast.js';
import { fmt } from '../format.js';
import styles from './Credit.module.css';

const EMPTY = { last4: '', company: '', billingDay: '', limit: '', fee: '', accumulated: '' };
const cardLabel = c => [c.company, c.last4 && `•••• ${c.last4}`].filter(Boolean).join(' ') || 'כרטיס';

export default function CreditCards({ settings, save }) {
  const cards = settings?.creditCards || [];
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);

  const write = next => save(cur => ({ settings: { ...(cur.settings || {}), creditCards: next(cur.settings?.creditCards || []) } }));

  function reset() { setForm(EMPTY); setEditingId(null); }

  async function submit() {
    const last4 = form.last4.replace(/\D/g, '').slice(-4);
    if (!last4 && !form.company.trim()) { toast('נדרש מספר כרטיס או חברה', 'error'); return; }
    const day = parseInt(form.billingDay) || 0;
    if (day && (day < 1 || day > 31)) { toast('יום החיוב חייב להיות בין 1 ל-31', 'error'); return; }
    const patch = {
      last4,
      company: form.company.trim(),
      billingDay: day || '',
      limit: parseFloat(form.limit) || 0,
      fee: parseFloat(form.fee) || 0,
      accumulated: parseFloat(form.accumulated) || 0
    };
    const ok = await write(list => editingId != null
      ? list.map(c => c.id === editingId ? { ...c, ...patch } : c)
      : [...list, { id: Date.now() + Math.random(), ...patch }]);
    if (!ok) return;
    toast(editingId != null ? 'הכרטיס עודכן' : 'הכרטיס נוסף', 'success');
    reset();
  }

  function startEdit(c) {
    setEditingId(c.id);
    setForm({ last4: c.last4 || '', company: c.company || '', billingDay: c.billingDay || '', limit: c.limit || '', fee: c.fee || '', accumulated: c.accumulated || '' });
  }

  async function remove(c) {
    const ok = await write(list => list.filter(x => x.id !== c.id));
    if (ok) toast(`${cardLabel(c)} נמחק`, 'success', { label: 'בטל', onClick: () => write(list => [...list, c]) });
  }

  const totalFees = cards.reduce((s, c) => s + (c.fee || 0), 0);

  return (
    <div className={styles.section}>
      <CollapsibleSection title={<>פירוט כרטיסי אשראי<span className={styles.countBadge}>{cards.length}</span>{` · דמי כרטיס ${fmt(totalFees)} לחודש`}</>}>
        {!cards.length && <div className={styles.sectionEmpty}>אין כרטיסי אשראי רשומים</div>}
        {cards.length > 0 && (
          <div className={styles.loanTableWrap} role="region" aria-label="טבלת כרטיסי אשראי, גלול לצפייה בכל השורות" tabIndex={0}>
            <table className={styles.loanTable}>
              <thead>
                <tr>
                  <th>מספר כרטיס</th>
                  <th>חברה</th>
                  <th>תאריך חיוב</th>
                  <th>מסגרת</th>
                  <th>דמי כרטיס</th>
                  <th>סל מצטבר</th>
                  <th><span className={styles.srOnly}>פעולות</span></th>
                </tr>
              </thead>
              <tbody>
                {cards.map(c => (
                  <tr key={c.id} className={styles.loanTr} onClick={() => startEdit(c)}>
                    <td>{c.last4 ? `•••• ${c.last4}` : '—'}</td>
                    <td>{c.company || '—'}</td>
                    <td>{c.billingDay || '—'}</td>
                    <td>{c.limit ? fmt(c.limit) : '—'}</td>
                    <td>{c.fee ? fmt(c.fee) : '—'}</td>
                    <td>{c.accumulated ? fmt(c.accumulated) : '—'}</td>
                    <td className={styles.loanActions}>
                      <ActionMenu><EditButton title={`ערוך · ${cardLabel(c)}`} onClick={e => { e.stopPropagation(); startEdit(c); }} /><DeleteButton title={`מחק · ${cardLabel(c)}`} onClick={e => { e.stopPropagation(); remove(c); }} /></ActionMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AddForm label="הוספת כרטיס" open={editingId != null} className={styles.form}>
          <label className={styles.formField}>מספר כרטיס, 4 ספרות אחרונות<input className={styles.input} inputMode="numeric" maxLength={4} placeholder="מספר כרטיס (4 ספרות)" aria-label="מספר כרטיס, 4 ספרות אחרונות" value={form.last4} onChange={e => setForm({ ...form, last4: e.target.value })} /></label>
          <label className={styles.formField}>חברת אשראי<input className={styles.input} placeholder="חברה" aria-label="חברת אשראי" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></label>
          <label className={styles.formField}>תאריך חיוב, יום בחודש<input className={styles.input} type="number" inputMode="numeric" placeholder="תאריך חיוב (יום בחודש)" aria-label="תאריך חיוב, יום בחודש" value={form.billingDay} onChange={e => setForm({ ...form, billingDay: e.target.value })} /></label>
          <label className={styles.formField}>מסגרת אשראי<input className={styles.input} type="number" inputMode="decimal" placeholder="מסגרת" aria-label="מסגרת אשראי" value={form.limit} onChange={e => setForm({ ...form, limit: e.target.value })} /></label>
          <label className={styles.formField}>דמי כרטיס לחודש<input className={styles.input} type="number" inputMode="decimal" placeholder="דמי כרטיס לחודש" aria-label="דמי כרטיס לחודש" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} /></label>
          <label className={styles.formField}>סל מצטבר<input className={styles.input} type="number" inputMode="decimal" placeholder="סל מצטבר" aria-label="סל מצטבר" value={form.accumulated} onChange={e => setForm({ ...form, accumulated: e.target.value })} /></label>
          <Button onClick={submit}>{editingId != null ? 'שמור' : 'הוספת כרטיס'}</Button>
          {editingId != null && <Button variant="ghost" onClick={reset}>ביטול</Button>}
        </AddForm>
      </CollapsibleSection>
    </div>
  );
}
