import { useEffect, useRef, useState } from 'react';
import { Chart as ChartJS, BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useEconomicMapping } from './useEconomicMapping.js';
import { computeCategoryAverages, computeCashflowSummary, looksLikeCardCharge, computeExpenseTypeBreakdown, computeMappingRows, mortgageMappingAmount } from './mappingMath.js';
import { categorizeByDictionary } from './categorizeDict.js';
import { learnCategory, lookupLearnedCategory, normalizeDescription, syncLearnedFromAccount, pushLearnedToAccount } from './learnedCategories.js';
import { resizeImageToJpeg } from './resizeImage.js';
import { EXPENSE_CATS, FIXED_CATS, INCOME_CATS, chartTheme } from '../categories.js';
import { useClientBudget } from '../budget/useClientBudget.js';
import { addItem } from '../budget/itemHelpers.js';
import { monthlyEquivalent } from '../budget/Subscriptions.jsx';
import { currentInstallments } from '../budget/Credit.jsx';
import MerchantRules from './MerchantRules.jsx';
import MappingTable from './MappingTable.jsx';
import MappingCalculators from './MappingCalculators.jsx';
import { labelOf, ANNUAL_CATEGORY, SAVINGS_CATEGORY, SAVINGS_KEYS, FIXED_KEYS, INCOME_TEMPLATE, SAVINGS_TEMPLATE, FIXED_TEMPLATE, VARIABLE_TEMPLATE } from './mappingTemplates.js';
import layout from './MappingLayout.module.css';

// The mapping's own savings-transfer category doesn't live in EXPENSE_CATS
// (that's a personal-budget list) — it needs to stay selectable here so a
// transaction the parser tagged this way doesn't fall off the dropdown.
const LOAN_CATEGORY = 'החזר הלוואות + חיוב קבוע';
const INSURANCE_MOVE_CATS = ['ביטוח חובה', 'ביטוח מקיף'];
const FOREIGN_ORDERS_CATEGORY = 'הזמנות מחו״ל';
const MAPPING_EXPENSE_CATS = [...EXPENSE_CATS.slice(0, -1), FOREIGN_ORDERS_CATEGORY, ...FIXED_KEYS.filter(c => !EXPENSE_CATS.includes(c)), 'שונות'];
const INCOME_ADD_CATS = [...INCOME_TEMPLATE.map(t => t.key), ...INCOME_CATS.filter(c => c !== 'אחר' && !INCOME_TEMPLATE.some(t => t.key === c))];
const FIXED_ADD_CATS = [...FIXED_TEMPLATE.map(t => t.key), ...FIXED_KEYS.filter(c => !FIXED_TEMPLATE.some(t => t.key === c))];
const VARIABLE_ADD_CATS = [...VARIABLE_TEMPLATE.map(t => t.key), ...MAPPING_EXPENSE_CATS.filter(c => !FIXED_KEYS.includes(c) && !SAVINGS_KEYS.includes(c) && !VARIABLE_TEMPLATE.some(t => t.key === c))];
import { supabase, SUPA_URL } from '../supabaseClient.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import CollapsibleSection from '../components/CollapsibleSection.jsx';

ChartJS.register(BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);
import { toast } from '../toast.js';
import styles from './EconomicMapping.module.css';
import { fmt } from '../format.js';

const MAX_DIM = 1500;
const CONCURRENCY = 3;

function monthOptions() {
  const now = new Date();
  const opts = [];
  for (let i = 0; i < 12; i++) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    opts.push({ value, label: `${dt.getMonth() + 1}/${dt.getFullYear()}` });
  }
  return [{ value: 'auto', label: 'זוהה אוטומטית' }, ...opts];
}

function monthLabel(dateStr) {
  if (!dateStr) return '';
  const [y, m] = dateStr.split('-');
  return `${Number(m)}/${y}`;
}

function monthEndDate(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// pdfjs-dist is only ever loaded here, on first PDF upload — a static top-level
// import would pay its bundle cost on every load of this lazy-loaded screen.
async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjsLib;
}

