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

const EMPTY = { name: '', company: '', last4: '', billingDay: '', limit: '', fee: '' };

export default function CreditCards({ settings, save }) {
  const cards = settings?.creditCards || [];
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);

  const write = next => save(cur => ({ settings: { ...(cur.settings || {}), creditCards: next(cur.settings?.creditCards || []) } }));

  function reset() { setForm(EMPTY); setEditingId(null); }

  async function submit() {
    if (!form.name.trim()) { toast('נדרש שם לכרטיס', 'error'); return; }
    const day = parseInt(form.billingDay) || 0;
    if (day && (day < 1 || day > 31)) { toast('יום החיוב חייב להיות בין 1 ל-31', 'error'); return; }
    const patch = {
      name: form.name.trim(),
      company: form.company.trim(),
      last4: form.last4.replace(/\D/g, '').slice(-4),
      billingDay: day || '',
      limit: parseFloat(form.limit) || 0,
      fee: parseFloat(form.fee) || 0
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
    setForm({ name: c.name || '', company: c.company || '', last4: c.last4 || '', billingDay: c.billingDay || '', limit: c.limit || '', fee: c.fee || '' });
  }

  async function remove(c) {
    const ok = await write(list => list.filter(x => x.id !== c.id));
    if (ok) toast(`${c.name} נמחק`, 'success', { label: 'בטל', onClick: () => write(list => [...list, c]) });
  }

  const totalLimit = cards.reduce((s, c) => s + (c.limit || 0), 0);
  const totalFees = cards.reduce((s, c) => s + (c.fee || 0), 0);

  return (
    <div className={styles.section}>
      <CollapsibleSection title={<>כרטיסי אשראי<span className={styles.countBadge}>{cards.length}</span>{totalLimit > 0 ? ` · מסגרת ${fmt(totalLimit)}` : ''}</>}>
        {!cards.length && <div className={styles.sectionEmpty}>אין כרטיסי אשראי רשומים</div>}
        <AddForm label="הוסף כרטיס" open={editingId != null} className={styles.form}>
          <input className={styles.input} placeholder="שם הכרטיס" aria-label="שם הכרטיס" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className={styles.input} placeholder="חברת אשראי" aria-label="חברת אשראי" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
          <input className={styles.input} inputMode="numeric" maxLength={4} placeholder="4 ספרות אחרונות" aria-label="4 ספרות אחרונות של הכרטיס" value={form.last4} onChange={e => setForm({ ...form, last4: e.target.value })} />
          <input className={styles.input} type="number" inputMode="numeric" placeholder="יום חיוב בחודש" aria-label="יום חיוב בחודש" value={form.billingDay} onChange={e => setForm({ ...form, billingDay: e.target.value })} />
          <input className={styles.input} type="number" inputMode="decimal" placeholder="מסגרת" aria-label="מסגרת אשראי" value={form.limit} onChange={e => setForm({ ...form, limit: e.target.value })} />
          <input className={styles.input} type="number" inputMode="decimal" placeholder="דמי כרטיס לחודש" aria-label="דמי כרטיס לחודש" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} />
          <Button onClick={submit}>{editingId != null ? 'שמור' : 'הוסף כרטיס'}</Button>
          {editingId != null && <Button variant="ghost" onClick={reset}>ביטול</Button>}
        </AddForm>
        {cards.length > 0 && (
          <div className={styles.loanTableWrap} role="region" aria-label="טבלת כרטיסי אשראי, גלול לצפייה בכל השורות" tabIndex={0}>
            <table className={styles.loanTable}>
              <thead>
                <tr>
                  <th>כרטיס</th>
                  <th>חברה</th>
                  <th>מספר</th>
                  <th>יום חיוב</th>
                  <th>מסגרת</th>
                  <th>דמי כרטיס</th>
                  <th><span className={styles.srOnly}>פעולות</span></th>
                </tr>
              </thead>
              <tbody>
                {cards.map(c => (
                  <tr key={c.id} className={styles.loanTr} onClick={() => startEdit(c)}>
                    <td><div className={styles.name}>{c.name}</div></td>
                    <td>{c.company || '—'}</td>
                    <td>{c.last4 ? `•••• ${c.last4}` : '—'}</td>
                    <td>{c.billingDay || '—'}</td>
                    <td>{c.limit ? fmt(c.limit) : '—'}</td>
                    <td>{c.fee ? fmt(c.fee) : '—'}</td>
                    <td className={styles.loanActions}>
                      <ActionMenu><EditButton title={`ערוך · ${c.name}`} onClick={e => { e.stopPropagation(); startEdit(c); }} /><DeleteButton title={`מחק · ${c.name}`} onClick={e => { e.stopPropagation(); remove(c); }} /></ActionMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
              {cards.length > 1 && (
                <tfoot>
                  <tr><td colSpan={4}>סך הכול</td><td>{fmt(totalLimit)}</td><td>{totalFees ? fmt(totalFees) : '—'}</td><td /></tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
