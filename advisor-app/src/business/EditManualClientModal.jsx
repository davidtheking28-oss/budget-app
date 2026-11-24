import { useState } from 'react';
import Modal from './Modal.jsx';
import styles from './Business.module.css';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function EditManualClientModal({ client, onSave, onClose }) {
  const [form, setForm] = useState({ name: client.name || '', phone: client.phone || '', email: client.email || '', background: client.background || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = patch => setForm(prev => ({ ...prev, ...patch }));

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim()) { setError('צריך להזין שם'); return; }
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) { setError('כתובת האימייל לא תקינה'); return; }
    setSaving(true);
    setError('');
    try {
      const ok = await onSave({ name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim().toLowerCase(), background: form.background.trim() });
      if (ok) onClose(); else setError('השמירה לא הושלמה. אפשר לנסות שוב.');
    } catch {
      setError('השמירה לא הושלמה. אפשר לנסות שוב.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="עריכת פרטי לקוח" onClose={onClose}>
      <form className={styles.stack} onSubmit={submit} aria-busy={saving}>
        <label className={styles.fieldLabel}>שם מלא · חובה
          <input className={styles.input} autoComplete="name" value={form.name} onChange={e => set({ name: e.target.value })} required />
        </label>
        <label className={styles.fieldLabel}>טלפון
          <input className={styles.input} type="tel" autoComplete="tel" dir="ltr" value={form.phone} onChange={e => set({ phone: e.target.value })} />
        </label>
        <label className={styles.fieldLabel}>אימייל
          <input className={styles.input} type="email" autoComplete="email" dir="ltr" value={form.email} onChange={e => set({ email: e.target.value })} />
        </label>
        <label className={styles.fieldLabel}>הערות
          <textarea className={styles.input + ' ' + styles.textarea} value={form.background} onChange={e => set({ background: e.target.value })} />
        </label>
        <p className={styles.note} style={{ margin: 0 }}>אם הלקוח יירשם לאפליקציה עם אותו אימייל, הוא ישויך אליך אוטומטית.</p>
        {error && <p className={styles.fieldError} role="alert">{error}</p>}
        <div className={styles.toolbar}>
          <button type="submit" className={styles.btn} disabled={saving}>{saving ? 'שומר…' : 'שמור'}</button>
          <button type="button" className={styles.btnGhost} onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  );
}
