import { useState } from 'react';
import { CardGrid, Card, Row } from '../components/Rows.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import EditButton from '../components/EditButton.jsx';
import { toast } from '../toast.js';
import { fmt } from '../format.js';
import { budgetCatsFor, incomeCatsFor } from '../categories.js';
import { formatDate, getMonthTx } from './monthUtils.js';
import { updateItem, removeItem } from './itemHelpers.js';
import { filterMonthTx, txPatchFromForm } from './txHelpers.js';
import styles from './MonthTransactions.module.css';

const FILTERS = [
  { key: 'all', label: 'הכול' },
  { key: 'expense', label: 'הוצאות' },
  { key: 'income', label: 'הכנסות' }
];

export default function MonthTransactions({ data, save, mode, year, month }) {
  const [filter, setFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const originals = new Map((data.transactions || []).map(t => [t.id, t]));
  const rows = filterMonthTx(getMonthTx(data.transactions, year, month), filter);

  function startEdit(id) {
    const t = originals.get(id);
    if (!t) return;
    setEditingId(id);
    setForm({ cat: t.cat || '', desc: t.desc || '', amount: String(t.amount ?? ''), date: (t.date || '').slice(0, 10) });
  }

  function cancelEdit() { setEditingId(null); setForm(null); }

  async function submitEdit() {
    const { patch, error } = txPatchFromForm(form);
    if (error) { toast(error, 'error'); return; }
    setSaving(true);
    const ok = await updateItem(save, 'transactions', editingId, patch);
    setSaving(false);
    if (!ok) return;
    toast('העסקה עודכנה', 'success');
    cancelEdit();
  }

  function catOptions(t) {
    const base = t.type === 'income' ? incomeCatsFor(mode) : budgetCatsFor(mode);
    return base.includes(form.cat) ? base : [form.cat, ...base];
  }

  return (
    <CardGrid single>
      <Card title="עסקאות החודש">
        <div className={styles.filters} role="group" aria-label="סינון עסקאות">
          {FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              className={styles.filter + (filter === f.key ? ' ' + styles.active : '')}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {rows.length === 0 && <div className={styles.empty}>אין עסקאות להצגה בחודש הזה</div>}
        {rows.map(row => {
          const t = originals.get(row.id) || row;
          if (editingId === t.id && form) {
            return (
              <div key={t.id} className={styles.editForm}>
                <select className={styles.input} aria-label="קטגוריה" value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value })}>
                  {catOptions(t).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className={styles.input} aria-label="תיאור" placeholder="תיאור" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} />
                <input className={styles.input} type="number" inputMode="decimal" aria-label="סכום" placeholder="סכום" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                <input className={styles.input} type="date" aria-label="תאריך" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                <div className={styles.formActions}>
                  <Button onClick={submitEdit} disabled={saving}>שמור</Button>
                  <Button variant="ghost" onClick={cancelEdit}>ביטול</Button>
                </div>
              </div>
            );
          }
          const isIncome = t.type === 'income';
          return (
            <Row
              key={t.id}
              name={t.desc || t.cat}
              sub={<>{row.cat} · {formatDate(t.date)}{t.recurring && <span className={styles.tag}>חוזרת</span>}</>}
              amount={(isIncome ? '+' : '') + fmt(t.amount)}
              amountTone={isIncome ? 'pos' : undefined}
            >
              <EditButton title="ערוך עסקה" onClick={() => startEdit(t.id)} />
              <DeleteButton title="מחק עסקה" onClick={() => removeItem(save, 'transactions', t.id, 'העסקה נמחקה')} />
            </Row>
          );
        })}
      </Card>
    </CardGrid>
  );
}
