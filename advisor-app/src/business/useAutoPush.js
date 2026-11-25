import { useEffect } from 'react';
import { ensurePush, pushSupported } from './advisorPush.js';

export function useAutoPush(advisorId) {
  useEffect(() => {
    if (!advisorId || !pushSupported()) return undefined;
    let done = false;
    const attempt = fromClick => {
      if (done) return;
      ensurePush(advisorId, fromClick).then(state => { if (state === 'on' || Notification.permission !== 'default') done = true; }).catch(() => {});
    };
    const onClick = () => attempt(true);
    const timer = setTimeout(() => attempt(false), 3000);
    window.addEventListener('click', onClick, { once: true, capture: true });
    return () => { clearTimeout(timer); window.removeEventListener('click', onClick, { capture: true }); };
  }, [advisorId]);
}
