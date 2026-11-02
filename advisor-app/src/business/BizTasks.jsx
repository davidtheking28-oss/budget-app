import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import { DEPARTMENTS, PRIORITIES, DIFFICULTIES, bucketTasks, todayIso } from './bizMath.js';
import Modal from './Modal.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { icons } from './BusinessNav.jsx';
import styles from './Business.module.css';
import layout from './BizTasks.module.css';

const RECURRENCES = ['חד פעמית', 'יומית', 'שבועית', 'חודשית'];
const SORTS = [
  { key: 'dueDate', label: 'מועד ביצוע' },
  { key: 'deadline', label: 'דדליין' },
  { key: 'priority', label: 'עדיפות' },
  { key: 'difficulty', label: 'רמת קושי' },
  { key: 'dept', label: 'מחלקה' },
  { key: 'status', label: 'סטטוס' },
  { key: 'name', label: 'שם המשימה (א׳-ב׳)' }
];
const PRIORITY_ORDER = { 'גבוהה': 0, 'בינונית': 1, 'נמוכה': 2 };
const EMPTY = { name: '', description: '', dept: 'כללי', priority: 'בינונית', dueKind: 'today', dueDate: '', deadline: '', difficulty: 'לא הוגדרה', recurrence: 'חד פעמית' };

function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return todayIso(d);
}

function hebrewDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function priorityClass(p) {
  if (p === 'גבוהה') return styles.tagHigh;
  if (p === 'בינונית') return styles.tagMid;
  return styles.tagLow;
}

function TaskModal({ today, departments, onDepartmentsChange, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY);
  const [nameError, setNameError] = useState(false);
  const [editingDepts, setEditingDepts] = useState(false);
  const [newDept, setNewDept] = useState('');
  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setNameError(true); e.currentTarget.elements.taskName.focus(); return; }
    const dueDate = form.dueKind === 'today' ? today : form.dueKind === 'tomorrow' ? addDays(today, 1) : form.dueDate;
    onSave({ name: form.name.trim(), description: form.description.trim(), dept: form.dept, priority: form.priority, dueDate, deadline: form.deadline, difficulty: form.difficulty, recurrence: form.recurrence, done: false });
  }

  function addDept() {
    const name = newDept.trim();
    if (!name || departments.includes(name)) return;
    onDepartmentsChange([...departments, name]);
    setNewDept('');
  }

  return (
    <Modal title="משימה חדשה" onClose={onClose}>
      <form className={styles.formGrid} onSubmit={submit}>
        <label className={styles.fieldLabel}>שם המשימה · חובה<input name="taskName" className={styles.input} aria-invalid={nameError} aria-describedby={nameError ? "task-name-error" : undefined} value={form.name} onChange={e => { set('name')(e); setNameError(false); }} />{nameError && <span id="task-name-error" className={styles.fieldError} role="alert">כתוב שם למשימה</span>}</label>
        <div className={styles.fieldLabel}>מועד ביצוע
          <div className={styles.segment} role="group" aria-label="מועד ביצוע">
            {[['today', 'היום'], ['tomorrow', 'מחר'], ['other', 'תאריך אחר']].map(([k, label]) => (
              <button key={k} type="button" className={form.dueKind === k ? styles.segBtnOn : styles.segBtn} aria-pressed={form.dueKind === k} onClick={() => setForm(prev => ({ ...prev, dueKind: k }))}>{label}</button>
            ))}
          </div>
          {form.dueKind === 'other' && <input className={styles.input} type="date" aria-label="תאריך ביצוע" value={form.dueDate} onChange={set('dueDate')} />}
          <span className={styles.note}>קובע אם המשימה מופיעה בהיום / מחר / השבוע</span>
        </div>
          <label className={styles.fieldLabel}>עדיפות<select className={styles.select} value={form.priority} onChange={set('priority')}>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
        <details className={styles.formDetails}>
          <summary>פרטים נוספים ותכנון</summary>
          <div className={styles.formGrid}>
        <label className={styles.fieldLabel}>תיאור<textarea className={styles.input + ' ' + styles.textarea} value={form.description} onChange={set('description')} /></label>
        <div className={styles.formRow}>
          <div className={styles.fieldLabel} style={{ gridColumn: "1 / -1" }} role="group" aria-label="מחלקה">
            <span style={{ display: 'flex', justifyContent: 'space-between' }}>מחלקה<button type="button" className={styles.linkBtn} aria-pressed={editingDepts} onClick={() => setEditingDepts(v => !v)}>הוספה / הסרה</button></span>
            <div className={styles.pills}>
              {departments.map(d => editingDepts
                ? <span key={d} className={styles.pill}>{d}{departments.length > 1 && <button type="button" className={styles.linkBtn} aria-label={'הסר מחלקה ' + d} onClick={() => { onDepartmentsChange(departments.filter(x => x !== d)); if (form.dept === d) setForm(prev => ({ ...prev, dept: departments.find(x => x !== d) })); }}>×</button>}</span>
                : <button key={d} type="button" className={form.dept === d ? styles.pillOn : styles.pill} aria-pressed={form.dept === d} onClick={() => setForm(prev => ({ ...prev, dept: d }))}>{d}</button>)}
            </div>
            {editingDepts && (
              <div className={styles.toolbar}>
                <input className={styles.input} placeholder="שם מחלקה חדשה" aria-label="שם מחלקה חדשה" value={newDept} onChange={e => setNewDept(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDept(); } }} />
                <button type="button" className={styles.btnGhost} onClick={addDept}>הוסף</button>
              </div>
            )}
          </div>
        </div>
        <label className={styles.fieldLabel}>דדליין<input className={styles.input} type="date" value={form.deadline} onChange={set('deadline')} />{!form.deadline && <span className={styles.note}>אין דדליין למשימה הזו</span>}</label>
        <label className={styles.fieldLabel}>רמת קושי
          <select className={styles.select} value={form.difficulty} onChange={set('difficulty')}>
            <option value="לא הוגדרה">לא הוגדרה</option>
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <span className={styles.note}>נפרד מעדיפות</span>
        </label>
        <div className={styles.fieldLabel}>סוג משימה
          <div className={styles.segment} role="group" aria-label="סוג משימה">
            {RECURRENCES.map(r => <button key={r} type="button" className={form.recurrence === r ? styles.segBtnOn : styles.segBtn} aria-pressed={form.recurrence === r} onClick={() => setForm(prev => ({ ...prev, recurrence: r }))}>{r}</button>)}
          </div>
        </div>
        <p className={styles.note}>תאריך ושעת היצירה נשמרים אוטומטית. אין צורך להזין אותם.</p>
          </div>
        </details>
        <div className={styles.formActions}>
          <button type="submit" className={styles.btn}>הוספה</button>
          <button type="button" className={styles.btnGhost} onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  );
}

