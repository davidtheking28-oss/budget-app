import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import { IDEA_POOL, IDEA_TOPICS } from './videoIdeasPool.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import styles from './Business.module.css';

const STATUSES = [
  { key: 'idea', label: 'רעיון' },
  { key: 'filmed', label: 'בצילום' },
  { key: 'published', label: 'פורסם' }
];

export default function VideoIdeas({ advisorId }) {
  const { records, loading, error, reload, add, update, remove } = useBizRecords(advisorId, 'video_idea');
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [offset, setOffset] = useState(0);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  const ideas = records.map(r => ({ id: r.id, ...r.data }));
  const taken = new Set(ideas.map(i => i.text));
  const available = IDEA_POOL.filter(p => !taken.has(p.text));
  const pool = available.filter(p => !topic || p.topic === topic);
  const daily = available.length ? available[(new Date().getDate() + offset) % available.length] : null;
  const countOf = status => ideas.filter(i => i.status === status).length;
  const topicCount = t => available.filter(p => p.topic === t).length;

  async function addIdea(value, ideaTopic = '') {
    const row = await add({ text: value, topic: ideaTopic, status: 'idea' });
    return !!row;
  }

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) { toast('כתוב את הרעיון', 'error'); return; }
    if (await addIdea(text.trim())) setText('');
  }

  return (
    <div className={styles.stack}>
      <div className={styles.grid2}>
        <section className={styles.card}>
          <div className={styles.cardHead}><h3 className={styles.cardTitle}>רעיון של היום</h3><button type="button" className={styles.btnGhost} onClick={() => setOffset(o => o + 1)}>רעיון אחר</button></div>
          {daily ? (
            <>
              <p className={styles.rowTitle}>{daily.text}</p>
              <p className={styles.cardSub}>{daily.topic}</p>
              <div className={styles.toolbar} style={{ marginTop: 12 }}><button type="button" className={styles.btn} onClick={() => addIdea(daily.text, daily.topic)}>להוסיף לרעיונות שלי</button></div>
            </>
          ) : <div className={styles.empty}>הוספת את כל הרעיונות מהמאגר</div>}
        </section>
        <section className={styles.card}>
          <div className={styles.cardHead}><h3 className={styles.cardTitle}>רעיון חדש</h3></div>
          <form className={styles.toolbar} onSubmit={submit}>
            <input className={styles.input + ' ' + styles.inputGrow} placeholder="על מה הסרטון" aria-label="רעיון חדש" value={text} onChange={e => setText(e.target.value)} />
            <button type="submit" className={styles.btn}>הוסף</button>
          </form>
          <p className={styles.note}>טיפ: מצלמים שלושה סרטונים ברצף באותו יום וחוסכים זמן כל השבוע.</p>
        </section>
      </div>

      <div className={styles.grid3}>
        {STATUSES.map(s => (
          <section key={s.key} className={styles.card}>
            <div className={styles.cardHead}><h3 className={styles.cardTitle}>{s.label}</h3><span className={styles.statValue}>{countOf(s.key)}</span></div>
            {ideas.filter(i => i.status === s.key).length === 0 ? <div className={styles.empty}>אין כאן רעיונות</div> : (
              <ul className={styles.rowList}>
                {ideas.filter(i => i.status === s.key).map(i => (
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
        ))}
      </div>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div><h3 className={styles.cardTitle}>מאגר השראה</h3><p className={styles.cardSub}>{available.length} רעיונות מוכנים לסרטונים, לפי נושא. הוספה מעבירה את הרעיון ללוח שלך.</p></div>
        </div>
        <div className={styles.pills} role="group" aria-label="נושא">
          <button type="button" className={!topic ? styles.pillOn : styles.pill} aria-pressed={!topic} onClick={() => setTopic('')}>הכל <span className={styles.pillCount}>{available.length}</span></button>
          {IDEA_TOPICS.map(t => <button key={t} type="button" className={topic === t ? styles.pillOn : styles.pill} aria-pressed={topic === t} onClick={() => setTopic(t)}>{t} <span className={styles.pillCount}>{topicCount(t)}</span></button>)}
        </div>
        {pool.length === 0 ? <div className={styles.empty}>אין רעיונות בנושא הזה</div> : (
          <ul className={styles.rowList}>
            {pool.map(p => (
              <li key={p.text} className={styles.rowItem}>
                <div className={styles.rowMain}><div className={styles.rowTitle}>{p.text}</div><div className={styles.rowMeta}>{p.topic}</div></div>
                <button type="button" className={styles.btnGhost} onClick={() => addIdea(p.text, p.topic)}>להוסיף</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
