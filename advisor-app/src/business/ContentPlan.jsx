import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

const KIND = 'content_plan_progress';

const DIRECT = { '--bg': 'bg', '--card': 'surface', '--fg': 'text', '--mute': 'text2', '--line': 'border-strong', '--accent': 'accent', '--on-accent': 'accent-ink', '--tint': 'accent-dim', '--value': 'green', '--on-value': 'accent-ink', '--warn': 'gold', '--font-d': 'font-body', '--font-b': 'font-body', '--t-xs': 'text-xs', '--t-sm': 'text-sm', '--t-base': 'text-base', '--t-md': 'text-md', '--t-lg': 'text-lg', '--t-xl': 'text-xl', '--r-sm': 'radius-sm', '--r-md': 'radius-md' };

function themeCss(theme) {
  const cs = getComputedStyle(document.documentElement);
  const token = name => cs.getPropertyValue(`--${name}`).trim();
  const vars = Object.entries(DIRECT).map(([own, platform]) => `${own}:${token(platform)}`).join(';');
  return `html:root:root:root{${vars};--vtint:rgba(${token('green-rgb')},.13);color-scheme:${theme}}
html{overflow:hidden}
body{padding-inline:0!important}
.wrap{max-width:none!important;padding-block:0 40px!important}
.sheet{scrollbar-width:thin}`;
}

export default function ContentPlan({ advisorId }) {
  const frameRef = useRef(null);
  const detach = useRef(null);
  const recordId = useRef(null);
  const saveTimer = useRef(null);
  const saveChain = useRef(Promise.resolve());
  const [ready, setReady] = useState(false);
  const [stored, setStored] = useState(undefined);

  useEffect(() => () => detach.current?.(), []);

  useEffect(() => {
    if (!advisorId) return;
    let cancelled = false;
    supabase.from('advisor_biz_records').select('id,data').eq('advisor_id', advisorId).eq('kind', KIND).order('created_at', { ascending: true }).limit(1)
      .then(({ data }) => {
        if (cancelled) return;
        recordId.current = data?.[0]?.id || null;
        setStored(data?.[0]?.data?.done || null);
      });
    return () => { cancelled = true; };
  }, [advisorId]);

  useEffect(() => {
    if (!ready || !stored) return;
    frameRef.current?.contentWindow?.postMessage({ type: 'content-plan:state', done: stored }, window.location.origin);
  }, [ready, stored]);

  useEffect(() => {
    const persist = async done => {
      if (recordId.current) {
        const { error } = await supabase.from('advisor_biz_records').update({ data: { done }, updated_at: new Date().toISOString() }).eq('id', recordId.current).eq('advisor_id', advisorId);
        if (error) toast('שגיאה בשמירה', 'error');
        return;
      }
      const { data, error } = await supabase.from('advisor_biz_records').insert({ advisor_id: advisorId, kind: KIND, period: null, data: { done } }).select().single();
      if (error) { toast('שגיאה בשמירה', 'error'); return; }
      recordId.current = data.id;
    };
    const onMessage = e => {
      if (e.source !== frameRef.current?.contentWindow || e.origin !== window.location.origin) return;
      if (e.data?.type === 'content-plan:ready') setReady(true);
      if (e.data?.type === 'content-plan:done') {
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => { saveChain.current = saveChain.current.then(() => persist(e.data.done)); }, 400);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [advisorId]);

  function attach() {
    detach.current?.();
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;

    const style = doc.createElement('style');
    doc.head.appendChild(style);

    const applyTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme') || 'light';
      doc.documentElement.setAttribute('data-theme', theme);
      style.textContent = themeCss(theme);
    };

    const placeOverlays = () => {
      const rect = frame.getBoundingClientRect();
      const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom || 0;
      const visibleTop = Math.max(rect.top, headerBottom);
      const top = Math.max(0, visibleTop - rect.top);
      const height = Math.max(0, Math.min(window.innerHeight - visibleTop, rect.height - top));
      doc.querySelectorAll('.sheet, .scrim').forEach(el => {
        el.style.position = 'absolute';
        el.style.top = `${top}px`;
        el.style.bottom = 'auto';
        el.style.height = `${height}px`;
      });
    };

    const resize = () => {
      frame.style.height = `${Math.ceil(doc.documentElement.getBoundingClientRect().height)}px`;
      placeOverlays();
    };

    applyTheme();
    resize();

    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(doc.documentElement);
    const overlayObserver = new MutationObserver(placeOverlays);
    overlayObserver.observe(doc.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('scroll', placeOverlays, true);
    window.addEventListener('resize', placeOverlays);

    detach.current = () => {
      sizeObserver.disconnect();
      overlayObserver.disconnect();
      themeObserver.disconnect();
      window.removeEventListener('scroll', placeOverlays, true);
      window.removeEventListener('resize', placeOverlays);
    };
  }

  return (
    <iframe
      ref={frameRef}
      title="לוח תוכן ל-4 שבועות"
      src={`${import.meta.env.BASE_URL}content-plan.html`}
      onLoad={attach}
      scrolling="no"
      style={{ display: 'block', width: '100%', height: 640, border: 0 }}
    />
  );
}
