# הסכם התקשרות עם חתימה דיגיטלית — תוכנית בנייה

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**מטרה:** לקוח חדש חותם בתוך האפליקציה על הסכם התקשרות מול דוד, והרשומה נשמרת כראיה נעולה: נוסח מלא, שם, ת"ז, חתימה מצוירת, שני תאריכים, כתובת רשת ומכשיר.

**ארכיטקטורה:** שלוש טבלאות במסד (גרסאות הסכם, הצעות, חתימות) שנכתבות רק דרך שלוש פונקציות שרת (`security definer`). הנוסח הקנוני יושב במסד ולא בדפדפן. מסך החתימה והצגת "ההסכם שלי" נוספים ל-`index.html`, ותצוגת החתימה ליועץ ל-`advisor-app`. ההפעלה נשלטת בשרת: בגרסת הטיוטה `required_from='infinity'`, ולכן אף אחד לא נדרש לחתום עד שגרסה מאושרת מוכנסת.

**טכנולוגיה:** Supabase (SQL, RLS), `index.html` יחיד בלי ספריות חדשות, React + Vite + vitest ב-`advisor-app`, בדיקות `node:test` ב-`scripts/personal-app.test.cjs`.

**מסמך העיצוב:** `docs/superpowers/specs/2026-11-22-client-agreement-signature-design.md`

