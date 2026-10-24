import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function HeaderAction({ children }) {
  const [target, setTarget] = useState(null);
  useEffect(() => { setTarget(document.getElementById('biz-header-actions')); }, []);
  return target ? createPortal(children, target) : null;
}
