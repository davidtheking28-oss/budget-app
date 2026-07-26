import { useState } from 'react';
import Button from '../components/Button.jsx';
import { toast } from '../toast.js';
import styles from './ImportSheet.module.css';

const BOM = '﻿';

function parseCsv(text) {
  const stripped = text.indexOf(BOM) === 0 ? text.slice(1) : text;
  const lines = stripped.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const splitLine = l => {
    const cells = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { cells.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur);
    return cells.map(c => c.trim());
  };
  const header = splitLine(lines[0]).map(h => h.toLowerCase());
  const dateIdx = header.findIndex(h => /date|תאריך/.test(h));
  const descIdx = header.findIndex(h => /desc|תיאור|שם|פרטים/.test(h));
  const amountIdx = header.findIndex(h => /amount|סכום|חיוב|זכות/.test(h));
  const hasHeader = dateIdx >= 0 || descIdx >= 0 || amountIdx >= 0;
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows = [];
  dataLines.forEach(line => {
    const cells = splitLine(line);
    if (cells.length < 2) return;
    const rawDate = hasHeader && dateIdx >= 0 ? cells[dateIdx] : cells[0];
    const rawDesc = hasHeader && descIdx >= 0 ? cells[descIdx] : cells[1];
    const rawAmount = hasHeader && amountIdx >= 0 ? cells[amountIdx] : cells[cells.length - 1];
    const amount = parseFloat(String(rawAmount).replace(/[^\d.-]/g, ''));
    if (!rawDesc || Number.isNaN(amount) || amount === 0) return;
    let date = rawDate;
    const dm = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(rawDate || '');
    if (dm) {
      let [, d, m, y] = dm;
      if (y.length === 2) y = '20' + y;
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = new Date().toISOString().slice(0, 10);
    rows.push({ date, desc: rawDesc, amount });
  });
  return rows;
}

export default function ImportSheet({ onClose, onImport }) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result || ''));
      if (!parsed.length) { toast('לא נמצאו שורות תקינות בקובץ', 'error'); return; }
      setRows(parsed);
    };
    reader.readAsText(file, 'utf-8');
  }

  async function confirm() {
    setImporting(true);
    await onImport(rows);
    setImporting(false);
  }

  const income = rows.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const expense = rows.filter(r => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.sheet} role="dialog" aria-modal="true">
        <div className={styles.head}>
          <div className={styles.title}>ייבוא מקובץ</div>
          <Button variant="ghost" onClick={onClose}>סגור</Button>
        </div>

        {!rows.length ? (
          <div className={styles.dropZone}>
            <input id="importFile" className={styles.fileInput} type="file" accept=".csv,text/csv" onChange={handleFile} />
            <label htmlFor="importFile" className={styles.dropLabel}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 15V3M7 8l5-5 5 5" />
                <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
              </svg>
              <span>בחר קובץ CSV מדף הבנק / כרטיס האשראי</span>
              <span className={styles.dropHint}>עמודות תאריך, תיאור וסכום מזוהות אוטומטית. סכום שלילי = הוצאה, חיובי = הכנסה.</span>
            </label>
          </div>
        ) : (
          <>
            <div className={styles.summary}>
              <span className={styles.fileTag}>{fileName}</span>
              <span className={styles.sumItem}>{rows.length} שורות</span>
              <span className={styles.sumItem + ' ' + styles.pos}>+{Math.round(income).toLocaleString('he-IL')} הכנסות</span>
              <span className={styles.sumItem + ' ' + styles.neg}>-{Math.round(expense).toLocaleString('he-IL')} הוצאות</span>
            </div>
            <div className={styles.preview}>
              {rows.slice(0, 40).map((r, i) => (
                <div key={i} className={styles.previewRow}>
                  <span className={styles.previewDate}>{r.date}</span>
                  <span className={styles.previewDesc}>{r.desc}</span>
                  <span className={styles.previewAmt + ' ' + (r.amount < 0 ? styles.neg : styles.pos)}>{r.amount < 0 ? '-' : '+'}{Math.abs(Math.round(r.amount)).toLocaleString('he-IL')}</span>
                </div>
              ))}
              {rows.length > 40 && <div className={styles.previewMore}>ועוד {rows.length - 40} שורות...</div>}
            </div>
            <div className={styles.footer}>
              <Button variant="ghost" onClick={() => setRows([])}>בחר קובץ אחר</Button>
              <Button onClick={confirm} disabled={importing}>{importing ? 'מייבא...' : `ייבא ${rows.length} תנועות`}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
