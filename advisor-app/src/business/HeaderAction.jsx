import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function HeaderAction({ children }) {
  const [target, setTarget] = useState(undefined);
  useEffect(() => { setTarget(document.getElementById('biz-header-actions') || null); }, []);
  if (target === undefined) return null;
  if (target === null) return <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-3)' }}>{children}</div>;
  return createPortal(children, target);
}
