import { useEffect } from 'react';
import { ensurePush, pushSupported } from './advisorPush.js';

export function useAutoPush(advisorId) {
  useEffect(() => {
    if (!advisorId || !pushSupported()) return undefined;
    let done = false;
    const attempt = () => {
      if (done) return;
      ensurePush(advisorId).then(state => { if (state === 'on' || Notification.permission !== 'default') done = true; }).catch(() => {});
    };
    const timer = setTimeout(attempt, 3000);
    window.addEventListener('pointerdown', attempt, { once: true });
    return () => { clearTimeout(timer); window.removeEventListener('pointerdown', attempt); };
  }, [advisorId]);
}
