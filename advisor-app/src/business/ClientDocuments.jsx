import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import styles from './Business.module.css';
import docs from './ClientDocuments.module.css';
import { DOC_KINDS, docsMonthLabel, docsMonths } from './clientDocuments.js';

export default function ClientDocuments({ clientId, startIso }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(false);
    supabase.from('client_documents').select('id, kind, period_month, path, file_name').eq('client_id', clientId).order('created_at')
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(true);
        else setRows(data || []);
      });
    return () => { cancelled = true; };
  }, [clientId, attempt]);

  async function openFile(path) {
    const { data, error: err } = await supabase.storage.from('client-documents').createSignedUrl(path, 120);
    if (err || !data?.signedUrl) { toast('לא הצלחנו לפתוח את הקובץ'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  if (error) return <ErrorState onRetry={() => setAttempt(n => n + 1)} />;
  if (!rows) return <Skeleton height="220px" radius="18px" />;

  const months = docsMonths(startIso);
  const extra = rows.filter(r => !months.includes(r.period_month));

  return (
    <div className={styles.stack}>
      {DOC_KINDS.map(kind => (
        <section key={kind.key} className={docs.group}>
          <h3 className={docs.groupTitle}>{kind.label}</h3>
          {[...months, ...[...new Set(extra.filter(r => r.kind === kind.key).map(r => r.period_month))]].map(month => {
            const files = rows.filter(r => r.kind === kind.key && r.period_month === month);
            return (
              <div key={month} className={docs.row}>
                <div className={docs.rowHead}>
                  <span className={docs.month}>{docsMonthLabel(month)}</span>
                  <span className={files.length ? docs.statusDone : docs.status}>{files.length ? `הועלה (${files.length})` : 'עדיין לא הועלה'}</span>
                </div>
                {files.map(f => (
                  <div key={f.id} className={docs.file}>
                    <span className={docs.fileName}>{f.file_name}</span>
                    <button type="button" className={docs.open} onClick={() => openFile(f.path)}>פתיחה</button>
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
