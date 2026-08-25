import { useRef, useState } from 'react';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useEconomicMapping } from './useEconomicMapping.js';
import { computeCategoryAverages, computeCashflowSummary } from './mappingMath.js';
import { resizeImageToJpeg } from './resizeImage.js';
import { EXPENSE_CATS, INCOME_CATS, catColor, chartTheme } from '../categories.js';

// The mapping's own savings-transfer category doesn't live in EXPENSE_CATS
// (that's a personal-budget list) — it needs to stay selectable here so a
// transaction the parser tagged this way doesn't fall off the dropdown.
const SAVINGS_CATEGORY = 'הוראת קבע לחסכון';
const MAPPING_EXPENSE_CATS = [...EXPENSE_CATS, SAVINGS_CATEGORY];
import { supabase, SUPA_URL } from '../supabaseClient.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);
import { toast } from '../toast.js';
import styles from './EconomicMapping.module.css';

const MAX_DIM = 1500;
const CONCURRENCY = 3;

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

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
  if (!res.ok || body.error) throw new Error(body.error || 'request_failed');
  return body;
}

async function processQueue(queue, setQueue) {
  const allTx = [];
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
            category: t.category || (type === 'income' ? 'אחר' : 'שונות'),
            source_month: sourceMonth
          });
        }
      }
      setQueue(q => q.map(x => (x.id === item.id ? { ...x, status: 'done' } : x)));
    } catch (err) {
      setQueue(q => q.map(x => (x.id === item.id ? { ...x, status: 'error', error: String(err?.message || err) } : x)));
    }
  }
  return allTx;
}

function addFiles(setQueue, fileList, defaultMonth) {
  const added = Array.from(fileList).map(file => ({
    id: Date.now() + Math.random(),
    file,
    name: file.name,
    kind: file.type === 'application/pdf' ? 'pdf' : 'image',
    monthTag: defaultMonth,
    status: 'queued',
    error: null
  }));
  setQueue(q => [...q, ...added]);
}

