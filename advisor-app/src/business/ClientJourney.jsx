import { notifyTasksInstant } from '../crm/useClientCrm.js';
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import { ONBOARDING, MEETINGS, readJourney, journeyProgress, cashflow, currentStage, nextMeeting, journeyAttention, meetingStatusLabel, syncJourneyMeetings } from './journeyMath.js';
import { fmt } from '../format.js';
import { scheduleJourneyMeeting } from './journeyMeetings.js';
import styles from './Business.module.css';

export default function ClientJourney({ advisorId, row, saveDeal, onBack, onOpenClient }) {
  const [journey, setJourney] = useState(() => readJourney(row.deal?.journey));
  const [initial] = useState(journey);
  const [taskDraft, setTaskDraft] = useState({});
  const [summaryState, setSummaryState] = useState({});
  const [opened, setOpened] = useState(() => Object.fromEntries(MEETINGS.map(m => [m.key, m.key === MEETINGS.find(next => !readJourney(row.deal?.journey).meetings[next.key].done)?.key])));
  const [intakeOpen, setIntakeOpen] = useState(() => !ONBOARDING.every(s => readJourney(row.deal?.journey).onboarding[s.key]));
  useEffect(() => {
    const taskIds = MEETINGS.flatMap(m => initial.meetings[m.key].tasks.map(t => t.id).filter(Boolean));
    if (!row.client_id) return;
    let alive = true, request = 0;
    const refresh = async () => {
      const current = ++request;
      try {
        const [tasksRes, meetingsRes] = await Promise.all([
          taskIds.length ? supabase.from('advisor_tasks').select('id, done').in('id', taskIds) : { data: [] },
          supabase.from('advisor_meetings').select('id, scheduled_at, status, for_client').eq('advisor_id', advisorId).eq('client_id', row.client_id)
        ]);
        if (!alive || current !== request || meetingsRes.error) return;
        const doneById = Object.fromEntries((tasksRes.data || []).map(t => [t.id, t.done]));
        setJourney(prev => {
          const next = syncJourneyMeetings(prev, meetingsRes.data || []);
          return { ...next, meetings: Object.fromEntries(MEETINGS.map(m => [m.key, { ...next.meetings[m.key], tasks: next.meetings[m.key].tasks.map(t => t.id && t.id in doneById ? { ...t, done: doneById[t.id] } : t) }])) };
        });
      } catch { return; }
    };
    refresh();
    const onFocus = () => { if (!document.hidden) refresh(); };
    const timer = window.setInterval(onFocus, 15000);
    window.addEventListener('focus', onFocus);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [initial, advisorId, row.client_id]);

  const progress = journeyProgress(journey);
  const percent = Math.round(progress.rate * 100);
  const upcoming = nextMeeting(journey);
  const attention = journeyAttention(journey);
  const name = row.name || row.client_email;

  function commit(next) { setJourney(next); saveDeal(row, { journey: next }); }
  function edit(next) { setJourney(next); }
  const save = () => saveDeal(row, { journey });
  const setMeeting = (key, patch, persist = true) => {
    const next = { ...journey, meetings: { ...journey.meetings, [key]: { ...journey.meetings[key], ...patch } } };
    if (persist) commit(next); else edit(next);
  };

  const clientId = row.client_id;
  const needClient = () => { if (clientId) return false; toast('הלקוח עוד לא מחובר, אי אפשר לשתף איתו', 'error'); return true; };

  async function setDate(key, date) {
    if (needClient()) return;
    const next = await scheduleJourneyMeeting(advisorId, clientId, journey, key, date);
    if (next) commit(next);
  }

  async function saveSummary(key) {
    if (summaryState[key] === 'saving') return;
    const m = journey.meetings[key];
    setSummaryState(prev => ({ ...prev, [key]: 'saving' }));
    try {
      if (!(await save())) { setSummaryState(prev => ({ ...prev, [key]: 'error' })); return; }
      if (m.meetingId) {
        const { error } = await supabase.from('advisor_meetings').update({ summary: m.summary || null }).eq('id', m.meetingId).eq('advisor_id', advisorId);
        if (error) { setSummaryState(prev => ({ ...prev, [key]: 'error' })); return; }
      }
      setSummaryState(prev => ({ ...prev, [key]: 'saved' }));
    } catch {
      setSummaryState(prev => ({ ...prev, [key]: 'error' }));
    }
  }

  async function addTask(key) {
    const text = (taskDraft[key] || '').trim();
    if (!text || needClient()) return;
    const { data, error } = await supabase.from('advisor_tasks').insert({ advisor_id: advisorId, client_id: clientId, title: text, for_client: true, responsible: 'client', meeting_id: journey.meetings[key].meetingId || null }).select().single();
    if (error) { toast('שגיאה בהוספת המשימה', 'error'); return; }
    notifyTasksInstant([data.id]);
    setMeeting(key, { tasks: [...journey.meetings[key].tasks, { id: data.id, text, done: false }] });
    setTaskDraft(prev => ({ ...prev, [key]: '' }));
  }

  async function toggleTask(key, index, done) {
    const task = journey.meetings[key].tasks[index];
    if (task.id) {
      const { error } = await supabase.from('advisor_tasks').update({ done }).eq('id', task.id).eq('advisor_id', advisorId);
      if (error) { toast('שגיאה בעדכון המשימה', 'error'); return; }
    }
    setMeeting(key, { tasks: journey.meetings[key].tasks.map((x, i) => i === index ? { ...x, done } : x) });
  }

  async function removeTask(key, index) {
    const task = journey.meetings[key].tasks[index];
    if (task.id) {
      const { error } = await supabase.from('advisor_tasks').delete().eq('id', task.id).eq('advisor_id', advisorId);
      if (error) { toast('שגיאה במחיקה', 'error'); return; }
    }
    setMeeting(key, { tasks: journey.meetings[key].tasks.filter((_, i) => i !== index) });
  }

  const first = journey.meetings.m1;
  const last = journey.meetings.m4;
  const flowChange = cashflow(last) - cashflow(first);

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.btnGhost} onClick={onBack}>חזרה לשירות</button>
        {row.client_id && <button type="button" className={styles.btnGhost} onClick={() => onOpenClient(row)}>כרטיס הלקוח</button>}
      </div>

      <section className={styles.card}>
        <div className={styles.journeySummaryHead}>
          <div><h2 className={styles.cardTitle}>{name}</h2><p className={styles.cardSub}>{progress.done} מתוך {progress.total} שלבים הושלמו · {currentStage(journey)}</p></div>
          <strong className={styles.journeyPercent}>{percent}%</strong>
        </div>
        <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="התקדמות בתהליך">
          <div className={styles.progressFill} style={{ width: percent + '%' }} />
        </div>
        <div className={styles.journeyOverview}>
          <div className={styles.cell}>
            <div className={styles.statLabel}>הפגישה הבאה בתהליך</div>
            <div className={styles.statValue} style={{ fontSize: 'var(--text-lg)' }}>{upcoming ? upcoming.title : 'הושלמו כל הפגישות'}</div>
            {upcoming && (
              <label className={styles.fieldLabel}>מועד ביומן {meetingStatusLabel(upcoming.status)}
                <input className={styles.input} type="date" value={upcoming.date} onChange={e => { const k = MEETINGS.find(m => m.title === upcoming.title).key; setDate(k, e.target.value); }} />
              </label>
            )}
          </div>
          <div className={styles.cell}>
            <div className={styles.statLabel}>דברים שדורשים טיפול</div>
            <div className={styles.pills}>{attention.length ? attention.map(a => <span key={a} className={styles.pillBtn + ' ' + styles.pillWarn} style={{ cursor: 'default' }}>{a}</span>) : <span className={styles.rowMeta}>אין פריטים לטיפול</span>}</div>
          </div>
        </div>
        <label className={styles.fieldLabel} style={{ marginTop: 14 }}>הערה להמשך הליווי
          <textarea className={styles.input} rows={2} placeholder="נקודות חשובות להמשך הליווי" aria-label="הערה להמשך הליווי" value={journey.note} onChange={e => edit({ ...journey, note: e.target.value })} onBlur={save} />
        </label>
      </section>

      <details className={styles.card + ' ' + styles.journeySection} open={intakeOpen} onToggle={e => setIntakeOpen(e.currentTarget.open)}>
        <summary><span>קליטה</span><span className={styles.rowMeta}>{ONBOARDING.filter(s => journey.onboarding[s.key]).length}/{ONBOARDING.length} הושלמו</span></summary>
        <div className={styles.journeyBody}>
        <ul className={styles.rowList}>
          {ONBOARDING.map(s => (
            <li key={s.key} className={styles.rowItem}>
              <input type="checkbox" className={styles.check} id={'ob-' + s.key} checked={!!journey.onboarding[s.key]} onChange={e => commit({ ...journey, onboarding: { ...journey.onboarding, [s.key]: e.target.checked } })} />
              <label htmlFor={'ob-' + s.key} className={styles.rowMain}><span className={styles.rowTitle}>{s.label}</span></label>
              <span className={styles.rowMeta}>{journey.onboarding[s.key] ? 'בוצע' : 'לא בוצע'}</span>
            </li>
          ))}
        </ul>
        </div>
      </details>

      {MEETINGS.map((m, index) => {
        const data = journey.meetings[m.key];
        return (
          <details key={m.key} className={styles.card + ' ' + styles.journeySection} open={opened[m.key]} onToggle={e => { const open = e.currentTarget.open; setOpened(prev => ({ ...prev, [m.key]: open })); }}>
            <summary><span>{m.title}</span><span className={styles.rowMeta}>{data.done ? 'הושלמה' : meetingStatusLabel(data.meetingStatus) || 'להשלמה'}{data.date ? ' · ' + new Date(data.date).toLocaleDateString('he-IL') : ''}</span></summary>
            <div className={styles.journeyBody}>
            <div className={styles.toolbar}>
              <label className={styles.toolbar} style={{ gap: 8 }}>
                <input type="checkbox" className={styles.check} checked={data.done} onChange={e => setMeeting(m.key, { done: e.target.checked })} />
                <span className={styles.rowMeta}>{data.done ? 'הפגישה הושלמה' : 'סימון הפגישה כהושלמה'}</span>
              </label>
            </div>

            {m.key === 'm1' && (
              <div className={styles.grid2}>
                {journey.goals.map((goal, gi) => (
                  <label key={gi} className={styles.fieldLabel}>מטרה מרכזית {gi + 1}
                    <input className={styles.input} value={goal} onChange={e => edit({ ...journey, goals: journey.goals.map((g, i) => i === gi ? e.target.value : g) })} onBlur={save} />
                  </label>
                ))}
              </div>
            )}

            <label className={styles.fieldLabel}>סיכום פגישה
              <textarea className={styles.input} rows={3} aria-label={'סיכום פגישה: ' + m.title} value={data.summary} onChange={e => setMeeting(m.key, { summary: e.target.value }, false)} onBlur={() => saveSummary(m.key)} disabled={summaryState[m.key] === 'saving'} />
            </label>

            {summaryState[m.key] && <div className={styles.toolbar} role={summaryState[m.key] === 'error' ? 'alert' : 'status'}><span className={summaryState[m.key] === 'error' ? styles.fieldError : styles.note}>{summaryState[m.key] === 'error' ? 'לא הושלמה שמירת הסיכום. הטקסט נשאר כאן.' : summaryState[m.key] === 'saving' ? 'שומר סיכום…' : 'הסיכום נשמר'}</span>{summaryState[m.key] === 'error' && <button type="button" className={styles.btnGhost} onClick={() => saveSummary(m.key)}>נסה לשמור סיכום שוב</button>}</div>}
            <div className={styles.sectionLabel}>{m.balance}</div>
            <div className={styles.grid3}>
              <label className={styles.fieldLabel}>הכנסות
                <input className={styles.input} inputMode="decimal" placeholder="₪" value={data.income} onChange={e => setMeeting(m.key, { income: e.target.value }, false)} onBlur={save} />
              </label>
              <label className={styles.fieldLabel}>הוצאות
                <input className={styles.input} inputMode="decimal" placeholder="₪" value={data.expenses} onChange={e => setMeeting(m.key, { expenses: e.target.value }, false)} onBlur={save} />
              </label>
              <div className={styles.stat}><div className={styles.statLabel}>תזרים</div><div className={styles.statValue}>{fmt(cashflow(data))}</div><div className={styles.statNote}>הכנסות פחות הוצאות</div></div>
            </div>

            {m.key === 'm4' && (
              <div className={styles.grid3}>
                <div className={styles.stat}><div className={styles.statLabel}>שינוי תזרים מפגישת המיפוי</div><div className={styles.statValue}>{fmt(flowChange)}</div><div className={styles.statNote}>תזרים סופי פחות תזרים מיפוי</div></div>
                <div className={styles.stat}><div className={styles.statLabel}>תזרים במיפוי</div><div className={styles.statValue}>{fmt(cashflow(first))}</div></div>
                <div className={styles.stat}><div className={styles.statLabel}>תזרים סופי</div><div className={styles.statValue}>{fmt(cashflow(last))}</div></div>
              </div>
            )}

            <div className={styles.sectionLabel}>{m.tasks}</div>
            {data.tasks.length === 0 && <p className={styles.note}>עוד לא נוספו משימות לפגישה הזו. אפשר להוסיף משימה בשדה למטה.</p>}
            {data.tasks.length > 0 && (
              <ul className={styles.rowList}>
                {data.tasks.map((t, ti) => (
                  <li key={ti} className={styles.rowItem}>
                    <input type="checkbox" className={styles.check} checked={!!t.done} aria-label={t.text} onChange={e => toggleTask(m.key, ti, e.target.checked)} />
                    <div className={styles.rowMain}><div className={styles.rowTitle} style={t.done ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>{t.text}</div></div>
                    <button type="button" className={styles.iconBtn} aria-label={'מחק משימה: ' + t.text} onClick={() => removeTask(m.key, ti)}>×</button>
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.toolbar}>
              <input className={styles.input + ' ' + styles.inputGrow} placeholder="משימה חדשה" aria-label={m.tasks} value={taskDraft[m.key] || ''} onChange={e => setTaskDraft(prev => ({ ...prev, [m.key]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addTask(m.key)} />
              <button type="button" className={styles.btnGhost} onClick={() => addTask(m.key)}>הוסף משימה</button>
            </div>

            {m.followups > 0 && (
              <>
                <div className={styles.sectionLabel}>מעקבים לאחר פגישה {index + 1} · {data.followups.filter(Boolean).length}/{data.followups.length}</div>
                <ul className={styles.rowList}>
                  {data.followups.map((done, fi) => (
                    <li key={fi} className={styles.rowItem}>
                      <input type="checkbox" className={styles.check} id={`fu-${m.key}-${fi}`} checked={!!done} onChange={e => setMeeting(m.key, { followups: data.followups.map((x, i) => i === fi ? e.target.checked : x) })} />
                      <label htmlFor={`fu-${m.key}-${fi}`} className={styles.rowMain}><span className={styles.rowTitle}>מעקב שבוע {fi + 1}</span></label>
                    </li>
                  ))}
                </ul>
                <div><button type="button" className={styles.btnGhost} onClick={() => setMeeting(m.key, { followups: [...data.followups, false] })}>הוסף שבוע מעקב ({data.followups.length + 1})</button></div>
              </>
            )}
            </div>
          </details>
        );
      })}

      <section className={styles.card}>
        <h2 className={styles.sectionHeading}>בקשת המלצה מהלקוח</h2>
        <p className={styles.note}>השלב האחרון בתהליך: מבקשים המלצה מיד אחרי הפגישה האחרונה, כשהלקוח הכי מרוצה.</p>
        <ul className={styles.rowList}>
          <li className={styles.rowItem}>
            <input type="checkbox" className={styles.check} id="rec-requested" checked={journey.recommendation.requested} onChange={e => commit({ ...journey, recommendation: { ...journey.recommendation, requested: e.target.checked } })} />
            <label htmlFor="rec-requested" className={styles.rowMain}><span className={styles.rowTitle}>ביקשתי המלצה</span></label>
          </li>
          <li className={styles.rowItem}>
            <input type="checkbox" className={styles.check} id="rec-received" checked={journey.recommendation.received} onChange={e => commit({ ...journey, recommendation: { ...journey.recommendation, received: e.target.checked } })} />
            <label htmlFor="rec-received" className={styles.rowMain}><span className={styles.rowTitle}>ההמלצה התקבלה</span></label>
          </li>
        </ul>
        <label className={styles.fieldLabel}>נוסח ההמלצה
          <textarea className={styles.input} rows={3} value={journey.recommendation.text} onChange={e => edit({ ...journey, recommendation: { ...journey.recommendation, text: e.target.value } })} onBlur={save} />
        </label>
      </section>
    </div>
  );
}
