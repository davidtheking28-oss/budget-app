import { useState } from 'react';
import { usePipeline } from './usePipeline.js';
import { formatDate } from '../budget/monthUtils.js';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import styles from './PipelineTable.module.css';

const STAGES = [
  { key: 'intro_meeting', label: 'פגישת היכרות', tone: 'info' },
  { key: 'building_plan', label: 'נבנתה תכנית תקציב', tone: 'warn' },
  { key: 'monthly_tracking', label: 'במעקב חודשי', tone: 'good' },
  { key: 'needs_attention', label: 'דורש טיפול', tone: 'danger' }
];

function stageInfo(key) {
  return STAGES.find(s => s.key === key) || STAGES[0];
}

export default function PipelineTable({ advisorId }) {
  const { leads, loading, addLead, setStage, deleteLead } = usePipeline(advisorId);
  const [filter, setFilter] = useState('all');
  const [name, setName] = useState('');
  const [caseOwner, setCaseOwner] = useState('');
  const [nextMeeting, setNextMeeting] = useState('');
  const [stage, setNewStage] = useState('intro_meeting');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSubmitting(true);
    const ok = await addLead({ name, case_owner: caseOwner || null, next_meeting: nextMeeting || null, stage });
    setSubmitting(false);
    if (ok) { setName(''); setCaseOwner(''); setNextMeeting(''); setNewStage('intro_meeting'); }
  }

  const visible = filter === 'all' ? leads : leads.filter(l => l.stage === filter);

  if (loading) return null;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <div className={styles.title}>צינור טיפול בלקוחות</div>
          <div className={styles.subtitle}>מעקב סטטוס לכל לקוח / יחידת תקציב לפי שלב ליווי</div>
        </div>
      </div>

      <div className={styles.filters}>
        <button type="button" className={styles.filterChip + (filter === 'all' ? ' ' + styles.filterChipActive : '')} onClick={() => setFilter('all')}>הכל</button>
        {STAGES.map(s => (
          <button type="button" key={s.key} className={styles.filterChip + (filter === s.key ? ' ' + styles.filterChipActive : '')} onClick={() => setFilter(s.key)}>{s.label}</button>
        ))}
      </div>

      {visible.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>לקוח / יחידה</th>
                <th>סטטוס</th>
                <th>פגישה אחרונה</th>
                <th>פגישה הבאה</th>
                <th>יעד חיסכון</th>
                <th>בעל תיק</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(l => {
                const info = stageInfo(l.stage);
                return (
                  <tr key={l.id}>
                    <td>{l.name}</td>
                    <td>
                      <select className={styles.stageSelect + ' ' + styles[info.tone]} value={l.stage} onChange={e => setStage(l.id, e.target.value)}>
                        {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </td>
                    <td>{formatDate(l.last_meeting) || '—'}</td>
                    <td>{formatDate(l.next_meeting) || '—'}</td>
                    <td>{l.savings_goal || '—'}</td>
                    <td>{l.case_owner || '—'}</td>
                    <td><DeleteButton onClick={() => deleteLead(l.id)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.empty}>אין לקוחות בשלב הזה</div>
      )}

      <div className={styles.addForm}>
        <div className={styles.addFormTitle}>הוספת לקוח חדש</div>
        <div className={styles.addFormRow}>
          <input className={styles.input} aria-label="שם לקוח / יחידה" placeholder="שם לקוח / יחידה" value={name} onChange={e => setName(e.target.value)} />
          <select className={styles.input} aria-label="שלב בצינור" value={stage} onChange={e => setNewStage(e.target.value)}>
            {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <input className={styles.input} type="date" aria-label="פגישה הבאה" value={nextMeeting} onChange={e => setNextMeeting(e.target.value)} />
          <input className={styles.input} aria-label="בעל תיק" placeholder="שם היועץ/ת" value={caseOwner} onChange={e => setCaseOwner(e.target.value)} />
          <Button onClick={submit} disabled={!name.trim() || submitting}>הוספת לקוח</Button>
        </div>
      </div>
    </div>
  );
}
