import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import { DEPARTMENTS, PRIORITIES, DIFFICULTIES, bucketTasks, todayIso } from './bizMath.js';
import Modal from './Modal.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import styles from './Business.module.css';

const RECURRENCES = ['חד פעמית', 'יומית', 'שבועית', 'חודשית'];
const SORTS = [
  { key: 'dueDate', label: 'מועד ביצוע' },
  { key: 'deadline', label: 'דדליין' },
  { key: 'priority', label: 'עדיפות' },
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

function TaskModal({ today, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY);
  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast('כתוב שם למשימה', 'error'); return; }
    const dueDate = form.dueKind === 'today' ? today : form.dueKind === 'tomorrow' ? addDays(today, 1) : form.dueDate;
    onSave({ name: form.name.trim(), description: form.description.trim(), dept: form.dept, priority: form.priority, dueDate, deadline: form.deadline, difficulty: form.difficulty, recurrence: form.recurrence, done: false });
  }

  return (
    <Modal title="משימה חדשה" onClose={onClose}>
      <form className={styles.formGrid} onSubmit={submit}>
        <label className={styles.fieldLabel}>שם המשימה<input className={styles.input} value={form.name} onChange={set('name')} /></label>
        <label className={styles.fieldLabel}>תיאור<textarea className={styles.input + ' ' + styles.textarea} value={form.description} onChange={set('description')} /></label>
        <div className={styles.formRow}>
          <label className={styles.fieldLabel}>מחלקה<select className={styles.select} value={form.dept} onChange={set('dept')}>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></label>
          <label className={styles.fieldLabel}>עדיפות<select className={styles.select} value={form.priority} onChange={set('priority')}>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
        </div>
        <div className={styles.fieldLabel}>מועד ביצוע
          <div className={styles.segment} role="group" aria-label="מועד ביצוע">
            {[['today', 'היום'], ['tomorrow', 'מחר'], ['other', 'תאריך אחר']].map(([k, label]) => (
              <button key={k} type="button" className={form.dueKind === k ? styles.segBtnOn : styles.segBtn} aria-pressed={form.dueKind === k} onClick={() => setForm(prev => ({ ...prev, dueKind: k }))}>{label}</button>
            ))}
          </div>
          {form.dueKind === 'other' && <input className={styles.input} type="date" aria-label="תאריך ביצוע" value={form.dueDate} onChange={set('dueDate')} />}
          <span className={styles.note}>קובע אם המשימה מופיעה בהיום / מחר / השבוע</span>
        </div>
        <label className={styles.fieldLabel}>דדליין<input className={styles.input} type="date" value={form.deadline} onChange={set('deadline')} /></label>
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
        <div className={styles.toolbar}>
          <button type="submit" className={styles.btn}>הוספה</button>
          <button type="button" className={styles.btnGhost} onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  );
}

export default function BizTasks({ advisorId }) {
  const { records, loading, error, reload, add, update, remove } = useBizRecords(advisorId, 'task');
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

  const sortValue = t => (sort === 'priority' ? (PRIORITY_ORDER[t.priority] ?? 9) : sort === 'name' ? t.name : (t[sort] || '9999'));
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
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.toolbar}>
            <span className={styles.iconTile} aria-hidden="true">✦</span>
            <div><h3 className={styles.cardTitle}>היום שלי</h3><p className={styles.cardSub}>{hebrewDate(today)}</p></div>
          </div>
          <button type="button" className={styles.btn} onClick={() => setModal(true)}>+ משימה חדשה</button>
        </div>
        <div className={styles.grid2}>
          <div className={styles.stat}>
            <div className={styles.toolbar}><span className={styles.iconTile} aria-hidden="true">✓</span><div className={styles.statLabel}>משימות היום</div><span className={styles.spacer} /><div className={styles.statValue}>{buckets.today.length}</div></div>
            <div className={styles.statNote}>{buckets.today.length ? 'מה שמתוכנן להיום' : 'אין משימות להיום'}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.toolbar}><span className={styles.iconTile} aria-hidden="true">!</span><div className={styles.statLabel}>משימות באיחור</div><span className={styles.spacer} /><div className={styles.statValue + (buckets.overdue.length ? ' ' + styles.statNeg : '')}>{buckets.overdue.length}</div></div>
            <div className={styles.statNote}>{buckets.overdue.length ? 'עברו את מועד הביצוע' : 'אין משימות באיחור'}</div>
          </div>
        </div>
      </section>

      <div className={styles.toolbar}>
        <div className={styles.segment} role="group" aria-label="סינון משימות">
          {segments.map(f => (
            <button key={f.key} type="button" className={filter === f.key ? styles.segBtnOn : styles.segBtn} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}{f.count !== undefined ? ' ' + f.count : ''}</button>
          ))}
        </div>
        <input className={styles.input + ' ' + styles.inputGrow} type="search" placeholder="חיפוש משימה..." aria-label="חיפוש משימה" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.select} aria-label="מחלקה" value={dept} onChange={e => setDept(e.target.value)}>
          <option value="">כל המחלקות</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
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

      <section className={styles.card}>
        {visible.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.iconTile} aria-hidden="true">✓</span>
            <span>אין משימות בתצוגה הזו</span>
            <button type="button" className={styles.btn} onClick={() => setModal(true)}>+ הוסף משימה</button>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>בוצע</th><th>שם המשימה</th><th>סטטוס</th><th>מחלקה</th><th>רמת קושי</th><th>עדיפות</th><th>דדליין</th><th>מועד ביצוע</th><th /></tr>
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
                    <td className={styles.num}>{t.deadline || '—'}</td>
                    <td className={styles.num}>{t.dueDate || '—'}</td>
                    <td><DeleteButton title={'מחק משימה: ' + t.name} onClick={() => remove(t.id, 'המשימה נמחקה')} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {modal && <TaskModal today={today} onClose={() => setModal(false)} onSave={save} />}
    </div>
  );
}
