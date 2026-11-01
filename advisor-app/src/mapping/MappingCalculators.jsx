import { useState } from 'react';
import { fmt } from '../format.js';
import { labelOf } from './mappingTemplates.js';
import styles from './MappingCalculators.module.css';

function Calculator({ category, total, entries, onAdd, onRemove, onDelete }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const count = entries.length;

  function submit(e) {
    e.preventDefault();
    const amount = parseFloat(value);
    if (!(amount > 0)) return;
    onAdd(category, '', amount);
    setValue('');
  }

  return (
    <form className={styles.item} onSubmit={submit}>
      <div className={styles.itemHead}>
        <span className={styles.name} title={labelOf(category)}>{labelOf(category)}</span>
        <span className={styles.total}>{fmt(total)}</span>
        <button type="button" className={styles.count + ' ' + styles.countBtn} disabled={count === 0} aria-expanded={open} aria-label={'הצג את הסכומים שהוזנו: ' + labelOf(category)} title="הסכומים שהוזנו ידנית" onClick={() => setOpen(o => !o)}>{count}</button>
        {onRemove && <button type="button" className={styles.remove} aria-label={'הסר תיבה: ' + labelOf(category)} onClick={onRemove}>✕</button>}
      </div>
      <div className={styles.entry}>
        <input className={styles.input} inputMode="decimal" placeholder="סכום" aria-label={'הוספת סכום: ' + labelOf(category)} value={value} onChange={e => setValue(e.target.value)} />
        <button type="submit" className={styles.add} aria-label={'הוסף סכום: ' + labelOf(category)}>+</button>
      </div>
      {open && count > 0 && (
        <ul className={styles.entries}>
          {[...entries].reverse().map(r => (
            <li key={r.id} className={styles.entryRow}>
              <span className={styles.entryAmt}>{fmt(r.amount)}</span>
              {r.desc && <span className={styles.entryDesc}>{r.desc}</span>}
              <button type="button" className={styles.remove} aria-label={'מחק סכום ' + fmt(r.amount)} onClick={() => onDelete(r.id)}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export default function MappingCalculators({ categories, addCats, rows, hidden, extra, onAdd, onDelete, onAddBox, onRemoveBox }) {
  const [picked, setPicked] = useState('');
  const manualExtra = rows.filter(r => r.manual && !categories.includes(r.category)).map(r => r.category);
  const visibleTemplate = categories.filter(c => !hidden.includes(c) || rows.some(r => r.category === c));
  const shown = [...new Set([...visibleTemplate, ...manualExtra, ...extra])];
  const available = addCats.filter(c => !shown.includes(c));
  const chosen = available.includes(picked) ? picked : available[0];

  function addBox() {
    if (!chosen) return;
    onAddBox(chosen);
    setPicked('');
  }

  return (
    <section className={styles.card}>
      <h3 className={styles.title}>מחשבוני ההוצאות המשתנות</h3>
      <p className={styles.note}>רשום סכום בכל פעם שיש הוצאה, והוא יתווסף לסכום החודשי של הקטגוריה.</p>
      <div className={styles.grid}>
        {shown.map(c => {
          const mine = rows.filter(r => r.category === c);
          return <Calculator key={c} category={c} total={mine.reduce((s, r) => s + r.amount, 0)} entries={mine.filter(r => r.manual)} onAdd={onAdd} onDelete={onDelete} onRemove={mine.length === 0 ? () => onRemoveBox(c) : undefined} />;
        })}
      </div>
      {available.length > 0 && (
        <div className={styles.addBox}>
          <select className={styles.input} aria-label="קטגוריה לתיבה חדשה" value={chosen} onChange={e => setPicked(e.target.value)}>
            {available.map(c => <option key={c} value={c}>{labelOf(c)}</option>)}
          </select>
          <button type="button" className={styles.addBoxBtn} onClick={addBox}>+ תיבה</button>
        </div>
      )}
    </section>
  );
}
