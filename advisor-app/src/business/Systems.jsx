import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import Modal from './Modal.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import HeaderAction from './HeaderAction.jsx';
import { icons } from './BusinessNav.jsx';
import styles from './Business.module.css';

const SYSTEM_DEPARTMENTS = [
  { key: 'שירות', icon: icons.headset },
  { key: 'שיווק', icon: icons.megaphone },
  { key: 'מכירות', icon: icons.chart },
  { key: 'פיננסים', icon: icons.coins },
  { key: 'ניהול', icon: icons.briefcase }
];

export default function Systems({ advisorId }) {
  const { records, loading, error, reload, add, update, remove } = useBizRecords(advisorId, 'system');
  const [dept, setDept] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', dept: SYSTEM_DEPARTMENTS[0].key, notes: '' });

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="200px" radius="18px" />;

  const systems = records.map(r => ({ id: r.id, ...r.data }));
  const countOf = d => systems.filter(s => s.dept === d).length;
  const visible = systems.filter(s => !dept || s.dept === dept).filter(s => !search.trim() || s.name.includes(search.trim()));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast('כתוב שם לסיסטם', 'error'); return; }
    const row = await add({ name: form.name.trim(), dept: form.dept, notes: form.notes.trim() });
    if (!row) return;
    setForm({ name: '', dept: form.dept, notes: '' });
    setModal(false);
  }

  return (
    <div className={styles.stack}>
      <HeaderAction targetId="biz-header-sub" fallback={false}><p className={styles.headSub}>{records.length} סיסטמים</p></HeaderAction>
      <section className={styles.card}>
        <div className={styles.grid3}>
          {SYSTEM_DEPARTMENTS.map(d => (
            <button key={d.key} type="button" className={styles.stat} style={{ cursor: 'pointer', textAlign: 'start', borderColor: dept === d.key ? 'var(--accent)' : undefined }} aria-pressed={dept === d.key} onClick={() => setDept(dept === d.key ? '' : d.key)}>
              <div className={styles.toolbar}>
                <span className={styles.iconTile} aria-hidden="true">{d.icon}</span>
                <div><div className={styles.rowTitle}>{d.key}</div><div className={styles.statNote}>{countOf(d.key)} סיסטמים</div></div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className={styles.toolbar}>
        <button type="button" className={styles.btn} onClick={() => setModal(true)}>+ הוסף סיסטם</button>
      </div>

      <div className={styles.cardHead} style={{ marginBottom: 0 }}>
        <h3 className={styles.cardTitle}>{dept ? `סיסטמים: ${dept}` : 'כל הסיסטמים'}</h3>
        <input className={styles.input} type="search" placeholder="חיפוש בסיסטמים..." aria-label="חיפוש בסיסטמים" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <section className={styles.card}>
        {visible.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.iconTile} aria-hidden="true">{icons.nodes}</span>
            <span>אין סיסטמים כאן עדיין</span>
            <span className={styles.cardSub}>כל תהליך שחוזר על עצמו בעסק שווה סיסטם</span>
          </div>
        ) : (
          <ul className={styles.rowList}>
            {visible.map(s => (
              <li key={s.id} className={styles.rowItem}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle}>{s.name} <span className={styles.tag}>{s.dept}</span></div>
                  <textarea className={styles.input + ' ' + styles.textarea} style={{ width: '100%', marginTop: 8 }} aria-label={'תיאור: ' + s.name} defaultValue={s.notes} onBlur={e => { if (e.target.value !== (s.notes || '')) update(s.id, { notes: e.target.value }); }} />
                </div>
                <DeleteButton title={'מחק סיסטם: ' + s.name} onClick={() => remove(s.id, 'הסיסטם נמחק')} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {modal && (
        <Modal title="סיסטם חדש" onClose={() => setModal(false)}>
          <form className={styles.formGrid} onSubmit={submit}>
            <label className={styles.fieldLabel}>שם הסיסטם<input className={styles.input} value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} /></label>
            <label className={styles.fieldLabel}>מחלקה<select className={styles.select} value={form.dept} onChange={e => setForm(prev => ({ ...prev, dept: e.target.value }))}>{SYSTEM_DEPARTMENTS.map(d => <option key={d.key} value={d.key}>{d.key}</option>)}</select></label>
            <label className={styles.fieldLabel}>איך זה עובד, צעד אחר צעד<textarea className={styles.input + ' ' + styles.textarea} value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} /></label>
            <div className={styles.toolbar}>
              <button type="submit" className={styles.btn}>שמור</button>
              <button type="button" className={styles.btnGhost} onClick={() => setModal(false)}>ביטול</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
