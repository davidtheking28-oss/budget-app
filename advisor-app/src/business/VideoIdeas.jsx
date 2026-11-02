import { useRef, useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import { IDEA_POOL, IDEA_TOPICS } from './videoIdeasPool.js';
import HeaderAction from './HeaderAction.jsx';
import Modal from './Modal.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import { icons } from './BusinessNav.jsx';
import styles from './Business.module.css';
import layout from './VideoIdeas.module.css';

const STATUSES = [
  { key: 'idea', label: 'רעיון', dot: 'var(--text3)', hint: 'עוד אין כאן רעיונות. אפשר לקחת אחד מהמאגר למטה בלחיצה.' },
  { key: 'filmed', label: 'בצילום', dot: 'var(--accent)', hint: 'טיפ: מצלמים שלושה סרטונים ברצף באותו יום וחוסכים זמן כל השבוע.' },
  { key: 'published', label: 'פורסם', dot: 'var(--green)', hint: 'טיפ: סרטון שהצליח? מצלמים גרסה שנייה מזווית אחרת.' }
];

export default function VideoIdeas({ advisorId }) {
  const { records, loading, error, reload, add, update, remove } = useBizRecords(advisorId, 'video_idea');
  const [modal, setModal] = useState(false);
  const addingRef = useRef(false);
  const [adding, setAdding] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [offset, setOffset] = useState(0);
  const [poolOpen, setPoolOpen] = useState(true);
  const [visibleCount, setVisibleCount] = useState(12);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  const ideas = records.map(r => ({ id: r.id, ...r.data }));
  const taken = new Set(ideas.map(i => i.text));
  const available = IDEA_POOL.filter(p => !taken.has(p.text));
  const pool = available.filter(p => !topic || p.topic === topic);
  const daily = available.length ? available[(new Date().getDate() + offset) % available.length] : null;
  const topicCount = t => available.filter(p => p.topic === t).length;

  async function addIdea(value, ideaTopic = '') {
    if (addingRef.current) return false;
    addingRef.current = true;
    setAdding(true);
    setSaveError(false);
    try {
      const row = await add({ text: value, topic: ideaTopic, status: 'idea' });
      if (!row) setSaveError(true);
      return !!row;
    } catch {
      setSaveError(true);
      return false;
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) { toast('כתוב את הרעיון', 'error'); return; }
    if (await addIdea(text.trim())) { setText(''); setModal(false); }
  }

  return (
    <div className={styles.stack}>
      <HeaderAction><button type="button" className={styles.btn} onClick={() => setModal(true)}>+ רעיון חדש</button></HeaderAction>

      {saveError && !modal && <p className={styles.fieldError} role="alert">הרעיון לא נשמר. אפשר לנסות להוסיף אותו שוב.</p>}
      <div className={styles.grid3 + ' ' + layout.board}>
        {STATUSES.map(s => {
          const list = ideas.filter(i => i.status === s.key);
          return (
            <section key={s.key} className={styles.card + ' ' + layout.column} aria-label={s.label}>
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: s.dot, marginInlineEnd: 8 }} aria-hidden="true" />{s.label}</h3>
                <span className={styles.cardSub}>{list.length}</span>
              </div>
              {list.length === 0 ? <div className={layout.emptyColumn}>{s.hint}</div> : (
                <ul className={styles.rowList}>
                  {list.map(i => (
                    <li key={i.id} className={styles.rowItem + ' ' + layout.ideaRow}>
                      <div className={styles.rowMain}>
                        <div className={styles.rowTitle}>{i.text}</div>
                        <div className={styles.toolbar} style={{ marginTop: 6 }}>
                          <select className={styles.select} aria-label={'סטטוס: ' + i.text} value={i.status} onChange={e => update(i.id, { status: e.target.value })}>
                            {STATUSES.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                          </select>
                          {i.topic && <span className={styles.tag}>{i.topic}</span>}
                        </div>
                      </div>
                      <DeleteButton title={'מחק רעיון: ' + i.text} onClick={() => remove(i.id, 'הרעיון נמחק')} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <section className={styles.card + ' ' + layout.daily}>
        <div className={styles.toolbar}><span className={styles.cardSub}>רעיון של היום</span>{daily && <span className={styles.tag}>{daily.topic}</span>}</div>
        {daily ? (
          <>
            <h3 className={styles.cardTitle + ' ' + layout.dailyTitle}>{daily.text}</h3>
            <div className={styles.toolbar}>
              <button type="button" className={styles.btn} disabled={adding} onClick={() => addIdea(daily.text, daily.topic)}>להוסיף לרעיונות שלי +</button>
              <button type="button" className={styles.btnGhost} onClick={() => setOffset(o => o + 1)}>רעיון אחר</button>
            </div>
          </>
        ) : <div className={styles.empty}>הוספת את כל הרעיונות מהמאגר</div>}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.toolbar}>
            <span className={styles.iconTile} aria-hidden="true">{icons.bulb}</span>
            <div><h3 className={styles.cardTitle}>מאגר השראה</h3><p className={styles.cardSub}>{available.length} רעיונות מוכנים לסרטונים, לפי נושא. לוחצים על "להוסיף" והרעיון עובר ללוח שלך.</p></div>
          </div>
          <button type="button" className={styles.iconBtn} aria-expanded={poolOpen} aria-label={poolOpen ? 'כווץ את המאגר' : 'הרחב את המאגר'} onClick={() => setPoolOpen(o => !o)}>{poolOpen ? '⌃' : '⌄'}</button>
        </div>
        {poolOpen && (
          <>
            <div className={styles.pills} role="group" aria-label="נושא">
              <button type="button" className={!topic ? styles.pillOn : styles.pill} aria-pressed={!topic} onClick={() => { setTopic(''); setVisibleCount(12); }}>הכל <span className={styles.pillCount}>{available.length}</span></button>
              {IDEA_TOPICS.map(t => <button key={t} type="button" className={topic === t ? styles.pillOn : styles.pill} aria-pressed={topic === t} onClick={() => { setTopic(t); setVisibleCount(12); }}>{t} <span className={styles.pillCount}>{topicCount(t)}</span></button>)}
            </div>
            {pool.length === 0 ? <div className={styles.empty}>אין רעיונות בנושא הזה</div> : (
              <div className={layout.poolGrid}>
                {pool.slice(0, visibleCount).map(p => (
                  <div key={p.text} className={layout.poolItem}>
                    <span className={styles.rowMeta}>{p.topic}</span>
                    <span className={styles.rowTitle} style={{ flex: 1 }}>{p.text}</span>
                    <button type="button" className={styles.btnGhost} style={{ alignSelf: 'flex-start' }} disabled={adding} onClick={() => addIdea(p.text, p.topic)}>להוסיף +</button>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.reportToolbar}>
              <span className={styles.cardSub} role="status">מוצגים {Math.min(visibleCount, pool.length)} מתוך {pool.length} רעיונות</span>
              {pool.length > visibleCount && <button type="button" className={styles.btnGhost} onClick={() => setVisibleCount(count => count + 12)}>הצג עוד רעיונות</button>}
            </div>
          </>
        )}
      </section>

      {modal && (
        <Modal title="רעיון חדש" onClose={() => setModal(false)}>
          <form className={styles.formGrid} onSubmit={submit} aria-busy={adding}>
            <label className={styles.fieldLabel}>על מה הסרטון<input className={styles.input} value={text} onChange={e => setText(e.target.value)} /></label>
            {saveError && <p className={styles.fieldError} role="alert">הרעיון לא נשמר. הטקסט נשאר כאן — אפשר לנסות שוב.</p>}
            <div className={styles.formActions}>
              <button type="submit" className={styles.btn} disabled={adding}>{adding ? 'שומר…' : 'הוסף'}</button>
              <button type="button" className={styles.btnGhost} onClick={() => setModal(false)}>ביטול</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