async function rasterizePdf(file, maxDim, onPage) {
  const pdfjsLib = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(3, maxDim / Math.max(unscaled.width, unscaled.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    pages.push({ data: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
    onPage?.(i, doc.numPages);
  }
  return pages;
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner));
  return results;
}

async function callParseStatement(page, monthHint) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(SUPA_URL + '/functions/v1/parse-statement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify({ image: page.data, mediaType: page.mediaType, monthHint })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error || 'שגיאה בעיבוד הקובץ');
  return body;
}

function pickCategory(t, type) {
  const fallback = type === 'income' ? 'אחר' : 'שונות';
  const fromModel = t.category || null;
  if (fromModel === SAVINGS_CATEGORY) return fromModel;
  if (type === 'income') return fromModel || categorizeByDictionary(t.desc, type) || fallback;
  return lookupLearnedCategory(t.desc) || categorizeByDictionary(t.desc, type) || fromModel || fallback;
}

async function processQueue(queue, setQueue) {
  const allTx = [];
  const finalItems = [];
  for (const item of queue) {
    setQueue(q => q.map(x => (x.id === item.id ? { ...x, status: 'rasterizing' } : x)));
    try {
      const pages = item.kind === 'pdf'
        ? await rasterizePdf(item.file, MAX_DIM, (n, total) => {
          setQueue(q => q.map(x => (x.id === item.id ? { ...x, status: `מעבד עמוד ${n}/${total}` } : x)));
        })
        : [await resizeImageToJpeg(item.file, MAX_DIM)];
      const monthHint = item.monthTag !== 'auto' ? item.monthTag : undefined;
      const pageResults = await runPool(pages, CONCURRENCY, async (page, idx) => {
        setQueue(q => q.map(x => (x.id === item.id ? { ...x, status: `שולח עמוד ${idx + 1}/${pages.length}` } : x)));
        return callParseStatement(page, monthHint);
      });
      for (const r of pageResults) {
        for (const t of (r.transactions || [])) {
          const sourceMonth = item.monthTag !== 'auto'
            ? item.monthTag
            : (t.date && /^\d{4}-\d{2}/.test(t.date) ? t.date.slice(0, 7) : null);
          if (!sourceMonth) continue;
          const type = t.type === 'income' ? 'income' : 'expense';
          allTx.push({
            date: t.date || null,
            desc: t.desc || '',
            amount: t.amount,
            type,
            category: pickCategory(t, type),
            source_month: sourceMonth
          });
        }
      }
      setQueue(q => q.map(x => (x.id === item.id ? { ...x, status: 'done' } : x)));
      finalItems.push({ ...item, status: 'done' });
    } catch (err) {
      const raw = String(err?.message || err);
      let message = raw;
      if (raw === 'Failed to fetch' || raw.includes('NetworkError')) message = 'שגיאת תקשורת, נסה שוב';
      else if (err?.name === 'PasswordException') message = 'המסמך מוגן בסיסמה. העלה עותק שאינו מוגן בסיסמה.';
      else if (err?.name === 'InvalidPDFException' || err?.name === 'MissingPDFException') message = 'קובץ המסמך פגום או אינו תקין. נסה להוריד אותו מחדש מהבנק ולהעלות שוב.';
      else if (!/[\u0590-\u05ff]/.test(raw)) message = 'לא ניתן לעבד את הקובץ. בדוק שהוא נפתח במכשיר ונסה להעלות אותו שוב.';
      setQueue(q => q.map(x => (x.id === item.id ? { ...x, status: 'error', error: message } : x)));
      finalItems.push({ ...item, status: 'error', error: message });
    }
  }
  return { allTx, finalItems };
}

const MAX_MONTHS = 3;

function addFiles(setQueue, fileList, defaultMonth, onDropped) {
  const added = Array.from(fileList).map(file => ({
    id: Date.now() + Math.random(),
    file,
    name: file.name,
    kind: file.type === 'application/pdf' ? 'pdf' : 'image',
    monthTag: defaultMonth,
    status: 'queued',
    error: null
  }));
  setQueue(q => {
    const room = Math.max(0, MAX_MONTHS - q.length);
    if (added.length > room && onDropped) onDropped(added.length - room);
    return [...q, ...added.slice(0, room)];
  });
}

// One teal family, darkest for the largest slice and lighter down the ranks, so the ring
// reads as an ordered list. The catch-all "אחר" slice is neutral grey, never a hue.
const DONUT_RAMP = ['#0b665d', '#157e73', '#2a978b', '#4aaea2', '#72c3b8', '#9bd5cc', '#bfe5df'];
const DONUT_OTHER = '#8b95a1';
function isDarkSurface(color) {
  const m = String(color).match(/#([0-9a-f]{6})/i);
  const rgb = m ? [0, 2, 4].map(k => parseInt(m[1].slice(k, k + 2), 16)) : (String(color).match(/\d+/g) || [255, 255, 255]).slice(0, 3).map(Number);
  return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 < 128;
}
function donutColor(items, i, dark) {
  if (items[i].name === 'אחר') return DONUT_OTHER;
  const ranked = items.filter(x => x.name !== 'אחר').length;
  const step = ranked <= 3 ? 2 : 1;
  const at = Math.min(i * step, DONUT_RAMP.length - 1);
  return dark ? DONUT_RAMP[DONUT_RAMP.length - 1 - at] : DONUT_RAMP[at];
}

const monthsLabel = n => (n === 1 ? 'חודש אחד' : `${n} חודשים`);

export default function EconomicMapping({ clientUserId, advisorId }) {
  const { data, loading, error, save, reload, markUploadFailure } = useEconomicMapping(clientUserId, advisorId);
  const { data: budgetData, save: saveBudget } = useClientBudget(clientUserId, advisorId);
  const [queue, setQueue] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmText, setConfirmText] = useState(null);
  const [confirmingRestoreIndex, setConfirmingRestoreIndex] = useState(null);
  const [linkForm, setLinkForm] = useState(null);
  const [linking, setLinking] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [flowPeriod, setFlowPeriod] = useState('month');
  const [donutView, setDonutView] = useState('cat');
  const [reviewOnly, setReviewOnly] = useState(false);
  const fileInputRef = useRef(null);
  const movingInsurance = useRef(false);
  const autoChecked = useRef(false);
  useEffect(() => {
    if (loading || !data || autoChecked.current) return;
    autoChecked.current = true;
    if (data.skip_auto) save({ ...data, skip_auto: false });
  }, [loading, data, save]);
  const opts = monthOptions();

  // Groups the mapping's recurring loan/savings transactions by description and
  // filters out any whose name already matches an existing loan/asset — only
  // genuinely new recurring items get surfaced for the advisor to act on.
  function recurringCandidates(category, existingNames) {
    if (!data?.transactions) return [];
    const totals = new Map();
    for (const t of data.transactions) {
      if (t.category !== category || t.excluded) continue;
      const key = (t.desc || '').trim() || 'ללא תיאור';
      totals.set(key, (totals.get(key) || 0) + (Number(t.amount) || 0));
    }
    const months = data.months_covered || 1;
    const lowerExisting = existingNames.map(n => (n || '').trim().toLowerCase()).filter(Boolean);
    return [...totals.entries()]
      .map(([desc, total]) => ({ desc, monthly: total / months }))
      .filter(x => !lowerExisting.some(n => x.desc.toLowerCase().includes(n) || n.includes(x.desc.toLowerCase())));
  }

  const isUnclassified = t => !t.category || t.category === 'שונות' || (t.type === 'income' && t.category === 'אחר');
  const manualItems = (data?.transactions || []).filter(t => t.manual);
  const hasStatements = (data?.transactions || []).some(t => !t.manual);
  const unclassifiedCount = (data?.transactions || []).filter(t => !t.manual && isUnclassified(t)).length;

  useEffect(() => {
    const moving = manualItems.filter(t => INSURANCE_MOVE_CATS.includes(t.category));
    if (!data || !budgetData || !moving.length || movingInsurance.current) return;
    movingInsurance.current = true;
    (async () => {
      for (const t of moving) {
        const ok = await addItem(saveBudget, 'insurances', { name: t.category, type: t.category, monthly: Number(t.amount) || 0 });
        if (ok === false) { movingInsurance.current = false; return; }
      }
      await saveManual(manualItems.filter(t => !INSURANCE_MOVE_CATS.includes(t.category)));
      toast('סכומי ביטוח חובה ומקיף הועברו לקטגוריית הביטוחים', 'success');
      movingInsurance.current = false;
    })();
  });

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) {
    return (
      <div>
        <Skeleton height="160px" radius="18px" style={{ marginBottom: 20 }} />
        <Skeleton height="240px" radius="18px" />
      </div>
    );
  }

  function pickFiles(fileList) {
    if (!fileList?.length) return;
    addFiles(setQueue, fileList, opts[1].value, dropped => {
      toast(`ניתן להעלות עד ${MAX_MONTHS} חודשים בבת אחת — ${dropped} קבצים לא נוספו`, 'error');
    });
  }

  function onDrop(e) {
    e.preventDefault();
    if (processing) return;
    pickFiles(e.dataTransfer.files);
  }

  function removeFile(id) {
    setQueue(q => q.filter(x => x.id !== id));
  }

  function setMonthTag(id, value) {
    setQueue(q => q.map(x => (x.id === id ? { ...x, monthTag: value } : x)));
  }

  async function process(confirmed) {
    if (!queue.length || processing) return;
    if (!confirmed) {
      const reasons = [];
      if (data?.transactions?.some(t => !t.manual)) reasons.push('קיים כבר מיפוי שמור עבור לקוח זה, העלאה חדשה תחליף אותו.');
      const taggedMonths = queue.map(x => x.monthTag).filter(m => m !== 'auto');
      const dupMonth = taggedMonths.find((m, i) => taggedMonths.indexOf(m) !== i);
      if (dupMonth) reasons.push(`יותר מקובץ אחד מסומן לאותו חודש (${dupMonth}).`);
      if (reasons.length) { setConfirmText(reasons.join(' ') + ' להמשיך?'); return; }
    }
    setConfirmText(null);
    setProcessing(true);
    await syncLearnedFromAccount(supabase);
    const { allTx: statementTx, finalItems } = await processQueue(queue, setQueue);
    if (!statementTx.length) {
      toast('לא זוהו תנועות בקבצים שהועלו', 'error');
      markUploadFailure(finalItems.filter(x => x.status === 'error').map(x => x.name));
      setProcessing(false);
      return;
    }
    // a file that finished without throwing but produced no transactions is more likely
    // a silent parse miss than a genuinely empty statement — flag it instead of saving quietly
    const allTx = [...statementTx, ...manualItems];
    const emptyFiles = queue.filter(x =>
      x.status === 'done' && x.monthTag !== 'auto' && !allTx.some(t => t.source_month === x.monthTag)
    );
    if (emptyFiles.length) toast(`שים לב: לא זוהו תנועות בקובץ ${emptyFiles.map(x => x.name).join(', ')}`, 'error');
    const { averages, monthsCovered } = computeCategoryAverages(allTx);
    const months = [...new Set(statementTx.map(t => t.source_month))].sort();
    // archive the mapping being replaced so the advisor can show the client how the
    // numbers moved between statement uploads, months later
    const snapshots = data?.transactions?.some(t => !t.manual)
      ? [...(data.snapshots || []), {
          period_start: data.period_start,
          period_end: data.period_end,
          transactions: data.transactions,
          saved_at: data.updated_at || new Date().toISOString()
        }].slice(-12)
      : (data?.snapshots || []);
    const failed = finalItems.filter(x => x.status === 'error');
    const ok = await save({
      period_start: `${months[0]}-01`,
      period_end: monthEndDate(months[months.length - 1]),
      transactions: allTx,
      category_averages: averages,
      months_covered: monthsCovered,
      snapshots,
      // clears any previously-flagged failure the moment a batch fully succeeds
      last_upload_error: failed.length ? failed.map(x => x.name).join(', ') : null,
      last_upload_at: failed.length ? new Date().toISOString() : null
    });
    setProcessing(false);
    if (ok !== false) {
      toast('המיפוי נשמר', 'success');
      // keep failed files visible instead of wiping them along with the successful
      // ones — otherwise a partial-batch failure disappears the moment the save succeeds
      setQueue(failed);
      if (failed.length) toast(`${failed.length} קבצים לא עובדו בהצלחה — ניתן להסיר או להעלות מחדש`, 'error');
    }
  }

  async function saveManual(nextItems) {
    const statementTx = (data?.transactions || []).filter(t => !t.manual);
    const transactions = [...statementTx, ...nextItems];
    const { averages, monthsCovered } = computeCategoryAverages(transactions);
    const now = new Date();
    const fallbackStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    await save({
      ...(data || {}),
      period_start: data?.period_start || fallbackStart,
      period_end: data?.period_end || fallbackStart,
      transactions,
      category_averages: averages,
      months_covered: monthsCovered
    });
  }

  async function resetMapping() {
    if (resetting || !data) return;
    if (!window.confirm('לאפס את כל המיפוי של הלקוח? כל הסכומים, דפי החשבון וההתאמות יימחקו, וגם הסכומים שנמשכים אוטומטית מהתקציב (ביטוחים, מנויים, חינוך ועוד) לא יוצגו. המיפוי הנוכחי יישמר תחת "מיפויים קודמים" וניתן לשחזר אותו משם.')) return;
    setResetting(true);
    const now = new Date();
    const fallbackStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const snapshots = (data.transactions || []).length
      ? [...(data.snapshots || []), {
          period_start: data.period_start,
          period_end: data.period_end,
          transactions: data.transactions,
          saved_at: data.updated_at || new Date().toISOString()
        }].slice(-12)
      : (data.snapshots || []);
    const ok = await save({
      period_start: fallbackStart,
      period_end: fallbackStart,
      transactions: [],
      category_averages: {},
      months_covered: 1,
      hidden_categories: [],
      extra_categories: [],
      category_labels: {},
      skip_auto: true,
      last_upload_error: null,
      last_upload_at: null,
      snapshots
    });
    setResetting(false);
    if (ok !== false) {
      setQueue([]);
      toast('המיפוי אופס', 'success');
    }
  }

  async function restoreAutoAmounts() {
    if (resetting || !data) return;
    setResetting(true);
    const ok = await save({ ...data, skip_auto: false });
    setResetting(false);
    if (ok !== false) toast('הסכומים מהתקציב חזרו למיפוי', 'success');
  }

  async function restoreSnapshot(index, confirmed) {
    if (restoring) return;
    const snap = data.snapshots[index];
    if (!snap) return;
    if (!confirmed) { setConfirmingRestoreIndex(index); return; }
    setConfirmingRestoreIndex(null);
    setRestoring(true);
    const { averages, monthsCovered } = computeCategoryAverages(snap.transactions);
    const archivedCurrent = {
      period_start: data.period_start,
      period_end: data.period_end,
      transactions: data.transactions,
      saved_at: data.updated_at || new Date().toISOString()
    };
    const snapshots = [
      ...data.snapshots.slice(0, index),
      ...data.snapshots.slice(index + 1),
      archivedCurrent
    ].slice(-12);
    const ok = await save({
      period_start: snap.period_start,
      period_end: snap.period_end,
      transactions: snap.transactions,
      category_averages: averages,
      months_covered: monthsCovered,
      snapshots
    });
    setRestoring(false);
    if (ok !== false) toast('המיפוי שוחזר', 'success');
  }

  async function reassignCategory(index, category) {
    const target = data.transactions[index];
    const merchant = normalizeDescription(target?.desc);
    const sameMerchant = (t, i) => i === index || (!target?.manual && !t.manual && target?.type !== 'income' && t.type !== 'income' && merchant.length >= 3 && normalizeDescription(t.desc) === merchant);
    const transactions = data.transactions.map((t, i) => (sameMerchant(t, i) ? { ...t, category } : t));
    const changed = transactions.filter((t, i) => t !== data.transactions[i]).length;
    if (target?.type !== 'income' && !target?.manual) {
      learnCategory(target?.desc, category);
      pushLearnedToAccount(supabase, target?.desc, category);
    }
    const { averages, monthsCovered } = computeCategoryAverages(transactions);
    // Deliberately NOT archiving a snapshot per edit here: this fires on every single
    // category-dropdown change, and the snapshots array is capped (see process()) —
    // a session of fixing several miscategorized transactions would flood the cap and
    // evict real monthly-upload history. Full-month uploads and restores archive; a
    // one-field correction doesn't need its own place in the before/after timeline.
    const ok = await save({
      period_start: data.period_start,
      period_end: data.period_end,
      transactions,
      category_averages: averages,
      months_covered: monthsCovered
    });
    if (ok !== false) toast(changed > 1 ? `הקטגוריה עודכנה ב-${changed} עסקאות של אותו בית עסק` : 'הקטגוריה עודכנה', 'success');
  }

  async function setCardChargesExcluded(excluded) {
    const transactions = data.transactions.map(t => (looksLikeCardCharge(t) ? { ...t, excluded } : t));
    const { averages, monthsCovered } = computeCategoryAverages(transactions);
    const ok = await save({
      period_start: data.period_start,
      period_end: data.period_end,
      transactions,
      category_averages: averages,
      months_covered: monthsCovered
    });
    if (ok !== false) toast(excluded ? 'חיובי האשראי לא נספרים יותר' : 'חיובי האשראי נספרים שוב', 'success');
  }

  async function linkToBudget(kind) {
    if (linking) return;
    const amount = parseFloat(linkForm.amount);
    if (!linkForm.name.trim() || !amount || amount <= 0) { toast(kind === 'loan' ? 'הזן שם ויתרה תקינה' : 'הזן שם וסכום תקין', 'error'); return; }
    setLinking(true);
    const ok = kind === 'loan'
      ? await addItem(saveBudget, 'loans', { name: linkForm.name.trim(), remaining: amount, monthly: linkForm.monthly })
      : await addItem(saveBudget, 'assets', { name: linkForm.name.trim(), category: 'חיסכון', amount });
    setLinking(false);
    if (ok === false) return;
    toast('עודכן בנכסים והתחייבויות', 'success');
    setLinkForm(null);
  }

  const loanCandidates = recurringCandidates(LOAN_CATEGORY, (budgetData?.loans || []).filter(l => !l.closed).map(l => l.name));
  const savingsCandidates = recurringCandidates(SAVINGS_CATEGORY, (budgetData?.assets || []).map(a => a.name));

  const categories = data?.category_averages
    ? Object.keys(data.category_averages).sort((a, b) => data.category_averages[b] - data.category_averages[a])
    : [];

  // Only meaningful once the advisor has uploaded full bank-account statements
  // (income lines included), not a credit-card-only mapping — those never
  // carry a `type`, so hasIncomeData stays false and this card stays hidden.
  const cardCharges = (data?.transactions || []).filter(looksLikeCardCharge);
  const cardChargesExcluded = cardCharges.length > 0 && cardCharges.every(t => t.excluded);
  const cardChargesTotal = cardCharges.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const monthlyOf = (list, key) => (list || []).reduce((s, x) => s + (Number(x[key]) || 0), 0);
  const autoFixedAmounts = budgetData && !data?.skip_auto ? {
    'משכנתא': mortgageMappingAmount(budgetData, data?.transactions || []),
    [LOAN_CATEGORY]: monthlyOf((budgetData.loans || []).filter(x => !x.closed && !x.hidden), 'monthly'),
    'עסקאות בתשלומים': (budgetData.payments || []).filter(x => !x.closed && !x.hidden && !((parseFloat(x.total) || 0) > 0 && (parseFloat(x.total) || 0) - currentInstallments(x, parseFloat(x.total) || 0) <= 0)).reduce((s, x) => s + (Number(x.amount) || 0), 0),
    'ביטוחים': monthlyOf((budgetData.insurances || []).filter(x => !x.closed), 'monthly'),
    'מנויים ושירותים': (budgetData.subscriptions || []).reduce((s, x) => s + (x.active ? monthlyEquivalent(x.cycle, x.amount || 0) : 0), 0),
    'חינוך, חוגים וקייטנות': monthlyOf(budgetData.education, 'monthly'),
    [ANNUAL_CATEGORY]: (budgetData.annualExpenses || []).reduce((s, x) => s + (Number(x.annual) || 0) / 12, 0)
  } : {};
  const autoFixedTx = Object.entries(autoFixedAmounts)
    .filter(([cat, amount]) => amount > 0 && !(data?.transactions || []).some(t => t.category === cat && !t.excluded))
    .map(([category, amount]) => ({ id: 'auto:' + category, auto: true, manual: true, type: 'expense', category, desc: '', amount: Math.round(amount), date: null, source_month: 'manual' }));
  const mathTransactions = [...(data?.transactions || []), ...autoFixedTx];
  const cashflow = computeCashflowSummary(mathTransactions);
  const mappingRows = computeMappingRows(mathTransactions);
  const savingsRows = mappingRows.expense.filter(r => SAVINGS_KEYS.includes(r.category));
  const fixedRows = mappingRows.expense.filter(r => FIXED_KEYS.includes(r.category));

  const fixedTransfer = Object.entries(fixedRows.reduce((acc, r) => {
    if (FIXED_CATS.includes(r.category) && r.amount > 0 && !r.auto) acc[r.category] = (acc[r.category] || 0) + r.amount;
    return acc;
  }, {})).map(([cat, amount]) => ({ cat, amount: Math.round(amount) })).filter(r => r.amount > 0);
  const fixedTransferTotal = fixedTransfer.reduce((sum, r) => sum + r.amount, 0);

  async function pushFixedToBudget() {
    if (!fixedTransfer.length || transferring) return;
    const existing = Object.fromEntries((budgetData?.fixed_expenses || []).map(x => [x.id, Number(x.amount) || 0]));
    const overwrites = fixedTransfer.filter(r => existing[r.cat] && existing[r.cat] !== r.amount).length;
    if (overwrites && !window.confirm('בתקציב כבר יש סכומים שונים ל-' + overwrites + ' מהקטגוריות. להחליף אותם בסכומים מהמיפוי?')) return;
    setTransferring(true);
    const ok = await saveBudget(cur => {
      const byId = Object.fromEntries((cur.fixed_expenses || []).map(x => [x.id, x]));
      const nextBudgets = { ...(cur.budgets || {}) };
      fixedTransfer.forEach(({ cat, amount }) => { byId[cat] = { ...(byId[cat] || {}), id: cat, amount }; nextBudgets[cat] = amount; });
      return { fixed_expenses: Object.values(byId), budgets: nextBudgets };
    });
    setTransferring(false);
    if (ok !== false) toast(fixedTransfer.length + ' הוצאות קבועות הועברו לתקציב', 'success');
  }
  const variableRows = mappingRows.expense.filter(r => !SAVINGS_KEYS.includes(r.category) && !FIXED_KEYS.includes(r.category));
  const addManual = type => (category, desc, amount) => saveManual([...manualItems, { id: Date.now() + Math.random(), manual: true, type, category, desc, amount, entries: [amount], date: null, source_month: 'manual' }]);
  const setManualAmount = (id, value) => {
    const amount = parseFloat(value);
    if (amount > 0) saveManual(manualItems.map(t => (t.id === id ? { ...t, amount, entries: [amount] } : t)));
    else if (String(value).trim() === '' || amount === 0) saveManual(manualItems.filter(t => t.id !== id));
  };
  const hiddenCats = data?.hidden_categories || [];
  const extraCats = data?.extra_categories || [];
  const saveCats = (hidden_categories, extra_categories) => {
    const now = new Date();
    const fallbackStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return save({
      ...(data || {}),
      period_start: data?.period_start || fallbackStart,
      period_end: data?.period_end || fallbackStart,
      transactions: data?.transactions || [],
      hidden_categories,
      extra_categories
    });
  };
  const labelsMap = data?.category_labels || {};
  const labelFor = cat => labelsMap[cat] || labelOf(cat);
  const renameCategory = (cat, name) => {
    const next = { ...labelsMap };
    if (name && name !== labelOf(cat)) next[cat] = name;
    else delete next[cat];
    const now = new Date();
    const fallbackStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return save({
      ...(data || {}),
      period_start: data?.period_start || fallbackStart,
      period_end: data?.period_end || fallbackStart,
      transactions: data?.transactions || [],
      category_labels: next
    });
  };
  const hideCategory = cat => saveCats([...new Set([...hiddenCats, cat])], extraCats.filter(c => c !== cat));
  const addBox = cat => saveCats(hiddenCats.filter(c => c !== cat), [...new Set([...extraCats, cat])]);
  const sumOf = list => list.reduce((a, b) => a + b, 0);
  const topUpManual = (id, value) => saveManual(manualItems.map(t => {
    if (t.id !== id) return t;
    const entries = [...(t.entries || [Number(t.amount) || 0]), value];
    return { ...t, entries, amount: sumOf(entries) };
  }));
  const removeManualEntry = (id, index) => {
    const t = manualItems.find(x => x.id === id);
    if (!t) return;
    const entries = (t.entries || [Number(t.amount) || 0]).filter((_, i) => i !== index);
    if (entries.length === 0) { saveManual(manualItems.filter(x => x.id !== id)); return; }
    saveManual(manualItems.map(x => (x.id === id ? { ...x, entries, amount: sumOf(entries) } : x)));
  };
  const renameManual = (id, name) => saveManual(manualItems.map(t => (t.id === id ? { ...t, name: name || undefined } : t)));
  const deleteManual = id => saveManual(manualItems.filter(t => t.id !== id));
  const deleteManualMany = ids => saveManual(manualItems.filter(t => !ids.includes(t.id)));
  const CT = chartTheme();
  // Prints the amount directly above each bar (like the advisor's Excel reference)
  // instead of leaving it only in the tooltip — no need for readable y-axis numbers then.
  const barValueLabels = {
    id: 'barValueLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      chart.data.datasets.forEach((dataset, i) => {
        const meta = chart.getDatasetMeta(i);
        meta.data.forEach((bar, j) => {
          const value = dataset.data[j];
          if (value == null) return;
          ctx.save();
          ctx.fillStyle = CT.text;
          ctx.font = '700 13px ' + CT.font;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(fmt(value), bar.x, bar.y - 6);
          ctx.restore();
        });
      });
    }
  };
  const donutItems = (() => {
    const avgs = computeCategoryAverages(mathTransactions).averages;
    const cats = Object.keys(avgs).filter(c => avgs[c] > 0).sort((a, b) => avgs[b] - avgs[a]);
    if (!cats.length) return [];
    if (donutView === 'type') {
      return computeExpenseTypeBreakdown(avgs);
    }
    const top = cats.slice(0, 7).map(c => ({ name: c, value: avgs[c] }));
    const rest = cats.slice(7).reduce((sum, c) => sum + avgs[c], 0);
    return rest > 0 ? [...top, { name: 'אחר', value: rest }] : top;
  })();
  const donutTotal = donutItems.reduce((sum, i) => sum + i.value, 0) || 1;
  const donutData = {
    labels: donutItems.map(i => i.name),
    datasets: [{ data: donutItems.map(i => i.value), backgroundColor: donutItems.map((_, i) => donutColor(donutItems, i, isDarkSurface(CT.surface))), borderColor: CT.surface, borderWidth: 2 }]
  };
  const donutOptions = {
    maintainAspectRatio: false,
    cutout: '62%',
    animation: ChartJS.defaults.animation === false ? false : { duration: 700, easing: 'easeOutQuart' },
    plugins: { legend: { display: false }, tooltip: { enabled: false } }
  };
  const periodMul = flowPeriod === 'year' ? 12 : 1;
  const actualChartData = cashflow ? {
    labels: ['הכנסות', 'הוצאות'],
    datasets: [{ data: [cashflow.income * periodMul, cashflow.expense * periodMul], backgroundColor: [CT.green, CT.red], hoverBackgroundColor: [CT.greenHover, CT.redHover], borderRadius: 6, barPercentage: 0.45, categoryPercentage: 0.9 }]
  } : null;
  const actualChartOptions = {
    maintainAspectRatio: false,
    layout: { padding: { top: 28 } },
    animation: ChartJS.defaults.animation === false ? false : { duration: 700, easing: 'easeOutQuart' },
    scales: {
      x: { reverse: true, ticks: { color: CT.text2, font: { family: CT.font, weight: '600' } }, grid: { display: false } },
      y: { display: false, beginAtZero: true, grid: { display: false } }
    },
    plugins: { legend: { display: false }, tooltip: { enabled: false } }
  };

  // compares the oldest archived mapping to the current one, so the advisor can show
  // the client how their cashflow moved between the first upload and now
  const firstSnapshot = data?.snapshots?.length ? data.snapshots[0] : null;
  const firstCashflow = firstSnapshot ? computeCashflowSummary(firstSnapshot.transactions) : null;
  const showComparison = !!(firstCashflow?.hasIncomeData && cashflow?.hasIncomeData);
  const comparisonChartData = showComparison ? {
    labels: [monthLabel(firstSnapshot.period_end), monthLabel(data.period_end)],
    datasets: [
      { label: 'הכנסה חודשית', data: [firstCashflow.income, cashflow.income], backgroundColor: CT.green, borderRadius: 5, hoverBackgroundColor: CT.greenHover, barPercentage: 0.6, categoryPercentage: 0.7 },
      { label: 'הוצאה', data: [firstCashflow.expense, cashflow.expense], backgroundColor: CT.red, borderRadius: 5, hoverBackgroundColor: CT.redHover, barPercentage: 0.6, categoryPercentage: 0.7 }
    ]
  } : null;

  return (
    <div>
      <section id="mapping-results" className={styles.card + ' ' + styles.cardStandalone}>
        <h2 className={styles.actualTitle}>המיפוי שלך</h2>
        <div className={styles.actualSub}>{hasStatements ? `התמונה המלאה: ממוצע חודשי · ${monthsLabel(cashflow.monthsCovered)} של דפי חשבון` : 'התמונה המלאה: סכומים חודשיים שהוזנו ידנית'}</div>
        <div className={layout.summaryGrid}>
          <div className={layout.box + ' ' + layout.comparisonPanel}>
            <h3 className={layout.boxTitle}>הכנסות מול הוצאות</h3>
            <div className={styles.actualChart} role="img" aria-label={`ביצוע: הכנסות ${fmt(cashflow.income * periodMul)}, הוצאות ${fmt(cashflow.expense * periodMul)}`}>
              <Bar aria-hidden="true" data={actualChartData} plugins={[barValueLabels]} options={actualChartOptions} />
            </div>
          </div>
          <div className={styles.flowBox + ' ' + layout.box + ' ' + layout.flowSummary}>
            <div className={styles.flowBoxHead}>
              <span className={styles.flowBoxTitle}>תזרים</span>
              <div className={styles.flowToggle} role="group" aria-label="תקופה">
                <button type="button" aria-pressed={flowPeriod === 'month'} className={flowPeriod === 'month' ? styles.flowToggleActive : ''} onClick={() => setFlowPeriod('month')}>חודשי</button>
                <button type="button" aria-pressed={flowPeriod === 'year'} className={flowPeriod === 'year' ? styles.flowToggleActive : ''} onClick={() => setFlowPeriod('year')}>שנתי</button>
              </div>
            </div>
            <div className={styles.cashflowRow}>
              <span className={styles.cashflowRowLabel}>בחשבון</span>
              <span className={styles.cashflowRowValue + (cashflow.netInAccount < 0 ? ' ' + styles.cashflowRowValueNeg : '')}>{fmt(cashflow.netInAccount * periodMul)}</span>
            </div>
            <div className={styles.cashflowRow}>
              <span className={styles.cashflowRowLabel}>בלי חיסכון</span>
              <span className={styles.cashflowRowValue + (cashflow.netExcludingSavings < 0 ? ' ' + styles.cashflowRowValueNeg : '')}>{fmt(cashflow.netExcludingSavings * periodMul)}</span>
            </div>
          </div>

          <div className={layout.box + ' ' + layout.breakdownPanel}>
            <div className={layout.boxHead}>
              <h3 className={layout.boxTitleInline}>לאן הולך הכסף</h3>
              <div className={styles.flowToggle} role="group" aria-label="חלוקה">
                <button type="button" aria-pressed={donutView === 'cat'} className={donutView === 'cat' ? styles.flowToggleActive : ''} onClick={() => setDonutView('cat')}>לפי קטגוריה</button>
                <button type="button" aria-pressed={donutView === 'type'} className={donutView === 'type' ? styles.flowToggleActive : ''} onClick={() => setDonutView('type')}>לפי סוג</button>
              </div>
            </div>
            {donutItems.length > 0 ? <div className={layout.breakdownBody}>
              <div className={styles.donut} role="img" aria-label={`התפלגות ההוצאות: ${donutItems.map(item => `${item.name}: ${fmt(item.value)}`).join(' · ')}`}>
                <Doughnut aria-hidden="true" data={donutData} options={donutOptions} />
                <div className={styles.donutCenter}>
                  <span className={styles.donutCenterLabel}>סה״כ לחודש</span>
                  <span className={styles.donutCenterValue}>{fmt(donutTotal)}</span>
                </div>
              </div>
              <ul className={layout.legend}>
                {donutItems.map((item, i) => (
                  <li key={item.name} className={layout.legendItem}>
                    <span className={layout.legendDot} style={{ background: donutColor(donutItems, i, isDarkSurface(CT.surface)) }} aria-hidden="true" />
                    <span className={layout.legendName}>{item.name}</span>
                    <span className={layout.legendPct}>{Math.round(item.value / donutTotal * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div> : <p className={layout.boxEmpty}>עוד אין כאן הוצאות להציג.</p>}
          </div>
        </div>
      </section>

      {data?.skip_auto && (
        <div className={styles.resetRow}>
          <span className={styles.resetNote}>הסכומים מהתקציב (הלוואות, תשלומים, ביטוחים, מנויים, חינוך, שנתיות ומשכנתא) מוסתרים כי איפסת את המיפוי.</span>
          <Button variant="ghost" onClick={restoreAutoAmounts} disabled={resetting}>החזר סכומים מהתקציב</Button>
        </div>
      )}

      <div className={layout.tables}>
        <MappingTable onRenameRow={renameManual} onTopUp={topUpManual} onRemoveEntry={removeManualEntry} title="הכנסות" note="סכום שמוזן ידנית הוא ל-3 החודשים האחרונים ומחולק ב-3" allowCustom quarterManual separateRows rows={mappingRows.income} template={INCOME_TEMPLATE} addLabel="מקור הכנסה" addCats={INCOME_ADD_CATS} hidden={hiddenCats} onHide={hideCategory} labelFor={labelFor} onAdd={addManual('income')} onAmount={setManualAmount} onDelete={deleteManual} onDeleteMany={deleteManualMany} />
        <MappingTable onRenameRow={renameManual} onTopUp={topUpManual} onRemoveEntry={removeManualEntry} title="חסכונות והשקעות" rows={savingsRows} template={SAVINGS_TEMPLATE} addLabel="שורה" addCats={SAVINGS_KEYS} hidden={hiddenCats} onHide={hideCategory} labelFor={labelFor} onAdd={addManual('expense')} onAmount={setManualAmount} onDelete={deleteManual} onDeleteMany={deleteManualMany} />
        <MappingTable onRenameRow={renameManual} onTopUp={topUpManual} onRemoveEntry={removeManualEntry} showTotal title="הוצאות חודשיות קבועות" rows={fixedRows} template={FIXED_TEMPLATE} addLabel="הוצאה קבועה" addCats={FIXED_ADD_CATS} hidden={hiddenCats} onHide={hideCategory} labelFor={labelFor} onAdd={addManual('expense')} onAmount={setManualAmount} onDelete={deleteManual} onDeleteMany={deleteManualMany} />
        <MappingTable showTotal title="הוצאות חודשיות משתנות" note="ממוצע חודשי. סכום שמוזן ידנית הוא ל-3 החודשים האחרונים ומחולק ב-3" rows={variableRows} template={VARIABLE_TEMPLATE} addLabel="קטגוריה" addCats={VARIABLE_ADD_CATS} allowCustom quarterManual hidden={hiddenCats} onHide={hideCategory} labelFor={labelFor} onAdd={addManual('expense')} onAmount={setManualAmount} onDelete={deleteManual} onDeleteMany={deleteManualMany} />
      </div>

      {((data?.transactions || []).length > 0 || autoFixedTx.length > 0) && (
        <div className={styles.resetRow}>
          {((data?.transactions || []).length > 0 || autoFixedTx.length > 0) && <Button variant="ghost" onClick={resetMapping} disabled={resetting}>{resetting ? 'מאפס…' : 'איפוס המיפוי'}</Button>}
        </div>
      )}

      {fixedTransfer.length > 0 && (
        <section className={styles.card + ' ' + styles.cardStandalone}>
          <h2 className={styles.cardTitle}>העברת הוצאות קבועות לתקציב</h2>
          <div className={styles.actualSub}>{fixedTransfer.length} קטגוריות קבועות · {fmt(fixedTransferTotal)} לחודש. הסכומים יועתקו לתקציב של הלקוח, ואפשר להמשיך לערוך אותם שם. ההוצאות המשתנות לא מועברות.</div>
          <Button onClick={pushFixedToBudget} disabled={transferring}>{transferring ? 'מעביר…' : 'העבר לתקציב'}</Button>
        </section>
      )}

      <details className={styles.mappingDetails}>
        <summary><span>מחשבוני הוצאות משתנות</span><small>הזנה ידנית ופירוט לפי קטגוריה</small></summary>
      <MappingCalculators categories={VARIABLE_ADD_CATS.slice(0, VARIABLE_TEMPLATE.length)} addCats={VARIABLE_ADD_CATS} rows={variableRows} hidden={hiddenCats} extra={extraCats} labelFor={labelFor} onRename={renameCategory} onAdd={addManual('expense')} onDelete={deleteManual} onAddBox={addBox} onRemoveBox={hideCategory} />
      </details>

      <div className={styles.card}>
        <h2 id="mapping-upload" className={styles.cardTitle}>העלאת דפי חשבון</h2>
        <div className={styles.dropZone} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={e => { pickFiles(e.target.files); e.target.value = ''; }}
            disabled={processing || queue.length >= MAX_MONTHS}
          />
          <label
            className={styles.dropLabel}
            role="button"
            tabIndex={processing || queue.length >= MAX_MONTHS ? -1 : 0}
            onClick={() => !processing && queue.length < MAX_MONTHS && fileInputRef.current?.click()}
            onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !processing && queue.length < MAX_MONTHS) { e.preventDefault(); fileInputRef.current?.click(); } }}
          >
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 15V3M7 8l5-5 5 5" />
              <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
            </svg>
            <span>גרור עד {MAX_MONTHS} חודשי דפי חשבון — 3 החודשים האחרונים (PDF או תמונות) או לחץ לבחירה</span>
            <span className={styles.dropHint}>כל קובץ מיוצג בנפרד — סמן לאיזה חודש קלנדרי הוא שייך.</span>
          </label>
        </div>

        {queue.length > 0 && (
          <div className={styles.queue}>
            {queue.map(item => (
              <div key={item.id} className={styles.queueRow}>
                <span className={styles.queueName} title={item.name}>{item.name}</span>
                <select className={styles.monthSelect} aria-label={'חודש המסמך: ' + item.name} value={item.monthTag} onChange={e => setMonthTag(item.id, e.target.value)} disabled={processing}>
                  {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span
                  className={styles.statusChip + ' ' + (item.status === 'error' ? styles.statusError : item.status === 'done' ? styles.statusDone : '')}
                  title={item.status === 'error' ? item.error : undefined}
                >
                  {item.status === 'queued' ? 'ממתין'
                    : item.status === 'rasterizing' ? 'ממיר לתמונות'
                    : item.status === 'done' ? 'הושלם'
                    : item.status === 'error' ? 'שגיאה'
                    : item.status}
                </span>
                {(item.status === 'queued' || item.status === 'error') && <DeleteButton onClick={() => removeFile(item.id)} />}
                {item.status === 'error' && item.error && <span className={styles.queueErrorMsg}>{item.error}</span>}
              </div>
            ))}
          </div>
        )}

        {confirmText && (
          <div className={styles.confirmBanner}>
            <span>{confirmText}</span>
            <div className={styles.confirmBannerActions}>
              <Button onClick={() => process(true)}>כן, המשך</Button>
              <Button variant="ghost" onClick={() => setConfirmText(null)}>ביטול</Button>
            </div>
          </div>
        )}
        <div className={styles.actions}>
          <Button onClick={() => process(false)} disabled={!queue.length || processing}>{processing ? 'מעבד…' : 'עבד וחשב מיפוי'}</Button>
        </div>
      </div>

      {categories.length > 0 && (
        <div className={styles.card + ' ' + styles.cardStandalone}>
          <h2 className={styles.cardTitle}>בדיקה ועריכת תנועות</h2>
          <div className={styles.coverageNote}>מבוסס על {monthsLabel(data.months_covered)} שהועלו</div>

          {cardCharges.length > 0 && (
            <div className={styles.coverageNote}>
              {cardChargesExcluded
                ? `${cardCharges.length} חיובי כרטיס אשראי מדף הבנק (${fmt(cardChargesTotal)}) לא נספרים, כדי לא לספור פעמיים הוצאות שמופיעות בפירוט האשראי.`
                : `זוהו ${cardCharges.length} חיובי כרטיס אשראי בדף הבנק (${fmt(cardChargesTotal)}). אם העלית גם את פירוט האשראי, ההוצאות האלה נספרות פעמיים.`}
              <button type="button" className={styles.toggle} onClick={() => setCardChargesExcluded(!cardChargesExcluded)}>
                {cardChargesExcluded ? 'ספור אותם שוב' : 'אל תספור אותם'}
              </button>
            </div>
          )}

          {unclassifiedCount > 0 && (
            <button type="button" className={styles.toggle} onClick={() => { setReviewOnly(v => !v); setExpanded(true); }}>
              {reviewOnly ? 'הצג את כל התנועות' : `${unclassifiedCount} תנועות ללא סיווג - לחץ לבדיקה`}
            </button>
          )}

          <button type="button" className={styles.toggle} onClick={() => setExpanded(v => !v)}>
            {expanded ? 'הסתר תנועות גולמיות' : `הצג ${data.transactions.length} תנועות גולמיות`}
          </button>

          {expanded && (
            <div className={styles.list}>
              {data.transactions.map((t, i) => (reviewOnly && !isUnclassified(t) ? null : (
                <div key={i} className={styles.txRow}>
                  <span className={styles.txDate}>{t.date || '—'}</span>
                  <span className={styles.txDesc} title={t.desc}>{t.desc}{t.excluded ? ' (לא נספר)' : ''}</span>
                  <select className={styles.txCat} value={t.category || (t.type === 'income' ? 'אחר' : 'שונות')} onChange={e => reassignCategory(i, e.target.value)}>
                    {(t.type === 'income' ? INCOME_CATS : MAPPING_EXPENSE_CATS).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span className={styles.txAmt + (t.type === 'income' ? ' ' + styles.txAmtIncome : '')}>{t.type === 'income' ? '+' : ''}{fmt(t.amount)}</span>
                </div>
              )))}
            </div>
          )}
        </div>
      )}

      {(loanCandidates.length > 0 || savingsCandidates.length > 0) && (
        <div className={styles.card + ' ' + styles.cardStandalone}>
          <div className={styles.cardTitle}>עדכון נכסים והתחייבויות מהמיפוי</div>
          <div className={styles.coverageNote}>תנועות קבועות שזוהו במיפוי ואינן משויכות עדיין לנכס או להתחייבות קיימים</div>
          <div className={styles.linkList}>
            {loanCandidates.map(c => (
              <div key={'loan-' + c.desc} className={styles.linkRow}>
                <div>
                  <div className={styles.linkDesc}>{c.desc}</div>
                  <div className={styles.linkMeta}>החזר חודשי {fmt(c.monthly)} · יתווסף כהתחייבות</div>
                </div>
                {linkForm?.desc === c.desc ? (
                  <div className={styles.linkForm}>
                    <input className={styles.input} placeholder="שם ההתחייבות" aria-label="שם ההתחייבות" value={linkForm.name} onChange={e => setLinkForm({ ...linkForm, name: e.target.value })} />
                    <input className={styles.input} type="number" inputMode="decimal" placeholder="יתרה נוכחית" aria-label="יתרה נוכחית" value={linkForm.amount} onChange={e => setLinkForm({ ...linkForm, amount: e.target.value })} onKeyDown={e => e.key === 'Enter' && linkToBudget('loan')} />
                    <Button onClick={() => linkToBudget('loan')} disabled={linking}>שמור</Button>
                    <Button variant="ghost" onClick={() => setLinkForm(null)}>ביטול</Button>
                  </div>
                ) : (
                  <Button variant="ghost" className={styles.addBtn} onClick={() => setLinkForm({ desc: c.desc, name: c.desc, monthly: c.monthly, amount: '' })}>עדכן</Button>
                )}
              </div>
            ))}
            {savingsCandidates.map(c => (
              <div key={'saving-' + c.desc} className={styles.linkRow}>
                <div>
                  <div className={styles.linkDesc}>{c.desc}</div>
                  <div className={styles.linkMeta}>הוראת קבע {fmt(c.monthly)} לחודש · יתווסף כנכס בקטגוריית חיסכון</div>
                </div>
                {linkForm?.desc === c.desc ? (
                  <div className={styles.linkForm}>
                    <input className={styles.input} placeholder="שם הנכס" aria-label="שם הנכס" value={linkForm.name} onChange={e => setLinkForm({ ...linkForm, name: e.target.value })} />
                    <input className={styles.input} type="number" inputMode="decimal" placeholder="שווי נוכחי" aria-label="שווי נוכחי" value={linkForm.amount} onChange={e => setLinkForm({ ...linkForm, amount: e.target.value })} onKeyDown={e => e.key === 'Enter' && linkToBudget('asset')} />
                    <Button onClick={() => linkToBudget('asset')} disabled={linking}>שמור</Button>
                    <Button variant="ghost" onClick={() => setLinkForm(null)}>ביטול</Button>
                  </div>
                ) : (
                  <Button variant="ghost" className={styles.addBtn} onClick={() => setLinkForm({ desc: c.desc, name: c.desc, monthly: c.monthly, amount: '' })}>עדכן</Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.snapshots?.length > 0 && (
        <div className={styles.card + ' ' + styles.cardStandalone}>
          <CollapsibleSection title="מיפויים קודמים">
          <div className={styles.list}>
            {data.snapshots.map((s, i) => (
              <div key={i} className={styles.txRow}>
                <span className={styles.txDate}>{monthLabel(s.period_start)}–{monthLabel(s.period_end)}</span>
                <span className={styles.txDesc}>{s.saved_at ? new Date(s.saved_at).toLocaleDateString('he-IL') : ''}</span>
                {confirmingRestoreIndex === i ? (
                  <div className={styles.confirmBannerActions}>
                    <Button onClick={() => restoreSnapshot(i, true)}>אשר שחזור</Button>
                    <Button variant="ghost" onClick={() => setConfirmingRestoreIndex(null)}>ביטול</Button>
                  </div>
                ) : (
                  <Button variant="ghost" disabled={restoring} onClick={() => restoreSnapshot(i, false)}>שחזר</Button>
                )}
              </div>
            ))}
          </div>
          </CollapsibleSection>
        </div>
      )}

      {showComparison && (
        <div className={styles.card + ' ' + styles.cardStandalone}>
          <CollapsibleSection title="השוואת תזרים: תחילת התהליך מול היום">
          <div className={styles.coverageNote}>{monthLabel(firstSnapshot.period_end)} מול {monthLabel(data.period_end)}</div>

          <div className={styles.cashflowChart}>
            <Bar
              aria-label={`השוואת תזרים: ${comparisonChartData.datasets.map(series => `${series.label}: ${series.data.map(fmt).join(' לעומת ')}`).join(' · ')}`}
              data={comparisonChartData}
              plugins={[barValueLabels]}
              options={{
                maintainAspectRatio: false,
                layout: { padding: { top: 20 } },
                animation: ChartJS.defaults.animation === false ? false : { duration: 700, easing: 'easeOutQuart' },
                scales: {
                  x: { ticks: { color: CT.text2, font: { family: CT.font } }, grid: { display: false } },
                  y: { ticks: { display: false }, grid: { color: CT.border } }
                },
                plugins: {
                  legend: { labels: { color: CT.text2, font: { family: CT.font } } },
                  tooltip: { backgroundColor: CT.surface, titleColor: CT.text, bodyColor: CT.text2, borderColor: CT.border, borderWidth: 1, padding: 10, titleFont: { family: CT.font }, bodyFont: { family: CT.font } }
                }
              }}
            />
          </div>

          <div className={styles.cashflowRows}>
            <div className={styles.cashflowRow}>
              <span className={styles.cashflowRowLabel}>תזרים נטו בתחילת התהליך</span>
              <span className={styles.cashflowRowValue + (firstCashflow.netInAccount < 0 ? ' ' + styles.cashflowRowValueNeg : '')}>{fmt(firstCashflow.netInAccount)}</span>
            </div>
            <div className={styles.cashflowRow}>
              <span className={styles.cashflowRowLabel}>תזרים נטו היום</span>
              <span className={styles.cashflowRowValue + (cashflow.netInAccount < 0 ? ' ' + styles.cashflowRowValueNeg : '')}>{fmt(cashflow.netInAccount)}</span>
            </div>
          </div>
          </CollapsibleSection>
        </div>
      )}

      <MerchantRules />
    </div>
  );
}
