import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { EXPENSE_CATS, FIXED_CATS } from '../categories.js';
import { learnCategory, forgetCategory } from './learnedCategories.js';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import styles from './MerchantRules.module.css';
import cardStyles from './EconomicMapping.module.css';

const CATS = [...EXPENSE_CATS.slice(0, -1), 'הזמנות מחו״ל', ...FIXED_CATS.filter(c => !EXPENSE_CATS.includes(c)), 'שונות'];

export default function MerchantRules() {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState(null);

  useEffect(() => {
    if (!open || rules) return;
    supabase.from('advisor_merchant_rules').select('merchant, category').order('merchant').then(({ data }) => setRules(data || []));
  }, [open, rules]);

  async function changeCategory(merchant, category) {
    const { error } = await supabase.from('advisor_merchant_rules').upsert({ merchant, category, updated_at: new Date().toISOString() }, { onConflict: 'advisor_id,merchant' });
    if (error) { toast('השמירה נכשלה', 'error'); return; }
    learnCategory(merchant, category);
    setRules(list => list.map(r => (r.merchant === merchant ? { ...r, category } : r)));
  }

  async function remove(merchant) {
    const { error } = await supabase.from('advisor_merchant_rules').delete().eq('merchant', merchant);
    if (error) { toast('המחיקה נכשלה', 'error'); return; }
    forgetCategory(merchant);
    setRules(list => list.filter(r => r.merchant !== merchant));
  }

  return (
    <div className={cardStyles.card + ' ' + cardStyles.cardStandalone}>
      <div className={cardStyles.cardTitle}>כללי הסיווג ששמרתי</div>
      <div className={cardStyles.coverageNote}>כל כלל חל על העלאות עתידיות של כל הלקוחות שלך. מחיקה מחזירה את הסיווג האוטומטי.</div>
      <button type="button" className={cardStyles.toggle} aria-expanded={open} onClick={() => setOpen(v => !v)}>
        {open ? 'הסתר' : 'הצג ונהל'}
      </button>
      {open && rules && rules.length === 0 && <div className={styles.empty}>עוד לא נשמרו כללים. הם נוצרים כשמשנים קטגוריה של עסקה.</div>}
      {open && rules && rules.length > 0 && (
        <div className={styles.list}>
          {rules.map(r => (
            <div key={r.merchant} className={styles.row}>
              <span className={styles.merchant} title={r.merchant}>{r.merchant}</span>
              <select className={styles.select} value={r.category} aria-label={'קטגוריה עבור ' + r.merchant} onChange={e => changeCategory(r.merchant, e.target.value)}>
                {(CATS.includes(r.category) ? CATS : [r.category, ...CATS]).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <DeleteButton title={'מחק כלל ' + r.merchant} onClick={() => remove(r.merchant)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
