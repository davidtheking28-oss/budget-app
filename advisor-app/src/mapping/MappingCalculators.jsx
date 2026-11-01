import { useState } from 'react';
import { fmt } from '../format.js';
import { labelOf } from './mappingTemplates.js';
import styles from './MappingCalculators.module.css';

function Calculator({ category, total, count, onAdd }) {
  const [value, setValue] = useState('');

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
        <span className={styles.count} title="מספר הסכומים שהוזנו ידנית">{count}</span>
      </div>
      <div className={styles.entry}>
        <input className={styles.input} inputMode="decimal" placeholder="סכום" aria-label={'הוספת סכום: ' + labelOf(category)} value={value} onChange={e => setValue(e.target.value)} />
        <button type="submit" className={styles.add} aria-label={'הוסף סכום: ' + labelOf(category)}>+</button>
      </div>
    </form>
  );
}

export default function MappingCalculators({ categories, addCats, rows, hidden, onAdd }) {
  const [pending, setPending] = useState([]);
  const [picked, setPicked] = useState('');
  const manualExtra = rows.filter(r => r.manual && !categories.includes(r.category)).map(r => r.category);
  const visibleTemplate = categories.filter(c => !hidden.includes(c) || rows.some(r => r.category === c));
  const shown = [...new Set([...visibleTemplate, ...manualExtra, ...pending])];
  const available = addCats.filter(c => !shown.includes(c));
  const chosen = available.includes(picked) ? picked : available[0];

  function addBox() {
    if (!chosen) return;
    setPending(prev => [...prev, chosen]);
    setPicked('');
  }

  return (
    <section className={styles.card}>
      <h3 className={styles.title}>מחשבוני ההוצאות המשתנות</h3>
      <p className={styles.note}>רשום סכום בכל פעם שיש הוצאה, והוא יתווסף לסכום החודשי של הקטגוריה.</p>
      <div className={styles.grid}>
        {shown.map(c => {
          const mine = rows.filter(r => r.category === c);
          return <Calculator key={c} category={c} total={mine.reduce((s, r) => s + r.amount, 0)} count={mine.filter(r => r.manual).length} onAdd={onAdd} />;
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
