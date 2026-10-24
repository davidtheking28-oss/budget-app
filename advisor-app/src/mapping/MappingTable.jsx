import { useState } from 'react';
import DeleteButton from '../components/DeleteButton.jsx';
import { fmt } from '../format.js';
import styles from './MappingTable.module.css';

export default function MappingTable({ title, note, rows, addLabel, addCats, onAdd, onAmount, onDelete, onDeleteMany }) {
  const [adding, setAdding] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState([]);
  const [category, setCategory] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const chosen = addCats.includes(category) ? category : addCats[0];

  const manualCount = rows.filter(r => r.manual).length;
  const togglePick = id => setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  function stopSelecting() { setSelecting(false); setPicked([]); }
  function deletePicked() { onDeleteMany(picked); stopSelecting(); }

  function submit(e) {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!(value > 0)) return;
    onAdd(chosen, desc.trim(), value);
    setAmount('');
    setDesc('');
    setAdding(false);
  }

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.total}>{fmt(total)}</span>
      </div>
      {note && <p className={styles.note}>{note}</p>}
      <div className={styles.colHead}><span>קטגוריה</span><span>סכום חודשי</span></div>
      <div className={styles.rows}>
        {rows.length === 0 && <div className={styles.empty}>אין שורות עדיין</div>}
        {rows.map(r => (
          <div key={r.key} className={styles.row}>
            <span className={styles.name}>
              {selecting && r.manual && <input type="checkbox" className={styles.check} aria-label={'בחר שורה: ' + r.category} checked={picked.includes(r.id)} onChange={() => togglePick(r.id)} />}
              {r.category}{r.desc ? ' · ' + r.desc : ''}
              {!r.manual && <span className={styles.tag}>מדפי חשבון</span>}
            </span>
            {r.manual ? (
              <span className={styles.field}>
                <span className={styles.currency} aria-hidden="true">₪</span>
                <input className={styles.input} inputMode="decimal" aria-label={'סכום חודשי: ' + r.category} defaultValue={r.amount} onBlur={e => onAmount(r.id, e.target.value)} />
              </span>
            ) : (
              <span className={styles.readonly}>{fmt(r.amount)}</span>
            )}
            {r.manual ? <DeleteButton title={'מחק שורה: ' + r.category} onClick={() => onDelete(r.id)} /> : <span aria-hidden="true" />}
          </div>
        ))}
      </div>
      {adding ? (
        <form className={styles.addForm} onSubmit={submit}>
          <select className={styles.addField} aria-label="קטגוריה" value={chosen} onChange={e => setCategory(e.target.value)}>
            {addCats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className={styles.addField} aria-label="תיאור (לא חובה)" placeholder="תיאור (לא חובה)" value={desc} onChange={e => setDesc(e.target.value)} />
          <input className={styles.addField} aria-label="סכום חודשי" placeholder="סכום חודשי" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
          <button type="submit" className={styles.pillBtn + ' ' + styles.pillBtnOn}>הוסף</button>
          <button type="button" className={styles.pillBtn} onClick={() => setAdding(false)}>ביטול</button>
        </form>
      ) : (
        <div className={styles.foot}>
          {selecting ? (
            <>
              <button type="button" className={styles.pillBtn + ' ' + styles.pillBtnOn} disabled={picked.length === 0} onClick={deletePicked}>מחק נבחרות ({picked.length})</button>
              <button type="button" className={styles.pillBtn} onClick={stopSelecting}>ביטול</button>
            </>
          ) : (
            <>
              <button type="button" className={styles.pillBtn + ' ' + styles.pillBtnOn} onClick={() => setAdding(true)}>+ {addLabel}</button>
              {manualCount > 1 && <button type="button" className={styles.pillBtn} onClick={() => setSelecting(true)}>בחירה מרובה</button>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
