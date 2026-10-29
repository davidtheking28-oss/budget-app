import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import Button from '../components/Button.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';

const TABLE = 'advisor_biz_records';
const PROGRESS = 'content_plan_progress';
const DOC = 'content_plan_doc';

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

function validDoc(value) {
  return value && typeof value.html === 'string' && Array.isArray(value.DATA?.weeks) && value.DATA.items && Array.isArray(value.BANK) && value.GUIDES;
}

function PlanFrame({ doc, stored, onDone }) {
  const frameRef = useRef(null);
  const detach = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => () => detach.current?.(), []);

  useEffect(() => {
    if (!ready) return;
    const target = frameRef.current?.contentWindow;
    target?.postMessage({ type: 'content-plan:content', ...doc }, window.location.origin);
    if (stored) target?.postMessage({ type: 'content-plan:state', done: stored }, window.location.origin);
  }, [ready, doc, stored]);

  useEffect(() => {
    const onMessage = e => {
      if (e.source !== frameRef.current?.contentWindow || e.origin !== window.location.origin) return;
      if (e.data?.type === 'content-plan:ready') setReady(true);
      if (e.data?.type === 'content-plan:done') onDone(e.data.done);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onDone]);

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

export default function ContentPlan({ advisorId }) {
  const [doc, setDoc] = useState(undefined);
  const [stored, setStored] = useState(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  const ids = useRef({});
  const saveTimer = useRef(null);
  const saveChain = useRef(Promise.resolve());
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    if (!advisorId) return;
    setError(false);
    const { data, error: err } = await supabase.from(TABLE).select('id,kind,data').eq('advisor_id', advisorId).in('kind', [PROGRESS, DOC]).order('created_at', { ascending: true });
    if (err) { setError(true); return; }
    const byKind = {};
    for (const row of data || []) if (!byKind[row.kind]) byKind[row.kind] = row;
    ids.current = { [PROGRESS]: byKind[PROGRESS]?.id || null, [DOC]: byKind[DOC]?.id || null };
    setStored(byKind[PROGRESS]?.data?.done || null);
    setDoc(validDoc(byKind[DOC]?.data) ? byKind[DOC].data : null);
  }, [advisorId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (kind, payload) => {
    if (ids.current[kind]) {
      const { error: err } = await supabase.from(TABLE).update({ data: payload, updated_at: new Date().toISOString() }).eq('id', ids.current[kind]).eq('advisor_id', advisorId);
      return !err;
    }
    const { data, error: err } = await supabase.from(TABLE).insert({ advisor_id: advisorId, kind, period: null, data: payload }).select().single();
    if (err) return false;
    ids.current[kind] = data.id;
    return true;
  }, [advisorId]);

  const onDone = useCallback(done => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveChain.current = saveChain.current.then(async () => { if (!(await save(PROGRESS, { done }))) toast('שגיאה בשמירה', 'error'); });
    }, 400);
  }, [save]);

  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    let parsed;
    try { parsed = JSON.parse(await file.text()); } catch { toast('הקובץ אינו קובץ תוכן תקין', 'error'); return; }
    if (!validDoc(parsed)) { toast('הקובץ אינו קובץ תוכן תקין', 'error'); return; }
    const payload = { html: parsed.html, DATA: parsed.DATA, BANK: parsed.BANK, GUIDES: parsed.GUIDES };
    if (!(await save(DOC, payload))) { toast('שגיאה בשמירה', 'error'); return; }
    setDoc(payload);
    setVersion(v => v + 1);
    toast('התוכן נשמר', 'success');
  }

  if (error) return <ErrorState onRetry={load} />;
  if (doc === undefined) return <Skeleton height="320px" radius="18px" />;

  const picker = <input ref={fileInput} type="file" accept="application/json,.json" onChange={importFile} hidden />;

  if (doc === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, padding: 24, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)' }}>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>לוח התוכן עדיין לא נטען</div>
        <div style={{ color: 'var(--text2)', fontSize: 'var(--text-base)', lineHeight: 1.6 }}>התוכן נשמר בפרטיות בחשבון שלך ולא באתר. כדי לטעון אותו בפעם הראשונה, בחר את קובץ התוכן (content-plan-content.json).</div>
        <Button onClick={() => fileInput.current?.click()}>בחר קובץ תוכן</Button>
        {picker}
      </div>
    );
  }

  return (
    <>
      <PlanFrame key={version} doc={doc} stored={stored} onDone={onDone} />
      <div style={{ display: 'flex', justifyContent: 'flex-start', paddingBlock: 8 }}>
        <Button variant="ghost" onClick={() => fileInput.current?.click()}>טען קובץ תוכן מעודכן</Button>
        {picker}
      </div>
    </>
  );
}
