import { useState } from 'react';
import DeleteButton from '../components/DeleteButton.jsx';
import { fmt } from '../format.js';
import { labelOf } from './mappingTemplates.js';
import styles from './MappingTable.module.css';

export default function MappingTable({ title, note, rows, template = [], tag, addLabel, addCats, allowCustom = false, quarterManual = false, separateRows = false, onRenameRow, onTopUp, onRemoveEntry, hidden, onHide, labelFor = labelOf, onAdd, onAmount, onDelete, onDeleteMany }) {
  const [adding, setAdding] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState([]);
  const [topUp, setTopUp] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [openList, setOpenList] = useState(null);
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const amountLabel = quarterManual ? 'סכום ל-3 חודשים' : 'סכום חודשי';
  const shown = v => (quarterManual ? Math.ceil(v) : Math.round(v));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const chosen = addCats.includes(category) ? category : addCats[0];

  const templateKeys = template.map(t => t.key);
  const groupOf = (cat, rs, line) => {
    const manualRows = rs.filter(r => r.manual && !r.auto);
    const single = rs.length === 1 && rs[0].manual && !rs[0].auto;
    return {
      auto: rs.some(r => r.auto),
      line,
      category: cat,
      amount: rs.reduce((s, r) => s + r.amount, 0),
      manual: single,
      id: single ? rs[0].id : undefined,
      desc: single ? rs[0].desc : '',
      name: single ? rs[0].name : undefined,
      raw: single ? rs[0].raw : undefined,
      entries: single ? (rs[0].entries || [rs[0].raw ?? rs[0].amount]) : undefined,
      manualIds: manualRows.map(r => r.id)
    };
  };
  const groupLines = cat => {
    const rs = rows.filter(r => r.category === cat);
    const manualRows = rs.filter(r => r.manual && !r.auto);
    if ((quarterManual && !separateRows) || manualRows.length === 0) return [groupOf(cat, rs, 'cat:' + cat)];
    const rest = rs.filter(r => !(r.manual && !r.auto));
    return [...(rest.length ? [groupOf(cat, rest, 'cat:' + cat)] : []), ...manualRows.map(m => groupOf(cat, [m], 'row:' + m.id))];
  };
  const extraKeys = [...new Set(rows.filter(r => !templateKeys.includes(r.category)).map(r => r.category))];
  const lines = [
    ...template.flatMap(t => {
      if (rows.some(r => r.category === t.key)) return groupLines(t.key);
      return hidden.includes(t.key) ? [] : [{ placeholder: true, category: t.key, line: 'tpl:' + t.key, manualIds: [] }];
    }),
    ...extraKeys.flatMap(groupLines)
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
  const shownName = r => (onRenameRow && r.manual && !r.auto ? r.name || r.desc : '') || labelFor(r.category);
  function commitTopUp(r, value) {
    setTopUp(null);
    const v = parseFloat(value);
    if (v > 0) onTopUp(r.id, v);
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
      if (!separateRows && shownNames.includes(norm(typed))) { setError('קטגוריה בשם הזה כבר קיימת'); return; }
      target = addCats.find(c => norm(c) === norm(typed) || norm(labelFor(c)) === norm(typed)) || typed;
    }
    if (!(value > 0)) return;
    onAdd(target, desc.trim(), value);
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
      <div className={styles.colHead}><span>קטגוריה</span><span>סכום חודשי</span></div>
      <div className={styles.rows}>
        {lines.length === 0 && <div className={styles.empty}>אין שורות עדיין</div>}
        {lines.map(r => (
          <div key={r.line} className={styles.row}>
            <span className={styles.name}>
              {selecting && r.manualIds.length > 0 && <input type="checkbox" className={styles.check} aria-label={'בחר שורה: ' + labelFor(r.category)} checked={r.manualIds.every(id => picked.includes(id))} onChange={() => togglePick(r.manualIds)} />}
              {renaming === r.line ? (
                <input className={styles.nameInput} autoFocus maxLength={40} aria-label="שם השורה" defaultValue={shownName(r)} onBlur={e => { setRenaming(null); const v = e.target.value.trim(); if (v !== (shownName(r))) onRenameRow(r.id, v === labelFor(r.category) ? '' : v); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') { e.currentTarget.value = shownName(r); e.currentTarget.blur(); } }} />
              ) : (
                <>
                  <span className={styles.nameText}>{shownName(r)}{!onRenameRow && r.desc ? ' · ' + r.desc : ''}</span>
                  {onTopUp && r.manual && !r.auto && r.entries && <button type="button" className={styles.countBtn} disabled={r.entries.length === 0} aria-expanded={openList === r.line} aria-label={'הצג את הסכומים שהוזנו: ' + (shownName(r))} title="הסכומים שהוזנו" onClick={() => setOpenList(o => (o === r.line ? null : r.line))}>{r.entries.length}</button>}
                  {onRenameRow && r.manual && !r.auto && <button type="button" className={styles.renameBtn} title="שינוי שם" aria-label={'שינוי שם: ' + (shownName(r))} onClick={() => setRenaming(r.line)}>✎</button>}
                </>
              )}
              {tag && templateKeys.includes(r.category) && <span className={styles.tag}>{tag}</span>}
            </span>
            {r.placeholder ? (
              <span className={styles.field}>
                <span className={styles.currency} aria-hidden="true">₪</span>
                <input key={"p:" + r.line} className={styles.input} inputMode="decimal" placeholder="0" aria-label={amountLabel + ': ' + labelFor(r.category)} defaultValue="" onBlur={e => { const v = parseFloat(e.target.value); if (v > 0) onAdd(r.category, '', v); }} />
              </span>
            ) : r.manual && !quarterManual ? (
              <span className={styles.field}>
                <span className={styles.currency} aria-hidden="true">₪</span>
                {topUp === r.line ? (
                  <input key={"t:" + r.line} className={styles.input} inputMode="decimal" autoFocus placeholder="סכום להוספה" aria-label={'הוספה לסכום: ' + labelFor(r.category)} onBlur={e => commitTopUp(r, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') { e.currentTarget.value = ''; e.currentTarget.blur(); } }} />
                ) : (
                  <>
                    <input key={"e:" + r.line + ":" + r.amount} className={styles.input} inputMode="decimal" aria-label={'סכום חודשי: ' + labelFor(r.category)} defaultValue={r.amount} onBlur={e => onAmount(r.id, e.target.value)} />
                    <button type="button" className={styles.topUp} title="הוסף סכום לשורה" aria-label={'הוסף סכום ל' + labelFor(r.category)} onClick={() => setTopUp(r.line)}>+</button>
                  </>
                )}
              </span>
            ) : (
              <span className={styles.field + ' ' + styles.fieldReadOnly} title={quarterManual && r.manualIds.length > 0 ? 'סכום שהוזן ל-3 חודשים, מחולק ב-3. לעריכה מחק את השורה והזן מחדש' : r.auto && r.category === 'משכנתא' ? 'מתעדכן ממסך המשכנתא' : r.auto ? 'נמשך אוטומטית מהלשוניות הלוואות · תשלומים · ביטוחים · שנתיות · מנויים · חינוך. כדי לעקוף, הזן סכום בשורה' : 'סכום מצטבר, לעריכה השתמש במחשבונים'}>
                <span className={styles.currency} aria-hidden="true">₪</span>
                {quarterManual && r.manual && topUp === r.line ? (
                  <input key={"t:" + r.line} className={styles.input} inputMode="decimal" autoFocus placeholder="סכום ל-3 חודשים" aria-label={'הוספה לסכום: ' + labelFor(r.category)} onBlur={e => commitTopUp(r, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') { e.currentTarget.value = ''; e.currentTarget.blur(); } }} />
                ) : (
                  <>
                    <input key={"r:" + r.line + ":" + r.amount} className={styles.input} readOnly tabIndex={-1} aria-label={'סכום חודשי: ' + labelFor(r.category)} value={shown(r.amount)} />
                    {quarterManual && r.manual && <button type="button" className={styles.topUp} title="הוסף סכום ל-3 החודשים" aria-label={'הוסף סכום ל' + labelFor(r.category)} onClick={() => setTopUp(r.line)}>+</button>}
                  </>
                )}
              </span>
            )}
            {r.placeholder ? <DeleteButton title={'הסתר שורה: ' + labelFor(r.category)} onClick={() => onHide(r.category)} /> : r.manualIds.length > 0 ? <DeleteButton title={'מחק שורה: ' + labelFor(r.category)} onClick={() => (r.manual ? onDelete(r.id) : deleteGroup(r.manualIds))} /> : <span aria-hidden="true" />}
            {openList === r.line && r.entries && (
              <ul className={styles.entryList}>
                {r.entries.map((amt, i) => (
                  <li key={i} className={styles.entryItem}>
                    <span className={styles.entryAmt}>{fmt(amt)}</span>
                    <button type="button" className={styles.renameBtn} aria-label={'מחק סכום ' + fmt(amt)} onClick={() => onRemoveEntry(r.id, i)}>✕</button>
                  </li>
                ))}
              </ul>
            )}
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
          {!(allowCustom && separateRows) && <input className={styles.addField} aria-label={onRenameRow ? "שם (לא חובה)" : "תיאור (לא חובה)"} placeholder={onRenameRow ? "שם (לא חובה)" : "תיאור (לא חובה)"} value={desc} onChange={e => setDesc(e.target.value)} />}
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
