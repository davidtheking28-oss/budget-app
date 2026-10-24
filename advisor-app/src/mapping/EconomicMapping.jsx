import { useRef, useState } from 'react';
import { Chart as ChartJS, BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useEconomicMapping } from './useEconomicMapping.js';
import { computeCategoryAverages, computeCashflowSummary, looksLikeCardCharge, computeExpenseTypeBreakdown, computeMappingRows } from './mappingMath.js';
import { categorizeByDictionary } from './categorizeDict.js';
import { learnCategory, lookupLearnedCategory, normalizeDescription, syncLearnedFromAccount, pushLearnedToAccount } from './learnedCategories.js';
import { resizeImageToJpeg } from './resizeImage.js';
import { EXPENSE_CATS, FIXED_CATS, INCOME_CATS, CHART_PALETTE, chartTheme } from '../categories.js';
import { useClientBudget } from '../budget/useClientBudget.js';
import { addItem } from '../budget/itemHelpers.js';
import MerchantRules from './MerchantRules.jsx';
import MappingTable from './MappingTable.jsx';
import MappingCalculators from './MappingCalculators.jsx';
import layout from './MappingLayout.module.css';

// The mapping's own savings-transfer category doesn't live in EXPENSE_CATS
// (that's a personal-budget list) — it needs to stay selectable here so a
// transaction the parser tagged this way doesn't fall off the dropdown.
const SAVINGS_CATEGORY = 'הוראת קבע לחסכון';
const LOAN_CATEGORY = 'החזר הלוואות + חיוב קבוע';
const FOREIGN_ORDERS_CATEGORY = 'הזמנות מחו״ל';
const MAPPING_EXPENSE_CATS = [...EXPENSE_CATS.slice(0, -1), FOREIGN_ORDERS_CATEGORY, ...FIXED_CATS.filter(c => !EXPENSE_CATS.includes(c)), 'שונות'];
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
import { formatDate } from '../budget/monthUtils.js';
import { getCategoryIcon } from '../categoryIcons.jsx';

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
      const message = raw === 'Failed to fetch' || raw.includes('NetworkError') ? 'שגיאת תקשורת, נסה שוב' : raw;
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

const monthsLabel = n => (n === 1 ? 'חודש אחד' : `${n} חודשים`);

const VIEW_PILLS = [
  { label: 'כרטיסי אשראי', nav: 'credit' },
  { label: 'חובות והלוואות', nav: 'credit' },
  { label: 'משכנתא', nav: 'mortgage' },
  { label: 'תשלומים', nav: 'credit' },
  { label: 'ביטוחים · שנתיות · מנויים · חינוך', nav: 'subs' }
];

