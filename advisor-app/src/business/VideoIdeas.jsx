import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import { IDEA_POOL, IDEA_TOPICS } from './videoIdeasPool.js';
import HeaderAction from './HeaderAction.jsx';
import Modal from './Modal.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import styles from './Business.module.css';

const STATUSES = [
  { key: 'idea', label: 'רעיון', dot: 'var(--text3)', hint: 'עוד אין כאן רעיונות. אפשר לקחת אחד מהמאגר למטה בלחיצה.' },
  { key: 'filmed', label: 'בצילום', dot: 'var(--accent)', hint: 'טיפ: מצלמים שלושה סרטונים ברצף באותו יום וחוסכים זמן כל השבוע.' },
  { key: 'published', label: 'פורסם', dot: 'var(--green)', hint: 'טיפ: סרטון שהצליח? מצלמים גרסה שנייה מזווית אחרת.' }
];

export default function VideoIdeas({ advisorId }) {
  const { records, loading, error, reload, add, update, remove } = useBizRecords(advisorId, 'video_idea');
  const [modal, setModal] = useState(false);
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [offset, setOffset] = useState(0);
  const [poolOpen, setPoolOpen] = useState(true);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  const ideas = records.map(r => ({ id: r.id, ...r.data }));
  const taken = new Set(ideas.map(i => i.text));
  const available = IDEA_POOL.filter(p => !taken.has(p.text));
  const pool = available.filter(p => !topic || p.topic === topic);
  const daily = available.length ? available[(new Date().getDate() + offset) % available.length] : null;
  const topicCount = t => available.filter(p => p.topic === t).length;

  async function addIdea(value, ideaTopic = '') {
    const row = await add({ text: value, topic: ideaTopic, status: 'idea' });
    return !!row;
  }

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) { toast('כתוב את הרעיון', 'error'); return; }
    if (await addIdea(text.trim())) { setText(''); setModal(false); }
  }

  return (
    <div className={styles.stack}>
      <HeaderAction><button type="button" className={styles.btn} onClick={() => setModal(true)}>+ רעיון חדש</button></HeaderAction>

      <section className={styles.bigCard} style={{ background: 'linear-gradient(135deg, rgba(var(--accent-rgb), 0.08), var(--surface) 55%)' }}>
        <div className={styles.toolbar}><span className={styles.cardSub}>רעיון של היום</span>{daily && <span className={styles.tag}>{daily.topic}</span>}</div>
        {daily ? (
          <>
            <h3 className={styles.cardTitle} style={{ fontSize: 'var(--text-xl, 1.5rem)', margin: '18px 0 26px' }}>{daily.text}</h3>
            <div className={styles.toolbar}>
              <button type="button" className={styles.btn} onClick={() => addIdea(daily.text, daily.topic)}>להוסיף לרעיונות שלי +</button>
              <button type="button" className={styles.btnGhost} onClick={() => setOffset(o => o + 1)}>רעיון אחר</button>
            </div>
          </>
        ) : <div className={styles.empty}>הוספת את כל הרעיונות מהמאגר</div>}
      </section>

      <div className={styles.grid3}>
        {STATUSES.map(s => {
          const list = ideas.filter(i => i.status === s.key);
          return (
            <section key={s.key} className={styles.card}>
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: s.dot, marginInlineEnd: 8 }} aria-hidden="true" />{s.label}</h3>
                <span className={styles.cardSub}>{list.length}</span>
              </div>
              {list.length === 0 ? <div className={styles.hintBox}>{s.hint}</div> : (
                <ul className={styles.rowList}>
                  {list.map(i => (
                    <li key={i.id} className={styles.rowItem}>
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

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.toolbar}>
            <span className={styles.iconTile} aria-hidden="true">✦</span>
            <div><h3 className={styles.cardTitle}>מאגר השראה</h3><p className={styles.cardSub}>{available.length} רעיונות מוכנים לסרטונים, לפי נושא. לוחצים על "להוסיף" והרעיון עובר ללוח שלך.</p></div>
          </div>
          <button type="button" className={styles.iconBtn} aria-expanded={poolOpen} aria-label={poolOpen ? 'כווץ את המאגר' : 'הרחב את המאגר'} onClick={() => setPoolOpen(o => !o)}>{poolOpen ? '⌃' : '⌄'}</button>
        </div>
        {poolOpen && (
          <>
            <div className={styles.pills} role="group" aria-label="נושא">
              <button type="button" className={!topic ? styles.pillOn : styles.pill} aria-pressed={!topic} onClick={() => setTopic('')}>הכל <span className={styles.pillCount}>{available.length}</span></button>
              {IDEA_TOPICS.map(t => <button key={t} type="button" className={topic === t ? styles.pillOn : styles.pill} aria-pressed={topic === t} onClick={() => setTopic(t)}>{t} <span className={styles.pillCount}>{topicCount(t)}</span></button>)}
            </div>
            {pool.length === 0 ? <div className={styles.empty}>אין רעיונות בנושא הזה</div> : (
              <div className={styles.tileGrid4} style={{ marginTop: 16 }}>
                {pool.map(p => (
                  <div key={p.text} className={styles.stat} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span className={styles.rowMeta}>{p.topic}</span>
                    <span className={styles.rowTitle} style={{ flex: 1 }}>{p.text}</span>
                    <button type="button" className={styles.btnGhost} style={{ alignSelf: 'flex-start' }} onClick={() => addIdea(p.text, p.topic)}>להוסיף +</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {modal && (
        <Modal title="רעיון חדש" onClose={() => setModal(false)}>
          <form className={styles.formGrid} onSubmit={submit}>
            <label className={styles.fieldLabel}>על מה הסרטון<input className={styles.input} value={text} onChange={e => setText(e.target.value)} /></label>
            <div className={styles.toolbar}>
              <button type="submit" className={styles.btn}>הוסף</button>
              <button type="button" className={styles.btnGhost} onClick={() => setModal(false)}>ביטול</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
