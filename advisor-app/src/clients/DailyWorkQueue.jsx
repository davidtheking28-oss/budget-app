import { useEffect, useState } from 'react';
import { taskMatches } from '../crm/workflow.js';
import { formatDate } from '../budget/monthUtils.js';
import Button from '../components/Button.jsx';
import { readWorkspace, writeWorkspace } from '../workspaceMemory.js';
import styles from './ClientList.module.css';

export default function DailyWorkQueue({ advisorId, tasks, clients, error, onRetry, onToggle, onSelect }) {
  const [filter, setFilter] = useState(() => readWorkspace(`advisor_queue:${advisorId}`, 'overdue'));
  useEffect(() => { writeWorkspace(`advisor_queue:${advisorId}`, filter); }, [advisorId, filter]);
  const [pending, setPending] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const filters = [['overdue', 'באיחור'], ['today', 'להיום'], ['documents', 'ממתינים למסמכים'], ['all', 'כל הפתוחות']];
  const visible = tasks.filter(t => taskMatches(t, expanded ? filter : 'all')).sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  async function toggle(task) {
    setPending(prev => [...prev, task.id]);
    try { await onToggle(task); } finally { setPending(prev => prev.filter(id => id !== task.id)); }
  }
  return <section className={styles.dailyQueue} aria-label="רשימת העבודה שלי">
    <div className={styles.queueHeader}><div><h2>לטיפול היום</h2><p>{tasks.filter(t => !t.done).length} משימות פתוחות · הקרובות ביותר קודם</p></div><Button variant="ghost" aria-expanded={expanded} aria-label={expanded ? 'צמצם רשימת עבודה' : 'הרחב רשימת עבודה'} onClick={() => setExpanded(v => !v)}>{expanded ? 'הצג פחות' : 'כל המשימות והסינונים'}</Button></div>
    {expanded && <div className={styles.viewButtons} role="group" aria-label="סינון רשימת עבודה">{filters.map(([key, label]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} ({tasks.filter(t => taskMatches(t, key)).length})</button>)}</div>}
    {error ? <div role="alert">לא ניתן לטעון את רשימת המשימות. <Button variant="ghost" onClick={onRetry}>נסה שוב</Button></div> : visible.length ? <div className={styles.queueScroll} role="region" aria-label="פריטי עבודה" tabIndex={0}>{(expanded ? visible : visible.slice(0, 3)).map(t => {
      const client = clients.find(c => c.client_id === t.client_id);
      return <div className={styles.queueRow} key={t.id}>
        <input type="checkbox" disabled={pending.includes(t.id)} aria-label={`השלם: ${t.title}`} checked={false} onChange={() => toggle(t)} />
        <div><strong>{t.title}</strong><small>{client?.name || client?.client_email} · {t.responsible === 'client' ? 'באחריות הלקוח' : 'באחריות היועץ'} · {t.due_date ? formatDate(t.due_date) : 'ללא תאריך יעד'}{t.task_kind === 'document' ? ' · מסמך' : ''}</small></div>
        <Button variant="ghost" onClick={() => onSelect(t.client_id, client?.client_email, { nav: 'crm', action: 'tasks' })}>פתח לקוח</Button>
      </div>;
    })}</div> : <p className={styles.queueEmpty}>אין משימות בתצוגה הזו.</p>}
  </section>;
}