export default function EconomicMapping({ clientUserId, advisorId, onNavigate }) {
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
  const [flowPeriod, setFlowPeriod] = useState('month');
  const [donutView, setDonutView] = useState('cat');
  const [openCat, setOpenCat] = useState(null);
  const [reviewOnly, setReviewOnly] = useState(false);
  const fileInputRef = useRef(null);
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
  const fixedCats = categories.filter(c => FIXED_CATS.includes(c));
  const variableCats = categories.filter(c => !FIXED_CATS.includes(c));
  const fixedTotal = fixedCats.reduce((s, c) => s + data.category_averages[c], 0);
  const variableTotal = variableCats.reduce((s, c) => s + data.category_averages[c], 0);

  // Only meaningful once the advisor has uploaded full bank-account statements
  // (income lines included), not a credit-card-only mapping — those never
  // carry a `type`, so hasIncomeData stays false and this card stays hidden.
  const cardCharges = (data?.transactions || []).filter(looksLikeCardCharge);
  const cardChargesExcluded = cardCharges.length > 0 && cardCharges.every(t => t.excluded);
  const cardChargesTotal = cardCharges.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const cashflow = computeCashflowSummary(data?.transactions || []);
  const mappingRows = computeMappingRows(data?.transactions || []);
  const savingsRows = mappingRows.expense.filter(r => r.category === SAVINGS_CATEGORY);
  const fixedRows = mappingRows.expense.filter(r => r.category !== SAVINGS_CATEGORY && FIXED_CATS.includes(r.category));
  const variableRows = mappingRows.expense.filter(r => !FIXED_CATS.includes(r.category));
  const addManual = type => (category, desc, amount) => saveManual([...manualItems, { id: Date.now() + Math.random(), manual: true, type, category, desc, amount, date: null, source_month: 'manual' }]);
  const setManualAmount = (id, value) => {
    const amount = parseFloat(value);
    if (amount > 0) saveManual(manualItems.map(t => (t.id === id ? { ...t, amount } : t)));
  };
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
    if (!categories.length) return [];
    if (donutView === 'type') {
      return computeExpenseTypeBreakdown(data.category_averages);
    }
    const top = categories.slice(0, 7).map(c => ({ name: c, value: data.category_averages[c] }));
    const rest = categories.slice(7).reduce((sum, c) => sum + data.category_averages[c], 0);
    return rest > 0 ? [...top, { name: 'אחר', value: rest }] : top;
  })();
  const donutTotal = donutItems.reduce((sum, i) => sum + i.value, 0) || 1;
  const donutData = {
    labels: donutItems.map(i => i.name),
    datasets: [{ data: donutItems.map(i => i.value), backgroundColor: donutItems.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]), borderColor: CT.surface, borderWidth: 2 }]
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
      <nav className={styles.viewPills} aria-label="תצוגות המיפוי">
        <button type="button" className={styles.viewPillOn} aria-current="page">תצוגה ראשית</button>
        {VIEW_PILLS.map(v => <button type="button" key={v.label} className={styles.viewPill} onClick={() => onNavigate?.(v.nav)}>{v.label}</button>)}
        <a className={styles.viewPill} href="#mapping-upload">העלאת מסמכים</a>
      </nav>
      <section id="mapping-results" className={styles.card + ' ' + styles.cardStandalone}>
        <h2 className={styles.actualTitle}>המיפוי שלך</h2>
        <div className={styles.actualSub}>{hasStatements ? `התמונה המלאה: ממוצע חודשי · ${monthsLabel(cashflow.monthsCovered)} של דפי חשבון` : 'התמונה המלאה: סכומים חודשיים שהוזנו ידנית'}</div>
        <div className={layout.summaryGrid}>
          <div className={layout.box}>
            <div className={styles.actualChart} role="img" aria-label={`ביצוע: הכנסות ${fmt(cashflow.income * periodMul)}, הוצאות ${fmt(cashflow.expense * periodMul)}`}>
              <Bar data={actualChartData} plugins={[barValueLabels]} options={actualChartOptions} />
            </div>
          </div>
          <div className={styles.flowBox + ' ' + layout.box}>
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

          <div className={layout.box}>
            <div className={styles.actualTitle}>לאן הולך הכסף</div>
            <div className={styles.actualSub}>כך מתחלקת ההוצאה החודשית הממוצעת בין הקטגוריות</div>
            <div className={styles.flowToggle} role="group" aria-label="חלוקה">
              <button type="button" aria-pressed={donutView === 'cat'} className={donutView === 'cat' ? styles.flowToggleActive : ''} onClick={() => setDonutView('cat')}>לפי קטגוריה</button>
              <button type="button" aria-pressed={donutView === 'type'} className={donutView === 'type' ? styles.flowToggleActive : ''} onClick={() => setDonutView('type')}>לפי סוג</button>
            </div>
            {donutItems.length > 0 && (
              <p className={styles.donutInsight}>
                {donutView === 'cat'
                  ? `הקטגוריה הגדולה ביותר היא ${donutItems[0].name}, עם ${Math.round(donutItems[0].value / donutTotal * 100)}% מההוצאות.${donutItems.length > 2 ? ` שלוש הקטגוריות הגדולות יחד הן ${Math.round(donutItems.slice(0, 3).reduce((sum, i) => sum + i.value, 0) / donutTotal * 100)}% מהכסף שיוצא.` : ''}`
                  : donutItems.map(i => `${i.name}: ${Math.round(i.value / donutTotal * 100)}%`).join(' · ')}
              </p>
            )}
              {donutItems.length === 0 && <p className={layout.boxEmpty}>עוד אין כאן הוצאות להציג.</p>}
          <div className={styles.donutWrap}>
              <div className={styles.donut} role="img" aria-label="התפלגות ההוצאות">
                <Doughnut data={donutData} options={donutOptions} />
                <div className={styles.donutCenter}>
                  <span className={styles.donutCenterLabel}>סה״כ לחודש</span>
                  <span className={styles.donutCenterValue}>{fmt(donutTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={layout.tables}>
        <MappingTable title="הכנסות" rows={mappingRows.income} addLabel="מקור הכנסה" addCats={INCOME_CATS} onAdd={addManual('income')} onAmount={setManualAmount} onDelete={deleteManual} onDeleteMany={deleteManualMany} />
        <MappingTable title="חסכונות והשקעות" rows={savingsRows} addLabel="שורה" addCats={[SAVINGS_CATEGORY]} onAdd={addManual('expense')} onAmount={setManualAmount} onDelete={deleteManual} onDeleteMany={deleteManualMany} />
        <MappingTable title="הוצאות חודשיות קבועות" rows={fixedRows} addLabel="הוצאה קבועה" addCats={FIXED_CATS.filter(c => c !== SAVINGS_CATEGORY)} onAdd={addManual('expense')} onAmount={setManualAmount} onDelete={deleteManual} onDeleteMany={deleteManualMany} />
        <MappingTable title="הוצאות חודשיות משתנות" note="ממוצע מדפי החשבון, ואפשר להוסיף סכומים ידנית" rows={variableRows} addLabel="קטגוריה" addCats={MAPPING_EXPENSE_CATS.filter(c => !FIXED_CATS.includes(c))} onAdd={addManual('expense')} onAmount={setManualAmount} onDelete={deleteManual} onDeleteMany={deleteManualMany} />
      </div>

      <MappingCalculators categories={MAPPING_EXPENSE_CATS.filter(c => !FIXED_CATS.includes(c))} rows={variableRows} onAdd={addManual('expense')} />

      <div className={styles.workflow} aria-label="שלבי המיפוי הכלכלי">
        <div><strong>1 · העלאת מסמכים</strong><span>בחר דפי חשבון ושייך כל קובץ לחודש המתאים</span></div>
        <div aria-live="polite"><strong>2 · עיבוד הנתונים</strong><span>{processing ? 'המסמכים בעיבוד…' : 'לאחר הבחירה, לחץ על עבד וחשב מיפוי'}</span></div>
        <div><strong>3 · סקירת המיפוי</strong><span>בדוק את התוצאות לפני עדכון התקציב</span></div>
      </div>

      {categories.length > 0 && (
        <div className={styles.card + ' ' + styles.cardStandalone + ' ' + styles.breakdownCard}>
          <div className={styles.breakdownHead}>
            <div>
              <h2 className={styles.actualTitle}>פירוט ההוצאות לפי קטגוריה</h2>
              <div className={styles.actualSub}>ממוצע חודשי · {monthsLabel(data.months_covered)} של דפי חשבון · לחיצה על קטגוריה מציגה את העסקאות שלה</div>
            </div>
            <div className={styles.breakdownTotal}>
              <span>סה״כ הוצאות לחודש</span>
              <strong>{fmt(fixedTotal + variableTotal)}</strong>
            </div>
          </div>
          {[['הוצאות קבועות', fixedCats, fixedTotal], ['הוצאות משתנות', variableCats, variableTotal]].filter(([, list]) => list.length > 0).map(([groupTitle, list, groupTotal]) => {
            const grand = fixedTotal + variableTotal || 1;
            const maxAvg = Math.max(...list.map(c => data.category_averages[c]), 1);
            return (
              <section className={styles.catGroup} key={groupTitle}>
                <div className={styles.catGroupHead}>
                  <h3>{groupTitle}</h3>
                  <span>{fmt(groupTotal)} · {Math.round(groupTotal / grand * 100)}% מההוצאות</span>
                </div>
                <ul className={styles.catList}>
                  {list.map(c => {
                    const avg = data.category_averages[c];
                    const idx = categories.indexOf(c);
                    const color = idx < CHART_PALETTE.length ? CHART_PALETTE[idx] : 'var(--text3)';
                    const isOpen = openCat === c;
                    const txs = isOpen
                      ? (data.transactions || []).filter(t => t.type !== 'income' && !t.excluded && t.category === c).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
                      : [];
                    return (
                      <li key={c}>
                        <button type="button" className={styles.catRow} aria-expanded={isOpen} onClick={() => setOpenCat(isOpen ? null : c)}>
                          <span className={styles.catDot} style={{ background: color }} aria-hidden="true" />
                          <span className={styles.catIcon} aria-hidden="true">{getCategoryIcon(c)}</span>
                          <span className={styles.catName}>{c}</span>
                          <span className={styles.catBar} aria-hidden="true"><span style={{ width: (avg / maxAvg * 100) + '%', background: color }} /></span>
                          <span className={styles.catPct}>{Math.round(avg / grand * 100)}%</span>
                          <span className={styles.catAmt}>{fmt(avg)}</span>
                          <span className={styles.catChev + (isOpen ? ' ' + styles.catChevOpen : '')} aria-hidden="true">‹</span>
                        </button>
                        {isOpen && (
                          <div className={styles.catTx}>
                            {txs.length === 0 ? <div className={styles.catTxEmpty}>אין עסקאות להצגה</div> : txs.map((t, i) => (
                              <div className={styles.catTxRow} key={i}>
                                <span className={styles.catTxDate}>{t.date ? formatDate(t.date) : '—'}</span>
                                <span className={styles.catTxDesc}>{t.desc || '—'}</span>
                                <span className={styles.catTxAmt}>{fmt(Number(t.amount) || 0)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

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
                <select className={styles.monthSelect} value={item.monthTag} onChange={e => setMonthTag(item.id, e.target.value)} disabled={processing}>
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
          <CollapsibleSection title="היסטוריית מיפויים">
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
