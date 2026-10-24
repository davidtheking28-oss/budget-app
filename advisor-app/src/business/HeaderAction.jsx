import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function HeaderAction({ children, targetId = 'biz-header-actions', fallback = true }) {
  const [target, setTarget] = useState(undefined);
  useEffect(() => { setTarget(document.getElementById(targetId) || null); }, [targetId]);
  if (target === undefined) return null;
  if (target === null) return fallback ? <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-3)' }}>{children}</div> : null;
  return createPortal(children, target);
}