## אילוצים כלליים
- מיגרציות ממוספרות ב-`supabase/migrations/` (הבאה: 110) ומוחלות דרך כלי ה-MCP של Supabase (`apply_migration`).
- במדיניות RLS תמיד `(select auth.uid())`. כל עמודת מפתח זר מקבלת אינדקס.
- אין פונקציית קצה חדשה, אין ספריות חדשות, אין מפתח שירות בצד הלקוח.
- כל צבע בכללי CSS חדשים הוא משתנה (`var(--accent)` וכו'), עובד בעיצוב בהיר וכהה. כפתורים לפחות 44 על 44 פיקסלים, `showToast()` על כל פעולה, כיוון RTL.
- `var`-ים אסורים: `const` ו-`let`, `async/await`.
- אין הערות בתוך קוד.
- לפני כל דחיפה: `node --test scripts/personal-app.test.cjs`, ובדיקת `gh run` של ה-sha שנדחף. הוק העצירה דוחף בכל סבב, לכן כל משימה משאירה את האתר תקין.
- לא מזכירים את יומן המסחר ולא נוגעים בטבלאות שלו.
- הנוסח מסומן "טיוטה" ולא מופעל (`required_from='infinity'`) עד שעורך דין מאשר ודוד מורה.

## מוקדי סקירה
כל שורה כאן מקבלת בדיקה במשימה שבסוגריים.
- ת"ז עם רווחים, או 5–8 ספרות בלי אפסים מובילים: מתנרמלת ל-9 ספרות לפני הבדיקה (משימות 1, 4).
- לחיצה כפולה על "חתימה": השורה נשמרת פעם אחת, והקריאה השנייה מחזירה את אותה רשומה ולא שגיאה (משימה 2).
- הלקוח סוגר את המסך ופותח שוב: מועד השליחה נשאר המועד הראשון (משימה 2).
- קנבס ריק או נגיעה בודדת נחשבים "אין חתימה" (משימה 4).
- משתמש שנוצר לפני `required_from`, או גרסה בלי סעיפים מסומנים, נדחים בשרת ולא רק בממשק (משימה 2).
- חתימה גדולה מדי (מעל 200KB) נדחית (משימה 2).

## מבנה קבצים
- `supabase/migrations/110_client_agreements_schema.sql`: טבלאות, טריגרים, RLS, בדיקת ת"ז.
- `supabase/migrations/111_client_agreements_rpc.sql`: שלוש פונקציות שרת.
- `supabase/migrations/112_client_agreement_draft_text.sql`: שורת הטיוטה.
- `supabase/migrations/113_client_agreements_advisor_read.sql`: קריאת יועץ.
- `index.html`: עזרים, שער חתימה, "ההסכם שלי".
- `scripts/personal-app.test.cjs`: בדיקות העזרים.
- `advisor-app/src/business/ClientAgreement.jsx`, `agreementAudit.js`, `agreementAudit.test.js`: תצוגת יועץ.

---

### משימה 1: סכמה, נעילה וטריגרים

**קבצים:**
- ליצור: `supabase/migrations/110_client_agreements_schema.sql`

**ממשקים:**
- מייצר:
  - `public.agreement_versions(version text primary key, title text not null, body text not null, body_sha256 text not null, clauses jsonb not null, required_from timestamptz not null default 'infinity', is_draft boolean not null default true, created_at timestamptz not null default now())`. `clauses` הוא מערך של `{id, title}`.
  - `public.client_agreement_offers(id uuid pk default gen_random_uuid(), user_id uuid not null, version text not null references agreement_versions(version), presented_at timestamptz not null default now(), ip text, user_agent text, unique (user_id, version))`.
  - `public.client_agreements(id uuid pk default gen_random_uuid(), user_id uuid not null, email text not null, full_name text not null, national_id text not null, birth_date date not null, address text not null, phone text not null, version text not null references agreement_versions(version), body text not null, body_sha256 text not null, confirmed_clauses jsonb not null, signature_png text not null, presented_at timestamptz not null, presented_ip text, presented_user_agent text, signed_at timestamptz not null default now(), signed_ip text, signed_user_agent text, record_sha256 text not null, unique (user_id, version))`.
  - `public.is_valid_israeli_id(p text) returns boolean`: מנרמלת (מסירה רווחים, ריפוד באפסים ל-9 ספרות, ספרות בלבד) ובודקת ספרת ביקורת.
- `user_id` בשתי הטבלאות הוא עמודה רגילה בלי מפתח זר, כדי שמחיקת חשבון לא תמחק ראיה. יש אינדקס על `user_id` בכל אחת.

- [ ] **שלב 1: לכתוב בדיקה חיה שנכשלת.** `execute_sql` עם `select public.is_valid_israeli_id('000000018')` מצפה `true`, `'123456789'` מצפה `false`, `'18'` מצפה `true` (מרופד), `'12a456782'` מצפה `false`, `''` מצפה `false`. הרצה לפני המיגרציה נכשלת: "function does not exist".
- [ ] **שלב 2: לכתוב את המיגרציה.** הטבלאות כמפורט, `enable row level security` על שלוש, ומדיניות קריאה בלבד: `agreement_versions` ל-`authenticated` (הכול), `client_agreement_offers` ו-`client_agreements` לשורות של `(select auth.uid())`. אין מדיניות כתיבה. טריגר `before update or delete` על `client_agreements` ו-`client_agreement_offers` שזורק `raise exception 'client agreements are immutable'`. טריגר על `agreement_versions` שחוסם `delete` ומאפשר `update` רק של `required_from` ו-`is_draft` (חוסם שינוי של `body`, `body_sha256`, `clauses`, `version`).
- [ ] **שלב 3: להחיל** עם `apply_migration` בשם `client_agreements_schema`.
- [ ] **שלב 4: לאמת.** שוב את בדיקות הת"ז: כולן עוברות. שאילתת `information_schema.table_constraints` על שתי הטבלאות מראה שאין מפתח זר ל-`auth.users`. `select relrowsecurity from pg_class` מחזיר `true` לשלוש.
- [ ] **שלב 5: לבדוק נעילה בבלוק שמתבטל.** `DO` שמכניס שורת גרסה ושורת חתימה ומנסה `update` ו-`delete`, וצריך לקבל את השגיאה "immutable", ומסיים ב-`raise exception 'ROLLBACK_OK'` כדי שדבר לא יישמר. אם ה-MCP חוסם כתיבה גם כך, לעצור ולדווח לדוד.
- [ ] **שלב 6: להוסיף את הקובץ ל-git ולבצע commit** `add client agreement tables`.

---

### משימה 2: שלוש פונקציות שרת

**קבצים:**
- ליצור: `supabase/migrations/111_client_agreements_rpc.sql`

**ממשקים:**
- צורך: הטבלאות והפונקציה `is_valid_israeli_id` ממשימה 1.
- מייצר (כולן `security definer`, `set search_path to ''`, שגיאה `42501` אם `auth.uid()` ריק):
  - `public.client_agreement_status() returns jsonb`: מחזירה `{"required": bool, "signed": bool, "version": text|null}`. הגרסה הנבחרת היא הגרסה עם `required_from` הקרוב ביותר שכבר עבר (`<= now()`), ו-`required` אמת רק אם `auth.users.created_at >= required_from` ואין חתימה לגרסה.
  - `public.present_client_agreement() returns jsonb`: מחזירה `{"version","title","body","body_sha256","clauses","presented_at"}` לגרסה שנבחרה. מכניסה שורת הצעה אחת (`on conflict (user_id, version) do nothing`) עם כתובת רשת ופרטי מכשיר מ-`current_setting('request.headers', true)::json` (`x-forwarded-for` ראשון, ו-`user-agent`). מחזירה את `presented_at` הקיים אם כבר נפתח.
  - `public.sign_client_agreement(p_version text, p_full_name text, p_national_id text, p_birth_date date, p_address text, p_phone text, p_signature_png text, p_confirmed_clauses jsonb) returns jsonb`: מחזירה `{"id","signed_at"}`.

**כללי `sign_client_agreement` (זורקת `22023` עם הודעה ברורה בכל כישלון):**
- המשתמש חייב להיות נדרש לגרסה זו (לפי כלל `status`).
- חייבת להיות הצעה קיימת (`present` נקראה).
- שם מלא: לפחות שתי מילים. ת"ז: תקפה לפי `is_valid_israeli_id`, נשמרת מנורמלת. תאריך לידה: גיל 18 ומעלה. כתובת וטלפון: לא ריקים.
- `p_confirmed_clauses` חייב לכלול כל `id` שב-`clauses` של הגרסה, בדיוק.
- `p_signature_png` מתחיל ב-`data:image/png;base64,` ואורכו עד 200000 תווים.
- הנוסח והטביעה נלקחים מ-`agreement_versions`, לא מהקריאה. האימייל נלקח מ-`auth.users`.
- `record_sha256` הוא `encode(digest(...,'sha256'),'hex')` על טקסט קנוני של כל השדות לפי סדר קבוע (`create extension if not exists pgcrypto`).
- `on conflict (user_id, version) do nothing`, ואז מחזירה את השורה הקיימת (חתימה כפולה אינה שגיאה ואינה יוצרת שורה שנייה).
- `revoke all ... from public, anon` ו-`grant execute ... to authenticated` על שלושתן.

- [ ] **שלב 1: לכתוב בדיקה חיה (`DO` שמתבטל)** שמכינה משתמש ניסוי בשורות `auth.users`, גרסה עם `required_from='2000-01-01'` ושני סעיפים, ומגדירה `set_config('request.jwt.claim.sub', <uuid>, true)`. ההצהרות: `status` מחזירה `required=true`. `sign` בלי `present` נכשלת. אחרי `present`, `sign` עם ת"ז שגויה נכשלת, עם סעיף חסר נכשלת, עם חתימה של 200001 תווים נכשלת, עם משתמש שנוצר לפני `required_from` נכשלת. `sign` תקינה מחזירה `id`. `sign` שנייה מחזירה אותו `id` וסופרת שורה אחת. `signed_at >= presented_at`. `update` על השורה נכשל. מסתיים ב-`raise exception 'ROLLBACK_OK'`. להריץ לפני כתיבת הפונקציות: נכשל.
- [ ] **שלב 2: לכתוב את המיגרציה** לפי הממשקים והכללים למעלה.
- [ ] **שלב 3: להחיל** (`client_agreements_rpc`) ולהריץ שוב את הבדיקה: עוברת עם `ROLLBACK_OK`.
- [ ] **שלב 4: להריץ `get_advisors` (אבטחה)** ולוודא שאין אזהרה חדשה על שלוש הטבלאות או הפונקציות.
- [ ] **שלב 5: commit** `add client agreement functions`.

---

### משימה 3: נוסח הטיוטה

**קבצים:**
- ליצור: `supabase/migrations/112_client_agreement_draft_text.sql`

**ממשקים:**
- צורך: `agreement_versions` ממשימה 1.
- מייצר: שורה אחת, `version='2026-11-draft'`, `is_draft=true`, `required_from='infinity'`, `title='הסכם התקשרות (טיוטה)'`.

- [ ] **שלב 1: לכתוב את `body`** בעברית, בשפה פשוטה, מסומן בראשו "טיוטה — לא לשימוש עד אישור עורך דין", על בסיס הפרק "תוכן ההסכם" שבמסמך העיצוב: סעיפי "נלקח" ו"נוסף". סכום, תדירות ושם עיר לסמכות שיפוט נשארים כשדות פתוחים בצורת `[__]`. אסור לשכפל ניסוח מההסכם שצורף.
- [ ] **שלב 2: להגדיר `clauses`** כמערך `{id,title}` של הסעיפים שהלקוח מאשר בנפרד: `scope` (היקף השירות והבהרה שאינו ייעוץ השקעות), `liability` (הגבלת אחריות והסתמכות), `data` (גישת היועץ לנתונים וספקי משנה כולל בינה מלאכותית), `recording` (הקלטה וסיכום פגישות), `payment` (תשלום וביטול), `marketing` (עדכונים והודעות).
- [ ] **שלב 3: לחשב `body_sha256`** ב-SQL (`encode(digest(body,'sha256'),'hex')`) בתוך אותה מיגרציה, ולא כערך שהוקלד.
- [ ] **שלב 4: להחיל** (`client_agreement_draft_text`). לאמת: `client_agreement_status()` ללקוח חדש מחזירה `required=false` (כי `required_from='infinity'`).
- [ ] **שלב 5: commit** `add client agreement draft text`.

---

### משימה 4: עזרים בצד הלקוח ובדיקותיהם

**קבצים:**
- לשנות: `index.html` (ליד `_ensureLegalConsent`, כ-5341)
- בדיקה: `scripts/personal-app.test.cjs`

**ממשקים:**
- מייצר (פונקציות עליונות ב-`index.html`, כל אחת מסתיימת ב-`\n}` כדי שמחלץ הבדיקות ימצא אותה):
  - `_normalizeIsraeliId(raw: string): string`: מסירה כל מה שאינו ספרה, ומרפדת באפסים ל-9. מחזירה `''` אם ריק או ארוך מ-9 ספרות.
  - `_isValidIsraeliId(raw: string): boolean`: ספרת ביקורת (סכום ספרות כפול 1,2 לסירוגין, כשמכפלה מעל 9 מופחתת ב-9, והסכום מתחלק ב-10).
  - `_strokeLength(strokes: Array<Array<{x:number,y:number}>>): number`: סכום אורכי הקווים בפיקסלים.
  - `_agreementFormReady(f: {fullName:string, nationalId:string, birthDate:string, address:string, phone:string, ink:number, confirmed:string[], required:string[]}): boolean`: אמת רק אם שם מלא (שתי מילים), ת"ז תקפה, לידה 18+ מול `Date.now()`, כתובת וטלפון לא ריקים, `ink >= 40`, וכל `required` בתוך `confirmed`.

- [ ] **שלב 1: לכתוב בדיקות שנכשלות** ב-`personal-app.test.cjs`, בסגנון הקיים (`functions([...])`): `'israeli id check digit'` (`'000000018'` אמת, `'123456789'` שקר, `'18'` אמת, `' 0000 00018 '` אמת, `'12a456782'` שקר, `''` שקר), `'stroke length ignores a single tap'` (נקודה אחת = 0, קו של 50 פיקסלים = 50), `'agreement form needs every clause and a real signature'` (כל שדה שחסר, סעיף שחסר, `ink` של 39 ושל 40, ילד בן 17, גיל 18 בדיוק).
- [ ] **שלב 2: להריץ** `node --test scripts/personal-app.test.cjs` ולראות את הכישלון ("missing _isValidIsraeliId").
- [ ] **שלב 3: לממש** ארבע הפונקציות ב-`index.html` לפי החתימות למעלה.
- [ ] **שלב 4: להריץ** את כל חבילת הבדיקות: עוברת.
- [ ] **שלב 5: commit** `add client agreement helpers`.

---

### משימה 5: שער החתימה

**קבצים:**
- לשנות: `index.html` (פונקציה חדשה ליד `_ensureLegalConsent`, וקריאה בשני המקומות שקוראים לה היום)

**ממשקים:**
- צורך: `_agreementFormReady`, `_strokeLength`, `_normalizeIsraeliId` ממשימה 4, וקריאות `client_agreement_status`, `present_client_agreement`, `sign_client_agreement` ממשימות 2.
- מייצר: `_ensureClientAgreement(): Promise<void>` ו-`_initSignaturePad(canvas: HTMLCanvasElement): {strokes: () => Array, clear: () => void, toDataUrl: () => string}`.

- [ ] **שלב 1: לממש `_ensureClientAgreement`** באותו דפוס של `_ensureLegalConsent`: מנגנון `_agreementCheckedFor` למניעת בדיקה חוזרת, יציאה שקטה אם `_cloudUser` או `_sb` חסרים, או אם `client_agreement_status` נכשלת (נכשל פתוח, כמו השער הקיים), או `required=false`, או `signed=true`. אחרת קוראת `present_client_agreement` ובונה שכבה במסך מלא (`position:fixed;inset:0`, אותו סגנון שער) עם: הכותרת, גוף ההסכם בגלילה, שני תאריכים לקריאה בלבד (מועד שליחה מהשרת ותאריך החתימה הנוכחי), שדות שם מלא, ת"ז, תאריך לידה, כתובת, טלפון, תיבת סימון נפרדת לכל סעיף ב-`clauses`, קנבס חתימה עם כפתור "נקה", וכפתור "חתימה על ההסכם" שנעול עד ש-`_agreementFormReady` אמת. כפתור "אני לא מסכים/ה, התנתקות" כמו בשער הקיים.
- [ ] **שלב 2: לממש `_initSignaturePad`** עם אירועי `pointerdown/move/up`, `touch-action:none`, קו בצבע `var(--text)` נקרא מ-`getComputedStyle`, ושמירת הנקודות לצורך `_strokeLength`. `toDataUrl` מחזיר `canvas.toDataURL('image/png')`.
- [ ] **שלב 3: בשליחה:** כפתור נעול בזמן הקריאה (מניעת לחיצה כפולה), `sign_client_agreement` עם `_normalizeIsraeliId`, וכשל מציג `showToast` עם הודעת השרת ומשאיר את השכבה פתוחה. הצלחה: מסיר שכבה, מציג `showToast('ההסכם נחתם ונשמר')`.
- [ ] **שלב 4: לקרוא** `_ensureClientAgreement()` בשני המקומות שמפעילים היום `_ensureLegalConsent()`, אחרי שער התנאים (לקרוא אחרי ש-`#legalGate` הוסר, ולא במקביל).
- [ ] **שלב 5: לאמת בדפדפן** עם הכישור `verify` ושרת מקומי: בגרסת הטיוטה לא מופיע שום שער. אחר כך, בדפדפן מקומי בלבד, להחליף את `_sb.rpc` בסטאב שמחזיר `required=true` ונוסח בדיקה, ולצלם את המסך בעיצוב בהיר וכהה ובמסך צר. אסור להפעיל גרסה במסד האמיתי לצורך הבדיקה.
- [ ] **שלב 6: להריץ** את חבילת הבדיקות ולעשות commit `add client agreement signing gate`.

---

### משימה 6: "ההסכם שלי" והדפסה

**קבצים:**
- לשנות: `index.html` (כפתור ליד כפתור "תנאי שימוש" בשורה כ-2749, ושכבה חדשה)

**ממשקים:**
- צורך: טבלת `client_agreements` (קריאה ישירה, RLS של הבעלים).
- מייצר: `openMyAgreement(): Promise<void>` ו-`_agreementAuditHtml(a: object): string`.

- [ ] **שלב 1: לממש `openMyAgreement`:** קורא את שורת ההסכם של המשתמש (`select * ... maybeSingle`). אם אין, `showToast('לא נמצא הסכם חתום')`. אחרת פותח גיליון עם הנוסח, פרטי החותם, החתימה כתמונה, ושני התאריכים, וכפתור "הדפסה / שמירה כמסמך" שקורא `window.print()` עם סגנון הדפסה שמציג רק את גוף ההסכם ואת דף הביקורת.
- [ ] **שלב 2: לממש `_agreementAuditHtml`:** דף ביקורת עם מזהה הסכם, שלושת האירועים (נשלח/נפתח עם `presented_at`, כתובת רשת ומכשיר; נחתם עם `signed_at`, כתובת רשת ומכשיר), טביעת האצבע של הנוסח ושל הרשומה. תאריכים בפורמט `DD/MM/YYYY HH:MM`, אזור זמן ישראל.
- [ ] **שלב 3: להסתיר** את הכפתור למי שאין לו הסכם חתום (בדיקה קלה בפתיחת ההגדרות), כדי שלקוחות קיימים לא יראו כפתור מת.
- [ ] **שלב 4: לאמת בדפדפן** שהתצוגה והדפסה נראות תקינות בשני העיצובים ושהת"ז מוצגת רק כאן. להריץ בדיקות, commit `add my agreement view`.

---

### משימה 7: קריאת יועץ ותצוגה ב-advisor-app

**קבצים:**
- ליצור: `supabase/migrations/113_client_agreements_advisor_read.sql`
- ליצור: `advisor-app/src/business/ClientAgreement.jsx`, `advisor-app/src/business/agreementAudit.js`
- בדיקה: `advisor-app/src/business/agreementAudit.test.js`
- לשנות: `advisor-app/src/business/ClientView.jsx` (בתצוגה `documents`, כ-219–224)

**ממשקים:**
- מייצר: `formatAuditEvents(a: object): Array<{label: string, at: string, ip: string, device: string}>` ב-`agreementAudit.js`, ומדיניות `"advisor reads client agreements"` על `client_agreements` (select בלבד) בדפוס של מיגרציה 107: `public.is_advisor() and public.advisor_mfa_ok()` ו-`exists` על `advisor_clients` עם `ac.advisor_id = (select auth.uid()) and ac.client_id = client_agreements.user_id and ac.status = 'active'`.

- [ ] **שלב 1: לכתוב בדיקת vitest שנכשלת:** `formatAuditEvents` מחזירה שלושה אירועים בסדר "נשלח", "נפתח", "נחתם", עם תאריך `DD/MM/YYYY HH:MM`, ופרט חסר מוצג `—`.
- [ ] **שלב 2: להריץ** `cd advisor-app && npm run test` מ-PowerShell עם `C:\` באות גדולה, ולראות כישלון.
- [ ] **שלב 3: לממש** `formatAuditEvents`, ולהריץ שוב: עובר.
- [ ] **שלב 4: לכתוב את המיגרציה** ולהחיל (`client_agreements_advisor_read`). לבדוק בבלוק שמתבטל: יועץ מקושר פעיל קורא, יועץ אחר לא רואה כלום.
- [ ] **שלב 5: לממש `ClientAgreement.jsx`:** מקבל `clientId`, קורא `client_agreements` של הלקוח, מציג "הסכם חתום" עם הנוסח, הפרטים (הת"ז מוצגת כאן ליועץ בלבד), החתימה ודף הביקורת מ-`formatAuditEvents`, כפתור הדפסה. בלי רשומה: "הלקוח טרם חתם". מוסיף מתחת ל-`ClientDocuments` בתצוגת `documents`. כל צבע ב-CSS module כמשתנה, ובדיקה בהירה וכהה דרך הסביבה `__audit` (`vite.audit.config.js`), בלי למחוק אותה.
- [ ] **שלב 6: להריץ** את בדיקות `advisor-app` וה-`lint`, ו-commit `show signed agreement to advisor`.

---

### משימה 8: אימות סופי ותנאי הפעלה

**קבצים:** אין שינוי קוד.

- [ ] **שלב 1: לוודא ש-`delete-account`** (`supabase/functions/delete-account/index.ts`) לא מוחק מהטבלאות החדשות: חיפוש `client_agreements` ו-`client_agreement_offers` בקובץ לא מוצא כלום.
- [ ] **שלב 2: להריץ את כל הבדיקות:** `node --test scripts/personal-app.test.cjs`, ו-`npm run test` ב-`advisor-app`.
- [ ] **שלב 3: לאמת פריסה:** `gh run list` ל-sha האחרון, ו-`curl -s https://davidtheking28-oss.github.io/budget-app/index.html | grep -c '_ensureClientAgreement'` מחזיר `1` ומעלה.
- [ ] **שלב 4: לאמת שאין שער בפרודקשן:** `client_agreement_status()` ללקוח חדש מחזירה `required=false`.
- [ ] **שלב 5: להעביר לדוד רשימת הפעלה:** (א) עורך דין מאשר את `body` וממלא סכומים ועיר, (ב) מיגרציה חדשה מוסיפה גרסה מאושרת עם `is_draft=false` ו-`required_from=now()` ולא מעדכנת את הטיוטה, (ג) בדיקה חיה אחרונה בחשבון ניסוי, (ד) משך שמירה של הרשומות אחרי מחיקת חשבון נקבע עם עורך הדין.