export default function EconomicMapping({ clientUserId, advisorId }) {
  const { data, loading, error, save, reload } = useEconomicMapping(clientUserId, advisorId);
  const [queue, setQueue] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef(null);
  const opts = monthOptions();

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
    addFiles(setQueue, fileList, opts[1].value);
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

  async function process() {
    if (!queue.length || processing) return;
    if (data?.transactions?.length &&
      !window.confirm('קיים כבר מיפוי שמור עבור לקוח זה. העלאה חדשה תחליף אותו. להמשיך?')) return;
    const taggedMonths = queue.map(x => x.monthTag).filter(m => m !== 'auto');
    const dupMonth = taggedMonths.find((m, i) => taggedMonths.indexOf(m) !== i);
    if (dupMonth && !window.confirm(`יותר מקובץ אחד מסומן לאותו חודש (${dupMonth}). להמשיך בכל זאת?`)) return;
    setProcessing(true);
    const allTx = await processQueue(queue, setQueue);
    if (!allTx.length) {
      toast('לא זוהו תנועות בקבצים שהועלו', 'error');
      setProcessing(false);
      return;
    }
    // a file that finished without throwing but produced no transactions is more likely
    // a silent parse miss than a genuinely empty statement — flag it instead of saving quietly
    const emptyFiles = queue.filter(x =>
      x.status === 'done' && x.monthTag !== 'auto' && !allTx.some(t => t.source_month === x.monthTag)
    );
    if (emptyFiles.length) toast(`שים לב: לא זוהו תנועות בקובץ ${emptyFiles.map(x => x.name).join(', ')}`, 'error');
    const { averages, monthsCovered } = computeCategoryAverages(allTx);
    const months = [...new Set(allTx.map(t => t.source_month))].sort();
    // archive the mapping being replaced so the advisor can show the client how the
    // numbers moved between statement uploads, months later
    const snapshots = data?.transactions?.length
      ? [...(data.snapshots || []), {
          period_start: data.period_start,
          period_end: data.period_end,
          transactions: data.transactions,
          saved_at: data.updated_at || new Date().toISOString()
        }].slice(-12)
      : (data?.snapshots || []);
    const ok = await save({
      period_start: `${months[0]}-01`,
      period_end: monthEndDate(months[months.length - 1]),
      transactions: allTx,
      category_averages: averages,
      months_covered: monthsCovered,
      snapshots
    });
    setProcessing(false);
    if (ok !== false) {
      toast('המיפוי נשמר', 'success');
      setQueue([]);
    }
  }

  async function restoreSnapshot(index) {
    if (restoring) return;
    const snap = data.snapshots[index];
    if (!snap) return;
    if (!window.confirm('לשחזר מיפוי זה כמצב הנוכחי? המצב הנוכחי יישמר בהיסטוריה.')) return;
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
    const transactions = data.transactions.map((t, i) => (i === index ? { ...t, category } : t));
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
    if (ok !== false) toast('הקטגוריה עודכנה', 'success');
  }

  const categories = data?.category_averages
    ? Object.keys(data.category_averages).sort((a, b) => data.category_averages[b] - data.category_averages[a])
    : [];
  const maxAvg = categories.length ? data.category_averages[categories[0]] : 0;

  // Only meaningful once the advisor has uploaded full bank-account statements
  // (income lines included), not a credit-card-only mapping — those never
  // carry a `type`, so hasIncomeData stays false and this card stays hidden.
  const cashflow = data?.transactions ? computeCashflowSummary(data.transactions) : null;
  const CT = chartTheme();
  const cashflowChartData = cashflow ? {
    labels: ['ממוצע חודשי'],
    datasets: [
      { label: 'הכנסה חודשית', data: [cashflow.income], backgroundColor: CT.green, borderRadius: 5, hoverBackgroundColor: CT.greenHover },
      { label: 'הוצאה', data: [cashflow.expense], backgroundColor: CT.red, borderRadius: 5, hoverBackgroundColor: CT.redHover }
    ]
  } : null;

  // compares the oldest archived mapping to the current one, so the advisor can show
  // the client how their cashflow moved between the first upload and now
  const firstSnapshot = data?.snapshots?.length ? data.snapshots[0] : null;
  const firstCashflow = firstSnapshot ? computeCashflowSummary(firstSnapshot.transactions) : null;
  const showComparison = !!(firstCashflow?.hasIncomeData && cashflow?.hasIncomeData);
  const comparisonChartData = showComparison ? {
    labels: [monthLabel(firstSnapshot.period_end), monthLabel(data.period_end)],
    datasets: [
      { label: 'הכנסה חודשית', data: [firstCashflow.income, cashflow.income], backgroundColor: CT.green, borderRadius: 5, hoverBackgroundColor: CT.greenHover },
      { label: 'הוצאה', data: [firstCashflow.expense, cashflow.expense], backgroundColor: CT.red, borderRadius: 5, hoverBackgroundColor: CT.redHover }
    ]
  } : null;

  return (
    <div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>העלאת דפי חשבון</div>
        <div className={styles.dropZone} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={e => { pickFiles(e.target.files); e.target.value = ''; }}
            disabled={processing}
          />
          <label className={styles.dropLabel} onClick={() => !processing && fileInputRef.current?.click()}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 15V3M7 8l5-5 5 5" />
              <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
            </svg>
            <span>גרור עד 4 חודשי דפי חשבון (PDF או תמונות) או לחץ לבחירה</span>
            <span className={styles.dropHint}>כל קובץ מיוצג בנפרד — סמן לאיזה חודש קלנדרי הוא שייך.</span>
          </label>
        </div>

        {queue.length > 0 && (
          <div className={styles.queue}>
            {queue.map(item => (
              <div key={item.id} className={styles.queueRow}>
                <span className={styles.queueName}>{item.name}</span>
                <select className={styles.monthSelect} value={item.monthTag} onChange={e => setMonthTag(item.id, e.target.value)} disabled={processing}>
                  {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className={styles.statusChip + ' ' + (item.status === 'error' ? styles.statusError : item.status === 'done' ? styles.statusDone : '')}>
                  {item.status === 'queued' ? 'ממתין' : item.status}
                </span>
                {item.status === 'queued' && <DeleteButton onClick={() => removeFile(item.id)} />}
              </div>
            ))}
          </div>
        )}

        <div className={styles.actions}>
          <Button onClick={process} disabled={!queue.length || processing}>{processing ? 'מעבד...' : 'עבד וחשב מיפוי'}</Button>
        </div>
      </div>

      {categories.length > 0 && (
        <div className={styles.card + ' ' + styles.cardStandalone}>
          <div className={styles.cardTitle}>מיפוי כלכלי</div>
          <div className={styles.coverageNote}>מבוסס על {data.months_covered} חודשים שהועלו</div>
          <div className={styles.barList}>
            {categories.map(cat => (
              <div key={cat} className={styles.barRow}>
                <span className={styles.barLabel}>{cat}</span>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ transform: `scaleX(${maxAvg ? data.category_averages[cat] / maxAvg : 0})`, background: catColor(cat) }} />
                </div>
                <span className={styles.barValue}>{fmt(data.category_averages[cat])}</span>
              </div>
            ))}
          </div>

          <button type="button" className={styles.toggle} onClick={() => setExpanded(v => !v)}>
            {expanded ? 'הסתר תנועות גולמיות' : `הצג ${data.transactions.length} תנועות גולמיות`}
          </button>

          {expanded && (
            <div className={styles.list}>
              {data.transactions.map((t, i) => (
                <div key={i} className={styles.txRow}>
                  <span className={styles.txDate}>{t.date || '—'}</span>
                  <span className={styles.txDesc}>{t.desc}</span>
                  <select className={styles.txCat} value={t.category || (t.type === 'income' ? 'אחר' : 'שונות')} onChange={e => reassignCategory(i, e.target.value)}>
                    {(t.type === 'income' ? INCOME_CATS : MAPPING_EXPENSE_CATS).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span className={styles.txAmt + (t.type === 'income' ? ' ' + styles.txAmtIncome : '')}>{t.type === 'income' ? '+' : ''}{fmt(t.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {cashflow && cashflow.hasIncomeData && (
        <div className={styles.card + ' ' + styles.cardStandalone}>
          <div className={styles.cardTitle}>תזרים: הכנסות מול הוצאות</div>
          <div className={styles.coverageNote}>מבוסס על {cashflow.monthsCovered} חודשים שהועלו</div>

          <div className={styles.cashflowChart}>
            <Bar
              data={cashflowChartData}
              options={{
                maintainAspectRatio: false,
                animation: ChartJS.defaults.animation === false ? false : { duration: 700, easing: 'easeOutQuart' },
                scales: {
                  x: { ticks: { color: CT.text2, font: { family: CT.font } }, grid: { display: false } },
                  y: { ticks: { color: CT.text2, font: { family: CT.font } }, grid: { color: CT.border } }
                },
                plugins: {
                  legend: { labels: { color: CT.text2, font: { family: CT.font } } },
                  tooltip: { backgroundColor: CT.surface, borderColor: CT.border, borderWidth: 1, padding: 10, titleFont: { family: CT.font }, bodyFont: { family: CT.font } }
                }
              }}
            />
          </div>

          <div className={styles.cashflowRows}>
            <div className={styles.cashflowRow}>
              <span className={styles.cashflowRowLabel}>תזרים חודשי בחשבון</span>
              <span className={styles.cashflowRowValue + (cashflow.netInAccount < 0 ? ' ' + styles.cashflowRowValueNeg : '')}>{fmt(cashflow.netInAccount)}</span>
            </div>
            <div className={styles.cashflowRow}>
              <span className={styles.cashflowRowLabel}>תזרים חודשי ללא הפרשות לחיסכון</span>
              <span className={styles.cashflowRowValue + (cashflow.netExcludingSavings < 0 ? ' ' + styles.cashflowRowValueNeg : '')}>{fmt(cashflow.netExcludingSavings)}</span>
            </div>
          </div>
        </div>
      )}

      {data?.snapshots?.length > 0 && (
        <div className={styles.card + ' ' + styles.cardStandalone}>
          <div className={styles.cardTitle}>היסטוריית מיפויים</div>
          <div className={styles.list}>
            {data.snapshots.map((s, i) => (
              <div key={i} className={styles.txRow}>
                <span className={styles.txDate}>{monthLabel(s.period_start)}–{monthLabel(s.period_end)}</span>
                <span className={styles.txDesc}>{s.saved_at ? new Date(s.saved_at).toLocaleDateString('he-IL') : ''}</span>
                <Button variant="ghost" disabled={restoring} onClick={() => restoreSnapshot(i)}>שחזר</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showComparison && (
        <div className={styles.card + ' ' + styles.cardStandalone}>
          <div className={styles.cardTitle}>השוואת תזרים: תחילת התהליך מול היום</div>
          <div className={styles.coverageNote}>{monthLabel(firstSnapshot.period_end)} מול {monthLabel(data.period_end)}</div>

          <div className={styles.cashflowChart}>
            <Bar
              data={comparisonChartData}
              options={{
                maintainAspectRatio: false,
                animation: ChartJS.defaults.animation === false ? false : { duration: 700, easing: 'easeOutQuart' },
                scales: {
                  x: { ticks: { color: CT.text2, font: { family: CT.font } }, grid: { display: false } },
                  y: { ticks: { color: CT.text2, font: { family: CT.font } }, grid: { color: CT.border } }
                },
                plugins: {
                  legend: { labels: { color: CT.text2, font: { family: CT.font } } },
                  tooltip: { backgroundColor: CT.surface, borderColor: CT.border, borderWidth: 1, padding: 10, titleFont: { family: CT.font }, bodyFont: { family: CT.font } }
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
        </div>
      )}
    </div>
  );
}
