import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import styles from './QuickSwitcher.module.css';

function initials(email) {
  return (email || '?').trim()[0]?.toUpperCase() || '?';
}

export default function QuickSwitcher({ advisorId, onSelect }) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);

  useEffect(() => {
    function onKeyDown(e) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || !advisorId) return;
    let cancelled = false;
    restoreFocusRef.current = document.activeElement;
    setQuery('');
    setActive(0);
    supabase
      .from('advisor_clients')
      .select('client_id, client_email')
      .eq('advisor_id', advisorId)
      .eq('status', 'active')
      .order('client_email', { ascending: true })
      .then(({ data }) => { if (!cancelled) setClients(data || []); });
    setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      cancelled = true;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, advisorId]);

  if (!open) return null;

  const filtered = clients.filter(c => c.client_email.toLowerCase().includes(query.toLowerCase()));

  function select(c) {
    onSelect(c.client_id, c.client_email);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && filtered[active]) { select(filtered[active]); }
    else if (e.key === 'Tab') {
      const focusable = panelRef.current?.querySelectorAll('input, button');
      if (!focusable || !focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-label="חיפוש לקוח מהיר" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className={styles.input}
          type="search"
          aria-label="חפש לקוח לפי אימייל"
          placeholder="חפש לקוח לפי אימייל…"
          value={query}
          onChange={e => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls="qs-listbox"
          aria-activedescendant={filtered[active] ? `qs-option-${filtered[active].client_id}` : undefined}
        />
        <div id="qs-listbox" className={styles.list} role="listbox">
          {filtered.length ? filtered.map((c, i) => (
            <button
              type="button"
              key={c.client_id}
              id={`qs-option-${c.client_id}`}
              role="option"
              aria-selected={i === active}
              className={styles.row + (i === active ? ' ' + styles.rowActive : '')}
              onMouseEnter={() => setActive(i)}
              onClick={() => select(c)}
              onKeyDown={onKeyDown}
            >
              <div className={styles.avatar} aria-hidden="true">{initials(c.client_email)}</div>
              <div className={styles.email}>{c.client_email}</div>
            </button>
          )) : <div className={styles.empty}>אין תוצאות</div>}
        </div>
        <div className={styles.hint}>↑↓ לניווט · Enter לבחירה · Esc לסגירה</div>
      </div>
    </div>
  );
}
