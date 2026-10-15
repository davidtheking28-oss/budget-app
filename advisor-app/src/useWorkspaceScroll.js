import { useLayoutEffect } from 'react';
import { readWorkspace, writeWorkspace } from './workspaceMemory.js';

export function useWorkspaceScroll(scope) {
  useLayoutEffect(() => {
    if (!scope) return;
    const key = `advisor_scroll:${scope}`;
    const target = Math.max(0, Number(readWorkspace(key, 0)) || 0);
    let position = target;
    let restoring = true;
    const observer = new ResizeObserver(restore);
    function restore() {
      if (!restoring) return;
      window.scrollTo(0, target);
      if (document.documentElement.scrollHeight - window.innerHeight >= target) {
        restoring = false;
        observer.disconnect();
      }
    }
    function stop() { restoring = false; observer.disconnect(); position = window.scrollY; }
    function track() { if (!restoring) position = window.scrollY; }
    observer.observe(document.body);
    const frame = requestAnimationFrame(restore);
    window.addEventListener('scroll', track, { passive: true });
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('keydown', stop);
    function save() { writeWorkspace(key, position); }
    window.addEventListener('pagehide', save);
    return () => {
      save(); observer.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener('scroll', track);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('keydown', stop);
      window.removeEventListener('pagehide', save);
    };
  }, [scope]);
}
