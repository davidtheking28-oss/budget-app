import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import Modal from './Modal.jsx';
import styles from './Business.module.css';

const labelOf = l => l.name || l.client_email || 'לקוח';

function NewFamilyModal({ clients, onSave, onClose }) {
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [self, setSelf] = useState(false);
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);
  const needle = search.trim().toLowerCase();
  const visible = clients.filter(c => !needle || [c.name, c.client_email].some(v => (v || '').toLowerCase().includes(needle)));
  const total = picked.length + (self ? 1 : 0);
  const toggle = id => setPicked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || total < 2 || saving) return;
    setSaving(true);
    const ok = await onSave({ name: name.trim(), include_self: self, member_links: picked });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal title="משפחה חדשה" onClose={onClose}>
      <form className={styles.stack} onSubmit={submit}>
        <p className={styles.note} style={{ margin: 0 }}>שם למשפחה, ומי נמצא בה: הלקוחות שלך, ואם תרצה גם אתה. לפחות שניים.</p>
        <label className={styles.fieldLabel}>שם המשפחה
          <input className={styles.input} placeholder="למשל, משפחת כהן" value={name} onChange={e => setName(e.target.value)} />
        </label>
        <div className={styles.fieldLabel}>מי במשפחה
          <input className={styles.input} type="search" placeholder="חיפוש לפי שם או מייל" aria-label="חיפוש חבר משפחה" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <label className={styles.familyChoice}><input className={styles.check} type="checkbox" checked={self} onChange={e => setSelf(e.target.checked)} /><span><strong>אני</strong><small>האזור האישי שלי יהיה חלק מהמשפחה</small></span></label>
        {visible.map(c => (
          <label key={c.id} className={styles.familyChoice}>
            <input className={styles.check} type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
            <span><strong>{labelOf(c)}</strong>{c.name && c.client_email && <small dir="ltr">{c.client_email}</small>}</span>
          </label>
        ))}
        {!visible.length && <p className={styles.note}>לא נמצאו לקוחות בחיפוש הזה</p>}
        <div className={styles.formActions}>
          <span className={styles.cardSub} role="status">נבחרו {total} · נדרשים לפחות שניים</span>
          <button type="submit" className={styles.btn} disabled={saving || !name.trim() || total < 2}>יצירה</button>
          <button type="button" className={styles.btnGhost} onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Families({ advisorId, links }) {
  const [families, setFamilies] = useState([]);
  const [adding, setAdding] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const clients = links.filter(l => l.status === 'active' || l.status === 'manual');

  const load = useCallback(async () => {
    const { data } = await supabase.from('advisor_families').select('id, name, include_self, member_links, created_at').eq('advisor_id', advisorId).order('created_at', { ascending: false });
    setFamilies(data || []);
  }, [advisorId]);

  useEffect(() => { load(); }, [load]);

  async function create(form) {
    const { error } = await supabase.from('advisor_families').insert({ advisor_id: advisorId, ...form });
    if (error) { toast('שגיאה ביצירת המשפחה', 'error'); return false; }
    toast('המשפחה נוצרה', 'success');
    load();
    return true;
  }

  async function remove(id) {
    setConfirmingId(null);
    const { error } = await supabase.from('advisor_families').delete().eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה במחיקת המשפחה', 'error'); return; }
    toast('המשפחה נמחקה', 'success');
    load();
  }

  const members = f => [
    ...(f.include_self ? ['אני'] : []),
    ...f.member_links.map(id => clients.find(c => c.id === id)).filter(Boolean).map(labelOf)
  ];

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>משפחות</h2>
        <button type="button" className={styles.btn} onClick={() => setAdding(true)}>משפחה חדשה</button>
      </div>
      {families.length === 0 ? <div className={styles.emptyState}><span>אין משפחות עדיין.</span></div> : (
        <div className={styles.stack}>
          {families.map(f => (
            <div key={f.id} className={styles.toolbar} style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{f.name}</strong>
                <div className={styles.rowMeta}>{members(f).join(' · ')}</div>
              </div>
              {confirmingId === f.id ? (
                <div className={styles.toolbar}>
                  <button type="button" className={styles.btnGhost} onClick={() => remove(f.id)}>למחוק את המשפחה?</button>
                  <button type="button" className={styles.btnGhost} onClick={() => setConfirmingId(null)}>חזרה</button>
                </div>
              ) : <button type="button" className={styles.btnGhost} aria-label={'מחיקת משפחה: ' + f.name} onClick={() => setConfirmingId(f.id)}>מחיקה</button>}
            </div>
          ))}
        </div>
      )}
      {adding && <NewFamilyModal clients={clients} onSave={create} onClose={() => setAdding(false)} />}
    </section>
  );
}