export default function BizTasks({ advisorId }) {
  const { records, loading, error, reload, add, update, remove } = useBizRecords(advisorId, 'task');
  const deptStore = useBizRecords(advisorId, 'task_departments');
  const deptRecord = deptStore.records[0];
  const departments = deptRecord?.data?.list || DEPARTMENTS;

  function saveDepartments(list) {
    if (deptRecord) deptStore.update(deptRecord.id, { list });
    else deptStore.add({ list });
  }
  const [modal, setModal] = useState(false);
  const [filter, setFilter] = useState('today');
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [priority, setPriority] = useState('');
  const [sort, setSort] = useState('dueDate');
  const [descending, setDescending] = useState(false);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  const today = todayIso();
  const tomorrow = addDays(today, 1);
  const tasks = records.map(r => ({ id: r.id, ...r.data }));
  const buckets = bucketTasks(tasks, today);
  const open = tasks.filter(t => !t.done);
  const counts = { all: open.length, today: buckets.today.length, tomorrow: open.filter(t => t.dueDate === tomorrow).length };
  const segments = [
    { key: 'all', label: 'הכל', count: counts.all },
    { key: 'today', label: 'היום', count: counts.today },
    { key: 'tomorrow', label: 'מחר', count: counts.tomorrow },
    { key: 'dated', label: 'לפי תאריך' },
    { key: 'done', label: 'הושלמו' }
  ];

  const sortValue = t => (sort === 'priority' ? (PRIORITY_ORDER[t.priority] ?? 9) : sort === 'difficulty' ? (DIFFICULTIES.indexOf(t.difficulty) + 1 || 9) : sort === 'status' ? (t.done ? 1 : 0) : sort === 'name' || sort === 'dept' ? (t[sort] || '') : (t[sort] || '9999'));
  const visible = tasks
    .filter(t => !dept || t.dept === dept)
    .filter(t => !priority || t.priority === priority)
    .filter(t => !search.trim() || t.name.includes(search.trim()))
    .filter(t => {
      if (filter === 'done') return t.done;
      if (t.done) return false;
      if (filter === 'today') return t.dueDate === today;
      if (filter === 'tomorrow') return t.dueDate === tomorrow;
      if (filter === 'dated') return !!t.dueDate;
      return true;
    })
    .sort((a, b) => {
      const av = sortValue(a), bv = sortValue(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return descending ? -cmp : cmp;
    });

  async function save(data) {
    const row = await add(data);
    if (row) setModal(false);
  }

  return (
    <div className={styles.stack}>
      <section className={layout.overview} aria-label="סיכום משימות היום">
        <div className={layout.today}><h3 className={styles.cardTitle}>היום שלי</h3><span className={styles.rowMeta}>{hebrewDate(today)}</span></div>
        <div className={layout.metric}><span>משימות היום</span><strong>{buckets.today.length}</strong></div>
        <div className={layout.metric}><span>משימות באיחור</span><strong className={buckets.overdue.length ? styles.statNeg : undefined}>{buckets.overdue.length}</strong></div>
        <button type="button" className={styles.btn} onClick={() => setModal(true)}>+ משימה חדשה</button>
      </section>

      <div className={layout.filters}>
        <div className={layout.primaryFilters}>
        <div className={styles.segment} role="group" aria-label="סינון משימות">
          {segments.map(f => (
            <button key={f.key} type="button" className={filter === f.key ? styles.segBtnOn : styles.segBtn} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}{f.count !== undefined ? ' ' + f.count : ''}</button>
          ))}
        </div>
        <input className={styles.input + ' ' + styles.inputGrow} type="search" placeholder="חיפוש משימה..." aria-label="חיפוש משימה" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className={layout.secondaryFilters}>
        <select className={styles.select} aria-label="מחלקה" value={dept} onChange={e => setDept(e.target.value)}>
          <option value="">כל המחלקות</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className={styles.select} aria-label="עדיפות" value={priority} onChange={e => setPriority(e.target.value)}>
          <option value="">כל העדיפויות</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={styles.select} aria-label="מיון" value={sort} onChange={e => setSort(e.target.value)}>
          {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button type="button" className={styles.iconBtn} aria-label={descending ? 'מיון יורד' : 'מיון עולה'} aria-pressed={descending} onClick={() => setDescending(d => !d)}>{descending ? '↓' : '↑'}</button>
        </div>
      </div>

      <section className={styles.card + ' ' + layout.list}>
        {visible.length === 0 ? (
          <div className={layout.empty}>
            <span className={styles.iconTile} aria-hidden="true">{icons.tasks}</span>
            <div><strong>{tasks.length ? 'אין משימות בתצוגה הזו' : 'עוד אין משימות'}</strong><p>{tasks.length ? 'אפשר לשנות את התצוגה או את הסינון כדי למצוא משימות אחרות.' : 'אפשר להוסיף משימה ראשונה באמצעות הכפתור למעלה.'}</p></div>
            {tasks.length > 0 && <button type="button" className={styles.btnGhost} onClick={() => { setFilter('all'); setSearch(''); setDept(''); setPriority(''); }}>הצג את כל המשימות</button>}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table + ' ' + layout.table}>
              <thead>
                <tr><th>בוצע</th><th>שם המשימה</th><th>סטטוס</th><th>מחלקה</th><th>רמת קושי</th><th>עדיפות</th><th>דדליין</th><th>מועד ביצוע</th><th><span className={styles.srOnly}>פעולות</span></th></tr>
              </thead>
              <tbody>
                {visible.map(t => (
                  <tr key={t.id} className={t.done ? styles.rowDone : ''}>
                    <td><input type="checkbox" className={styles.check} aria-label={'סמן כבוצע: ' + t.name} checked={!!t.done} onChange={e => update(t.id, { done: e.target.checked })} /></td>
                    <td className={styles.taskName}>{t.name}{t.description ? <div className={styles.rowMeta}>{t.description}</div> : null}</td>
                    <td><span className={styles.tag}>{t.done ? 'הושלמה' : t.dueDate && t.dueDate < today ? 'באיחור' : 'פתוחה'}</span></td>
                    <td><span className={styles.tag}>{t.dept}</span></td>
                    <td>{t.difficulty || '—'}</td>
                    <td><span className={styles.tag + ' ' + priorityClass(t.priority)}>{t.priority}</span></td>
                    <td className={styles.num}>{t.deadline ? <time dateTime={t.deadline}>{hebrewDate(t.deadline)}</time> : '—'}</td>
                    <td className={styles.num}>{t.dueDate ? <time dateTime={t.dueDate}>{hebrewDate(t.dueDate)}</time> : '—'}</td>
                    <td><DeleteButton title={'מחק משימה: ' + t.name} onClick={() => remove(t.id, 'המשימה נמחקה')} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {modal && <TaskModal today={today} departments={departments} onDepartmentsChange={saveDepartments} onClose={() => setModal(false)} onSave={save} />}
    </div>
  );
}
