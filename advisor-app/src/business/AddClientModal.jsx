import { useState } from 'react';
import Modal from './Modal.jsx';
import styles from './Business.module.css';

const EMPTY = { name: '', phone: '', email: '', price: '', payment_method: '', source: '', paid: false, receipt: false, call_summary: '' };

export default function AddClientModal({ methods, sources, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const set = patch => setForm(prev => ({ ...prev, ...patch }));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      const ok = await onSave(form);
      if (ok) onClose();
      else setSaveError(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="לקוח חדש" onClose={onClose}>
      <form className={styles.stack} onSubmit={submit} aria-busy={saving}>
        <label className={styles.fieldLabel}>שם מלא · חובה
          <input className={styles.input} value={form.name} onChange={e => set({ name: e.target.value })} required />
        </label>
        <label className={styles.fieldLabel}>טלפון
          <input className={styles.input} dir="ltr" value={form.phone} onChange={e => set({ phone: e.target.value })} />
        </label>
        <label className={styles.fieldLabel}>אימייל
          <input className={styles.input} type="email" dir="ltr" value={form.email} onChange={e => set({ email: e.target.value })} />
        </label>
        <details className={styles.formDetails}>
          <summary>עסקה, תשלום וסיכום שיחה · רשות</summary>
          <div className={styles.formGrid}>
        <label className={styles.fieldLabel}>מחיר העסקה
          <input className={styles.input} inputMode="decimal" placeholder="₪" value={form.price} onChange={e => set({ price: e.target.value })} />
        </label>
        <label className={styles.fieldLabel}>אמצעי תשלום
          <select className={styles.select} value={form.payment_method} onChange={e => set({ payment_method: e.target.value })}>
            <option value="">—</option>
            {methods.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className={styles.fieldLabel}>מקור הגעה
          <select className={styles.select} value={form.source} onChange={e => set({ source: e.target.value })}>
            <option value="">—</option>
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label><input type="checkbox" checked={form.paid} onChange={e => set({ paid: e.target.checked })} /> שילם</label>
        <label><input type="checkbox" checked={form.receipt} onChange={e => set({ receipt: e.target.checked })} /> קיבל קבלה</label>
        <label className={styles.fieldLabel}>סיכום שיחת התאמה
          <textarea className={styles.input + ' ' + styles.textarea} value={form.call_summary} onChange={e => set({ call_summary: e.target.value })} />
        </label>
          </div>
        </details>
        {saveError && <p className={styles.fieldError} role="alert">לא התקבל אישור לשמירה. הפרטים נשארו כאן. בדוק אם הלקוח נוסף לרשימה לפני ניסיון נוסף.</p>}
        <div className={styles.formActions}>
          <button type="submit" className={styles.btn} disabled={saving || !form.name.trim()}>{saving ? 'שומר…' : 'הוספה'}</button>
          <button type="button" className={styles.btnGhost} onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  );
}
