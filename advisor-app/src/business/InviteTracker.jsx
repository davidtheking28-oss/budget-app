import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import { formatDate } from '../budget/monthUtils.js';
import { signupMessage } from './clientApp.js';
import { inviteMessage, inviteStatus, newInviteToken, waPhone } from './invites.js';
import styles from './Business.module.css';

const TONE = { requested: 'tagWarn', ready: 'tagGood', removed: 'tagHigh' };

export default function InviteTracker({ advisorId, links }) {
  const [invites, setInvites] = useState([]);
  const [docs, setDocs] = useState({});
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('advisor_invites').select('id, token, name, phone, client_id, signed_up_at, created_at').eq('advisor_id', advisorId).order('created_at', { ascending: false });
    if (error) return;
    setInvites(data || []);
    const ids = (data || []).map(i => i.client_id).filter(Boolean);
    if (!ids.length) { setDocs({}); return; }
    const { data: rows } = await supabase.from('client_documents').select('client_id, kind, period_month').in('client_id', ids);
    const seen = {};
    (rows || []).forEach(r => { (seen[r.client_id] ||= new Set()).add(r.kind + '|' + r.period_month); });
    setDocs(Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.size])));
  }, [advisorId]);

  useEffect(() => { load(); }, [load, links]);

  async function save(token) {
    const { error } = await supabase.from('advisor_invites').insert({ advisor_id: advisorId, token, name: name.trim(), phone: phone.trim() || null });
    if (error) { toast('הקישור נשלח, אבל לא נשמר במעקב. נסה שוב', 'error'); return; }
    setName(''); setPhone(''); load();
  }

  function send(viaWhatsApp) {
    if (!name.trim()) { setNameError(true); return; }
    const token = newInviteToken();
    const message = inviteMessage(name, advisorId, token);
    if (viaWhatsApp) window.open('https://wa.me/' + waPhone(phone) + '?text=' + encodeURIComponent(message), '_blank', 'noopener');
    else navigator.clipboard.writeText(message).then(() => toast('הקישור האישי הועתק. אפשר לשלוח ללקוח.', 'success'), () => window.prompt('העתק את ההודעה ושלח ללקוח:', message));
    save(token);
  }

  async function remove(inv) {
    if (!window.confirm('להסיר את ' + inv.name + ' מהמעקב?')) return;
    const { error } = await supabase.from('advisor_invites').delete().eq('id', inv.id).eq('advisor_id', advisorId);
    if (error) { toast('ההסרה נכשלה', 'error'); return; }
    setInvites(list => list.filter(i => i.id !== inv.id));
  }

  return (
    <>
      <div className={styles.inviteRow}>
        <div className={styles.inviteText}>
          <h2 className={styles.cardTitle}>הזמן לקוח חדש</h2>
          <p className={styles.note} style={{ margin: 0 }}>כל לקוח מקבל קישור אישי, וכך אפשר לעקוב אחריו מהשליחה ועד העלאת המסמכים.</p>
        </div>
      </div>
      <div className={styles.toolbar} style={{ flexWrap: 'wrap', marginTop: 12 }}>
        <input className={styles.input} placeholder="שם הלקוח" aria-label="שם הלקוח" aria-invalid={nameError} value={name} onChange={e => { setName(e.target.value); setNameError(false); }} />
        <input className={styles.input} type="tel" dir="ltr" placeholder="טלפון (לא חובה)" aria-label="טלפון" value={phone} onChange={e => setPhone(e.target.value)} />
        <button type="button" className={styles.btn} onClick={() => send(true)}>שלח בוואטסאפ</button>
        <button type="button" className={styles.btnGhost} onClick={() => send(false)}>העתק קישור</button>
      </div>
      {nameError && <p className={styles.fieldError} role="alert">כתוב את שם הלקוח</p>}

      <h3 className={styles.sectionHeading} style={{ marginTop: 20 }}>קישורים שנשלחו</h3>
      {invites.length === 0 ? <p className={styles.note}>עוד לא נשלחו קישורים אישיים. הקישור הכללי עדיין עובד: <button type="button" className={styles.linkBtn} onClick={() => navigator.clipboard.writeText(signupMessage(advisorId)).then(() => toast('הקישור הכללי הועתק', 'success'))}>העתק קישור כללי</button></p> : (
        <ul className={styles.rowList} aria-label="קישורים שנשלחו">
          {invites.map(inv => {
            const st = inviteStatus(inv, links, docs);
            return (
              <li key={inv.id} className={styles.rowItem} style={{ flexWrap: 'wrap', gap: 8 }}>
                <div className={styles.rowMain} style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div className={styles.rowTitle}>{inv.name}</div>
                  <div className={styles.rowMeta}>נשלח {formatDate(inv.created_at.slice(0, 10))}{inv.signed_up_at ? ' · נרשם ' + formatDate(inv.signed_up_at.slice(0, 10)) : ''}{inv.phone ? ' · ' : ''}{inv.phone && <span dir="ltr" style={{ whiteSpace: 'nowrap' }}>{inv.phone}</span>}</div>
                </div>
                <span className={styles.tag + (TONE[st.key] ? ' ' + styles[TONE[st.key]] : '')}>{st.label}</span>
                {st.key === 'sent' && <a className={styles.btnGhost} style={{ textDecoration: 'none' }} href={'https://wa.me/' + waPhone(inv.phone) + '?text=' + encodeURIComponent(inviteMessage(inv.name, advisorId, inv.token))} target="_blank" rel="noopener noreferrer">שלח תזכורת</a>}
                <button type="button" className={styles.iconBtn} aria-label={'הסר את ' + inv.name + ' מהמעקב'} onClick={() => remove(inv)}>✕</button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
