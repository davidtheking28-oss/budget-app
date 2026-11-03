import { useState } from 'react';
import DeleteButton from '../components/DeleteButton.jsx';
import { fmt } from '../format.js';
import { labelOf } from './mappingTemplates.js';
import styles from './MappingTable.module.css';

export default function MappingTable({ title, note, rows, template = [], tag, addLabel, addCats, allowCustom = false, periodSwitch = false, hidden, onHide, labelFor = labelOf, onAdd, onAmount, onDelete, onDeleteMany }) {
  const [adding, setAdding] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState([]);
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [quarter, setQuarter] = useState(periodSwitch);
  const toMonthly = v => (quarter ? Math.ceil(v / 3) : v);
  const amountLabel = quarter ? 'סכום ל-3 חודשים' : 'סכום חודשי';
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const chosen = addCats.includes(category) ? category : addCats[0];

  const templateKeys = template.map(t => t.key);
  const group = cat => {
    const rs = rows.filter(r => r.category === cat);
    const manualRows = rs.filter(r => r.manual && !r.auto);
    const single = rs.length === 1 && rs[0].manual && !rs[0].auto;
    return {
      auto: rs.some(r => r.auto),
      line: 'cat:' + cat,
      category: cat,
      amount: rs.reduce((s, r) => s + r.amount, 0),
      manual: single,
      id: single ? rs[0].id : undefined,
      desc: single ? rs[0].desc : '',
      manualIds: manualRows.map(r => r.id)
    };
  };
  const extraKeys = [...new Set(rows.filter(r => !templateKeys.includes(r.category)).map(r => r.category))];
  const lines = [
    ...template.flatMap(t => {
      if (rows.some(r => r.category === t.key)) return [group(t.key)];
      return hidden.includes(t.key) ? [] : [{ placeholder: true, category: t.key, line: 'tpl:' + t.key, manualIds: [] }];
    }),
    ...extraKeys.map(group)
  ];
  const togglePick = ids => setPicked(prev => (ids.every(id => prev.includes(id)) ? prev.filter(x => !ids.includes(x)) : [...new Set([...prev, ...ids])]));
  function deleteGroup(ids) {
    if (ids.length > 1 && !window.confirm('למחוק את כל ' + ids.length + ' הסכומים שהוזנו בקטגוריה?')) return;
    onDeleteMany(ids);
  }
  const manualIds = rows.filter(r => r.manual && !r.auto).map(r => r.id);
  function resetTable() {
    if (!window.confirm('למחוק את כל ' + manualIds.length + ' הסכומים שהוזנו ידנית בטבלה "' + title + '"?')) return;
    onDeleteMany(manualIds);
  }
  function stopSelecting() { setSelecting(false); setPicked([]); }
  function deletePicked() { onDeleteMany(picked); stopSelecting(); }

  const norm = v => String(v).trim().replace(/\s+/g, ' ').toLowerCase();
  const shownNames = lines.flatMap(l => [norm(l.category), norm(labelFor(l.category))]);
  const suggestions = addCats.filter(c => !shownNames.includes(norm(c)) && !shownNames.includes(norm(labelFor(c))));

  function closeForm() {
    setAdding(false);
    setName('');
    setError('');
  }

  function submit(e) {
    e.preventDefault();
    const value = parseFloat(amount);
    let target = chosen;
    if (allowCustom) {
      const typed = name.trim().replace(/\s+/g, ' ');
      if (!typed) { setError('כתוב שם לקטגוריה'); return; }
      if (shownNames.includes(norm(typed))) { setError('קטגוריה בשם הזה כבר קיימת'); return; }
      target = addCats.find(c => norm(c) === norm(typed) || norm(labelFor(c)) === norm(typed)) || typed;
    }
    if (!(value > 0)) return;
    onAdd(target, desc.trim(), toMonthly(value));
    setAmount('');
    setDesc('');
    closeForm();
  }

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.total}>{fmt(total)}</span>
      </div>
      {note && <p className={styles.note}>{note}</p>}
      {periodSwitch && (
        <div className={styles.period} role="group" aria-label="תקופת ההקלדה">
          <span className={styles.note}>הקלדת סכום חדש:</span>
          <button type="button" className={styles.pillBtn + (quarter ? '' : ' ' + styles.pillBtnOn)} aria-pressed={!quarter} onClick={() => setQuarter(false)}>לחודש</button>
          <button type="button" className={styles.pillBtn + (quarter ? ' ' + styles.pillBtnOn : '')} aria-pressed={quarter} onClick={() => setQuarter(true)}>ל-3 חודשים</button>
        </div>
      )}
      {periodSwitch && quarter && <p className={styles.note}>הסכום שתקליד יחולק ב-3, והטבלה מציגה תמיד ממוצע חודשי.</p>}
      <div className={styles.colHead}><span>קטגוריה</span><span>סכום חודשי</span></div>
      <div className={styles.rows}>
        {lines.length === 0 && <div className={styles.empty}>אין שורות עדיין</div>}
        {lines.map(r => (
          <div key={r.line} className={styles.row}>
            <span className={styles.name}>
              {selecting && r.manualIds.length > 0 && <input type="checkbox" className={styles.check} aria-label={'בחר שורה: ' + labelFor(r.category)} checked={r.manualIds.every(id => picked.includes(id))} onChange={() => togglePick(r.manualIds)} />}
              {labelFor(r.category)}{r.desc ? ' · ' + r.desc : ''}
              {tag && templateKeys.includes(r.category) && <span className={styles.tag}>{tag}</span>}
            </span>
            {r.placeholder ? (
              <span className={styles.field}>
                <span className={styles.currency} aria-hidden="true">₪</span>
                <input key={"p:" + r.line} className={styles.input} inputMode="decimal" placeholder="0" aria-label={amountLabel + ': ' + labelFor(r.category)} defaultValue="" onBlur={e => { const v = parseFloat(e.target.value); if (v > 0) onAdd(r.category, '', toMonthly(v)); }} />
              </span>
            ) : r.manual ? (
              <span className={styles.field}>
                <span className={styles.currency} aria-hidden="true">₪</span>
                <input key={"e:" + r.line + ":" + r.amount} className={styles.input} inputMode="decimal" aria-label={'סכום חודשי: ' + labelFor(r.category)} defaultValue={r.amount} onBlur={e => onAmount(r.id, e.target.value)} />
              </span>
            ) : (
              <span className={styles.field + ' ' + styles.fieldReadOnly} title={r.auto && r.category === 'משכנתא' ? 'מתעדכן ממסך המשכנתא' : r.auto ? 'נמשך אוטומטית מהלשונית ביטוחים · שנתיות · מנויים · חינוך. כדי לעקוף, הזן סכום בשורה' : 'סכום מצטבר, לעריכה השתמש במחשבונים'}>
                <span className={styles.currency} aria-hidden="true">₪</span>
                <input key={"r:" + r.line + ":" + r.amount} className={styles.input} readOnly tabIndex={-1} aria-label={'סכום חודשי: ' + labelFor(r.category)} value={Math.round(r.amount)} />
              </span>
            )}
            {r.placeholder ? <DeleteButton title={'הסתר שורה: ' + labelFor(r.category)} onClick={() => onHide(r.category)} /> : r.manualIds.length > 0 ? <DeleteButton title={'מחק שורה: ' + labelFor(r.category)} onClick={() => (r.manual ? onDelete(r.id) : deleteGroup(r.manualIds))} /> : <span aria-hidden="true" />}
          </div>
        ))}
      </div>
      {adding ? (
        <form className={styles.addForm} onSubmit={submit}>
          {allowCustom ? (
            <>
              <input className={styles.addField} aria-label="שם הקטגוריה" placeholder="שם הקטגוריה" list={'cats-' + title} maxLength={40} aria-invalid={!!error} value={name} onChange={e => { setName(e.target.value); setError(''); }} />
              <datalist id={'cats-' + title}>{suggestions.map(c => <option key={c} value={labelFor(c)} />)}</datalist>
            </>
          ) : (
            <select className={styles.addField} aria-label="קטגוריה" value={chosen} onChange={e => setCategory(e.target.value)}>
              {addCats.map(c => <option key={c} value={c}>{labelFor(c)}</option>)}
            </select>
          )}
          <input className={styles.addField} aria-label="תיאור (לא חובה)" placeholder="תיאור (לא חובה)" value={desc} onChange={e => setDesc(e.target.value)} />
          <input className={styles.addField} aria-label={amountLabel} placeholder={amountLabel} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
          <button type="submit" className={styles.pillBtn + ' ' + styles.pillBtnOn}>הוסף</button>
          <button type="button" className={styles.pillBtn} onClick={closeForm}>ביטול</button>
          {error && <p className={styles.addError} role="alert">{error}</p>}
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
              <button type="button" className={styles.pillBtn} onClick={() => setSelecting(true)}>בחירה מרובה</button>
              {manualIds.length > 0 && <button type="button" className={styles.pillBtn} onClick={resetTable}>איפוס טבלה</button>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
