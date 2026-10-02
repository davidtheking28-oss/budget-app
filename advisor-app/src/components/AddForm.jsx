import { useState } from 'react';
import styles from './AddForm.module.css';

export default function AddForm({ label, open: forceOpen = false, className, children }) {
  const [open, setOpen] = useState(false);
  if (!open && !forceOpen) {
    return (
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        <span aria-hidden="true">+</span> {label}
      </button>
    );
  }
  return <div className={className}>{children}</div>;
}
