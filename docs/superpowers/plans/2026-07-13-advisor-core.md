# Advisor Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a client link an advisor via invite code (mirroring the existing household flow), give the advisor a client-list screen, let the advisor enter/exit a client's budget with full edit access, and replace the temporary `_ADVISOR_EMAILS` allowlist with real advisor detection.

**Architecture:** One new Supabase table (`advisor_clients`) with RLS, plus an extension to the existing `budget_data` RLS policy to grant advisor access. All client-side code lives in `index.html`, in clearly labeled blocks near the existing household-sync code, following the exact same patterns (`_householdOwner`-style account switching, `_loadFromCloud()`, `renderCloudSection()`-style render functions). No new files on the frontend; one new SQL migration file for the schema change, applied via the Supabase MCP tools.

**Tech Stack:** Supabase Postgres + RLS (via `mcp__supabase__apply_migration` / `mcp__supabase__execute_sql`), plain JS in `index.html`, existing CSS design system (`var(--accent)`, `.btn`, `.settings-section`, etc.).

## Global Constraints

- Single-file frontend: all JS/HTML/CSS changes go into `c:\Users\david\projects\ai-budget\index.html`. Do not create new frontend files.
- Logical separation, not physical: group all advisor-console code in clearly labeled blocks (banner comments, `advisor*`/`_advisor*`-prefixed names), not interleaved line-by-line with personal-budget logic — per `docs/superpowers/specs/2026-07-13-advisor-desktop-platform-design.md` ("Code organization").
- Desktop access stays advisor-only: the `body.is-advisor` class (index.html, `_applyAdvisorGate()`) gates the desktop sidebar CSS added in the prior plan. This plan replaces the temporary `_ADVISOR_EMAILS` allowlist with a real check derived from `advisor_clients`.
- RLS is non-negotiable: every new table gets RLS enabled; every policy scopes to `auth.uid()`. Never use the service role key in frontend code. (Per `C:\Users\david\.claude\rules\supabase.md`.)
- Use the Supabase MCP tools (`apply_migration`, `execute_sql`) directly for all schema/SQL work — never tell the user to paste SQL manually. (Per `CLAUDE.md`.)
- Data operations on `budget_data` from advisor code must still go through the same `_sb.from('budget_data')...` calls already used everywhere else — no new data-access pattern.
- RTL layout throughout — `dir="rtl"` on `<html>`. Any new UI follows the existing Hebrew-first, RTL-first conventions (see `C:\Users\david\.claude\rules\frontend.md`).
- No test framework in this repo. Verification is: (a) direct SQL queries via `mcp__supabase__execute_sql` to confirm schema/RLS/policy text, (b) Playwright MCP for UI screens (using the auth/onboarding-bypass technique already established: inject a `<style>` hiding `#authScreen`/`#onboardOverlay` via `browser_evaluate`, for verification only, never written to index.html).
- Out of scope for this plan (deferred to later steps per the spec): per-client CRM (notes/tasks/meetings — Step 3), computed "remaining this month" / budget-overage columns and AI insights on the client list (Step 4, needs reused dashboard math against arbitrary users' data — not a Step 2 concern). The client list in this plan shows name/email/status only, with a "כניסה לתקציב" action — not the fuller table mocked during brainstorming. Also deferred: the spec's "Client onboarding" guided setup for newly-linked clients with empty budgets — that's a design task of its own (a short wizard reusing/extending the existing onboarding overlay) and isn't included as a task here; flag it back to the human before Step 3 starts if it's still wanted.

---

### Task 1: `advisor_clients` table + RLS

**Files:**
- Create: `supabase/migrations/006_advisor_clients.sql` (local record of the migration, matching the existing numbered-migration convention — see `supabase/migrations/005_fixed_expenses.sql` for the file's role; the actual schema change is applied via the Supabase MCP, not by running this file directly)

**Interfaces:**
- Produces: table `public.advisor_clients` with columns `id uuid pk`, `advisor_id uuid nullable`, `client_id uuid not null`, `client_email text not null`, `invite_code text not null`, `status text not null default 'pending'`, `created_at timestamptz not null default now()`. Later tasks query this table by `client_id = auth.uid()` (client's own link) and by `advisor_id = auth.uid() and status = 'active'` (advisor's client roster).

- [ ] **Step 1: Write the migration SQL**

```sql
create table public.advisor_clients (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid references auth.users(id),
  client_id uuid not null references auth.users(id),
  client_email text not null,
  invite_code text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.advisor_clients enable row level security;

create policy "auth users can read advisor_clients"
  on public.advisor_clients for select
  using (true);

create policy "client can create advisor invite"
  on public.advisor_clients for insert
  with check (auth.uid() = client_id);

create policy "advisor can claim pending invite, client can update own"
  on public.advisor_clients for update
  using (auth.uid() = client_id or (advisor_id is null and auth.uid() <> client_id))
  with check (auth.uid() = client_id or (advisor_id = auth.uid() and auth.uid() <> client_id));

create policy "client or advisor can remove the link"
  on public.advisor_clients for delete
  using (auth.uid() = client_id or auth.uid() = advisor_id);
```

This mirrors the existing `households` table's RLS shape exactly (open `select`, `client_id`-scoped `insert`, a claim-style `update` for the second party, and a delete open to either side) — see the `households` policies (`households can be updated`, `owner can create household`, `owner can delete household`) for the pattern this follows.

- [ ] **Step 2: Save the migration file**

Write the SQL from Step 1 to `supabase/migrations/006_advisor_clients.sql`.

- [ ] **Step 3: Apply the migration via the Supabase MCP**

Call `mcp__supabase__apply_migration` with `name: "advisor_clients"` and `query` set to the exact SQL from Step 1.

- [ ] **Step 4: Verify the table and policies exist**

Call `mcp__supabase__execute_sql` with:

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='advisor_clients'
order by ordinal_position;
```

Expected: 7 rows matching the columns from Step 1 (`id`, `advisor_id`, `client_id`, `client_email`, `invite_code`, `status`, `created_at`).

Then:

```sql
select policyname, cmd from pg_policies where tablename='advisor_clients' order by policyname;
```

Expected: 4 rows — one each for `select`, `insert`, `update`, `delete` (the 4 policy names from Step 1).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/006_advisor_clients.sql
git commit -m "add advisor_clients table with RLS"
```

---

### Task 2: Extend `budget_data` RLS so an active advisor can read/write a client's data

**Files:**
- Create: `supabase/migrations/007_advisor_budget_access.sql`

**Interfaces:**
- Consumes: `public.advisor_clients` from Task 1.
- Produces: the existing `budget_data` RLS policy ("user or household member can access budget data") extended with a third `OR` branch for active advisor links. No column or table changes to `budget_data` itself.

- [ ] **Step 1: Write the migration SQL**

The current policy (verified via `pg_policies` before writing this plan) is:

```sql
using (
  (( select auth.uid() ) = user_id)
  or exists (
    select 1 from households h
    where h.owner_id = budget_data.user_id and h.member_id = ( select auth.uid() )
  )
)
```
with an identical `with_check`. Replace it with:

```sql
drop policy "user or household member can access budget data" on public.budget_data;

create policy "user or household member or advisor can access budget data"
  on public.budget_data for all
  using (
    (auth.uid() = user_id)
    or exists (
      select 1 from public.households h
      where h.owner_id = budget_data.user_id and h.member_id = auth.uid()
    )
    or exists (
      select 1 from public.advisor_clients ac
      where ac.client_id = budget_data.user_id and ac.advisor_id = auth.uid() and ac.status = 'active'
    )
  )
  with check (
    (auth.uid() = user_id)
    or exists (
      select 1 from public.households h
      where h.owner_id = budget_data.user_id and h.member_id = auth.uid()
    )
    or exists (
      select 1 from public.advisor_clients ac
      where ac.client_id = budget_data.user_id and ac.advisor_id = auth.uid() and ac.status = 'active'
    )
  );
```

- [ ] **Step 2: Save the migration file**

Write the SQL from Step 1 to `supabase/migrations/007_advisor_budget_access.sql`.

- [ ] **Step 3: Apply via the Supabase MCP**

Call `mcp__supabase__apply_migration` with `name: "advisor_budget_access"` and the SQL from Step 1.

- [ ] **Step 4: Verify the new policy**

```sql
select policyname, cmd, qual from pg_policies where tablename='budget_data';
```

Expected: exactly one row, `policyname = 'user or household member or advisor can access budget data'`, and `qual` containing the text `advisor_clients`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/007_advisor_budget_access.sql
git commit -m "extend budget_data RLS to grant active advisors access"
```

---

### Task 3: Client-side invite UI — client generates the code

**Files:**
- Modify: `index.html`, inside the existing `<style>` block (add 0 new rules — reuse `.settings-section`, `.btn`, existing household-invite inline styles as a visual template)
- Modify: `index.html`, inside the Settings sheet HTML, immediately after the existing `<div class="settings-section">...<div id="cloudSection"></div></div>` block (index.html:2099-2102)
- Modify: `index.html`, JS section near the household functions (`_loadHousehold`, `createHousehold`, `joinHousehold`, `leaveHousehold` — index.html:3493-3536 area)

**Interfaces:**
- Consumes: `_cloudUser` (existing global), `_sb` (existing Supabase client), `esc()`, `showToast()` (existing helpers).
- Produces: global `_advisorLink` (object `{status, invite_code, advisor_id}` or `null`), function `_loadAdvisorLink()` (async, populates `_advisorLink` from `advisor_clients` where `client_id = auth.uid()`), function `createAdvisorInvite()` (async, inserts a pending row), function `renderAdvisorLinkSection()` (renders into a new `#advisorLinkSection` div). These are consumed by Task 4 for real advisor-status detection (via a parallel query) and are otherwise self-contained.

- [ ] **Step 1: Add the HTML section to Settings**

Insert immediately after index.html:2102 (`</div>` closing the "סנכרון ושיתוף" `.settings-section`):

```html
      <!-- ── Advisor link (client side) ── -->
      <div class="settings-section">
        <div class="settings-section-title">יועץ פיננסי</div>
        <div id="advisorLinkSection"></div>
      </div>
```

- [ ] **Step 2: Add the JS block**

Insert this block immediately after the existing `leaveHousehold` function (find its closing `}` in the household block around index.html:3527-3536; insert right after it), labeled with a banner comment per the logical-separation constraint:

```javascript
// ── Advisor link (client side) ──────────────────────────────────
let _advisorLink = null;
async function _loadAdvisorLink(){
  if(!_cloudUser||!_sb)return;
  const {data}=await _sb.from('advisor_clients').select('*').eq('client_id',_cloudUser.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
  _advisorLink=data||null;
}
async function createAdvisorInvite(){
  if(!_cloudUser||!_sb)return;
  const code=Math.random().toString(36).substring(2,8).toUpperCase();
  const {data,error}=await _sb.from('advisor_clients').insert({client_id:_cloudUser.id,client_email:_cloudUser.email,invite_code:code,status:'pending'}).select().single();
  if(error){showToast('❌ שגיאה ביצירת קוד');return;}
  _advisorLink=data;
  renderAdvisorLinkSection();
}
async function removeAdvisorLink(){
  if(!_advisorLink||!_sb)return;
  await _sb.from('advisor_clients').delete().eq('id',_advisorLink.id);
  _advisorLink=null;
  renderAdvisorLinkSection();
}
function renderAdvisorLinkSection(){
  const el=document.getElementById('advisorLinkSection');
  if(!el)return;
  if(!_advisorLink){
    el.innerHTML='<div style="font-size:0.82rem;color:var(--text2);margin-bottom:10px">חבר יועץ פיננסי כדי שיוכל לצפות ולערוך את התקציב שלך</div>'
      +'<button class="btn btn-outline btn-full" onclick="createAdvisorInvite()">+ צור קוד ליועץ</button>';
    return;
  }
  if(_advisorLink.status==='pending'){
    el.innerHTML='<div style="background:var(--surface2);border-radius:10px;padding:10px 12px;margin-bottom:8px;text-align:center">'
      +'<div style="font-size:1.4rem;margin-bottom:4px">🔑</div>'
      +'<div style="font-size:1.4rem;font-weight:800;letter-spacing:6px;font-family:var(--font-num);color:var(--accent)">'+esc(_advisorLink.invite_code)+'</div>'
      +'<div style="font-size:0.72rem;color:var(--text3);margin-top:4px">שתף את הקוד עם היועץ הפיננסי שלך</div></div>'
      +'<button class="btn btn-outline btn-sm" onclick="removeAdvisorLink()" style="width:100%;color:var(--red)">בטל קוד</button>';
    return;
  }
  el.innerHTML='<div style="display:flex;align-items:center;gap:8px;background:rgba(16,185,129,0.08);border-radius:10px;padding:10px 12px;margin-bottom:8px">'
    +'<span style="font-size:1.1rem">✅</span>'
    +'<div><div style="font-size:0.82rem;font-weight:700;color:var(--green)">מחובר ליועץ פיננסי</div></div></div>'
    +'<button class="btn btn-outline btn-sm" onclick="removeAdvisorLink()" style="width:100%;color:var(--red)">נתק יועץ</button>';
}
```

- [ ] **Step 3: Call `_loadAdvisorLink()` + `renderAdvisorLinkSection()` on auth resolution**

In the `_sb.auth.onAuthStateChange` callback (index.html, modified in the prior plan to also call `_applyAdvisorGate()`), add a call right after `_applyAdvisorGate()`:

```javascript
    _sb.auth.onAuthStateChange((event,session)=>{
      _cloudUser=session?.user||null;
      _applyAdvisorGate();
      renderCloudSection();
      if(_cloudUser&&(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')){
        _loadHousehold().then(()=>{_loadFromCloud();_subscribeHousehold();});
        _loadAdvisorLink().then(renderAdvisorLinkSection);
      }
    });
```

And in the `_sb.auth.getSession()` callback, right after the existing `_applyAdvisorGate()` call added by the prior plan, add:

```javascript
    _sb.auth.getSession().then(async ({data:{session}})=>{
      _cloudUser=session?.user||null;
      _applyAdvisorGate();
      if(_cloudUser){
        await _loadHousehold();
        await _loadFromCloud(true);
        _subscribeHousehold();
        await _loadAdvisorLink();
        renderAdvisorLinkSection();
        if(!_gateShown) refreshAll();
      } else renderCloudSection();
      _authGateResolve(session);
    });
```

- [ ] **Step 4: Verify with Playwright**

Start a static server rooted at the project directory on a fresh port, confirm it serves the updated file (`curl -s http://localhost:PORT/index.html | grep -c "advisorLinkSection"` → non-zero). Navigate, inject the auth/onboarding-bypass style override, open Settings (find and click the settings nav button / call `openSettings()` via `browser_evaluate`), and confirm the "יועץ פיננסי" section renders with the "+ צור קוד ליועץ" button (since `_cloudUser` is null in this sandbox — no real Supabase session — `_advisorLink` stays `null` and the empty-state button renders; that's sufficient to confirm the HTML/CSS integrates correctly. Full functional insert/claim behavior cannot be verified without live Supabase auth in this sandbox — note this as a documented gap in the report, consistent with how prior tasks handled the same limitation).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "add client-side advisor invite UI in Settings"
```

---

### Task 4: Real advisor detection — replace the `_ADVISOR_EMAILS` allowlist

**Files:**
- Modify: `index.html`, the `_ADVISOR_EMAILS`/`_applyAdvisorGate` block (added in the prior desktop-layout plan, near `_cloudUser` declaration)

**Interfaces:**
- Consumes: `public.advisor_clients` (Task 1), `_cloudUser`.
- Produces: global `_isAdvisor` (boolean), async function `_loadAdvisorStatus()` (queries whether the current user has any `advisor_clients` row as `advisor_id`), updated `_applyAdvisorGate()` that reads `_isAdvisor` instead of the allowlist.

- [ ] **Step 1: Replace the allowlist block**

Find and replace this block (added in the prior plan):

```javascript
// ── Advisor desktop gate (temporary allowlist — replaced by advisor_clients in Step 2) ──
const _ADVISOR_EMAILS = ['davidtheking27@gmail.com'];
function _applyAdvisorGate(){ document.body.classList.toggle('is-advisor', !!(_cloudUser && _ADVISOR_EMAILS.includes(_cloudUser.email))); }
```

with:

```javascript
// ── Advisor desktop gate ─────────────────────────────────────────
let _isAdvisor = false;
async function _loadAdvisorStatus(){
  if(!_cloudUser||!_sb){_isAdvisor=false;return;}
  const {data}=await _sb.from('advisor_clients').select('id').eq('advisor_id',_cloudUser.id).limit(1).maybeSingle();
  _isAdvisor=!!data;
}
function _applyAdvisorGate(){ document.body.classList.toggle('is-advisor', _isAdvisor); }
```

- [ ] **Step 2: Call `_loadAdvisorStatus()` before `_applyAdvisorGate()` wherever the latter is called**

`_applyAdvisorGate()` is called in 3 places (from the prior plan + Task 3 of this plan): the `onAuthStateChange` callback, the `getSession().then(...)` callback, and the cached-session fast path (`if(cached?.user){ _cloudUser=cached.user; _applyAdvisorGate(); ... }`). In each, change the call to await `_loadAdvisorStatus()` first:

```javascript
    _sb.auth.onAuthStateChange((event,session)=>{
      _cloudUser=session?.user||null;
      _loadAdvisorStatus().then(_applyAdvisorGate);
      renderCloudSection();
      if(_cloudUser&&(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')){
        _loadHousehold().then(()=>{_loadFromCloud();_subscribeHousehold();});
        _loadAdvisorLink().then(renderAdvisorLinkSection);
      }
    });
    _sb.auth.getSession().then(async ({data:{session}})=>{
      _cloudUser=session?.user||null;
      await _loadAdvisorStatus();
      _applyAdvisorGate();
      if(_cloudUser){
        await _loadHousehold();
        await _loadFromCloud(true);
        _subscribeHousehold();
        await _loadAdvisorLink();
        renderAdvisorLinkSection();
        if(!_gateShown) refreshAll();
      } else renderCloudSection();
      _authGateResolve(session);
    });
```

For the cached-session fast path (in the function containing `if(cached?.user){ _cloudUser=cached.user; ... }`), change:

```javascript
      if(cached?.user){
        _cloudUser=cached.user;
        _loadAdvisorStatus().then(_applyAdvisorGate);
        _gateDone=true;
        _proceedToApp();
```

(This path fires before the network round-trip completes, so the gate class is applied asynchronously — same pattern as the `onAuthStateChange` case above, both fire-and-forget since neither blocks app startup.)

- [ ] **Step 3: Verify with Playwright**

Same server/bypass setup as Task 3. Confirm `document.body.classList.contains('is-advisor')` is `false` by default (no session in this sandbox), and confirm `typeof _loadAdvisorStatus === 'function'` and `typeof _isAdvisor === 'boolean'` via `browser_evaluate` — this confirms the replacement wired up correctly even though the real Supabase round-trip can't be exercised in this sandbox. Also grep the served file to confirm `_ADVISOR_EMAILS` no longer appears: `curl -s http://localhost:PORT/index.html | grep -c "_ADVISOR_EMAILS"` → `0`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "replace advisor email allowlist with real advisor_clients-based detection"
```

---

### Task 5: Advisor console entry point — sidebar section + client list screen

**Files:**
- Modify: `index.html`, the `<style>` block (new rules for `.advisor-client-row`, gated the same way other advisor-only UI is — visible only when `body.is-advisor`, reusing the existing desktop sidebar CSS pattern)
- Modify: `index.html`, the sidebar nav markup (index.html, the `<nav class="bottom-nav" ...>` block, currently 5 `<button class="nav-item" ...>` entries)
- Modify: `index.html`, `<main id="main-content">` — add a new `<div id="page-advisorClients" class="page">`
- Modify: `index.html`, `showPage()` function

**Interfaces:**
- Consumes: `_isAdvisor` (Task 4), `showPage()` existing dispatcher, `.page`/`.nav-item` CSS classes, `esc()`.
- Produces: function `renderAdvisorClients()` (fetches and renders the advisor's client roster), a new page reachable via `showPage('advisorClients', ...)`.

- [ ] **Step 1: Add a 6th nav item, visible only to advisors**

In the `<nav class="bottom-nav" ...>` block, insert a new button before the existing "הגדרות" button (which is last), matching the existing button structure exactly:

```html
  <button class="nav-item flex-1 flex flex-col items-center gap-1 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-all cursor-pointer" style="display:none" onclick="showPage('advisorClients',this)" id="nav-advisorClients" aria-label="לקוחות">
    <div class="nav-icon px-3 py-1.5 rounded-xl">
      <svg viewBox="0 0 24 24" class="w-5 h-5 stroke-current fill-none stroke-2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    </div>
    <span class="nav-label text-[11px] font-semibold">לקוחות</span>
  </button>
```

The inline `style="display:none"` is the default (hidden for non-advisors); Step 4 below makes it visible via JS once `_isAdvisor` is known — do NOT try to gate this via a CSS class alone, because unlike the desktop sidebar CSS (which only matters at `min-width:1024px`, safe to gate purely with `body.is-advisor` in a media query), this nav button must also stay hidden on narrow viewports for non-advisors, and the existing `.bottom-nav`/`.nav-item` rules are shared across both mobile and desktop — a JS-driven `display` toggle is simpler and consistent with how `#modeSwitcher` and other conditional UI in this file already work (compare index.html:1493, `style="display:none"` toggled by JS).

- [ ] **Step 2: Add the page container**

Insert immediately after the closing `</div>` of `<div id="page-budget" class="page">` (find it — the last of the 4 existing page divs, before `</main>`... actually insert right after whichever page div is last in source order, keeping the existing divs untouched):

```html
  <div id="page-advisorClients" class="page">
    <div style="margin:2px 2px 16px">
      <div style="font-family:var(--font-sans);font-size:1.35rem;font-weight:800;color:var(--text)">לקוחות</div>
    </div>
    <div id="advisorClientsList" style="display:flex;flex-direction:column;gap:10px"></div>
  </div>
```

- [ ] **Step 3: Add `renderAdvisorClients()` and wire it into `showPage()`**

Add this function in the advisor code block (near the Task 3/4 functions), labeled consistently:

```javascript
// ── Advisor console — client roster ─────────────────────────────
async function renderAdvisorClients(){
  const el=document.getElementById('advisorClientsList');
  if(!el||!_sb||!_cloudUser)return;
  const {data,error}=await _sb.from('advisor_clients').select('*').eq('advisor_id',_cloudUser.id).eq('status','active').order('created_at',{ascending:false});
  if(error||!data||!data.length){
    el.innerHTML='<div style="text-align:center;padding:40px 0;color:var(--text3);font-size:0.9rem">אין עדיין לקוחות מחוברים</div>';
    return;
  }
  el.innerHTML=data.map(c=>
    '<div class="card" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="enterClientBudget(\''+c.client_id+'\',\''+esc(c.client_email)+'\')">'
    +'<div style="font-weight:700;color:var(--text)">'+esc(c.client_email)+'</div>'
    +'<div style="color:var(--accent);font-size:0.85rem;font-weight:700">כניסה לתקציב ←</div>'
    +'</div>'
  ).join('');
}
```

Then modify `showPage()` (index.html:5099-5116, the function added in the prior plan review — currently ends with `if(name==='loans') renderLoans();`) to add one more branch:

```javascript
  if(name==='loans')        renderLoans();
  if(name==='advisorClients') renderAdvisorClients();
}
```

- [ ] **Step 4: Show/hide the nav item based on `_isAdvisor`**

In `_applyAdvisorGate()` (Task 4), also toggle the nav button's visibility:

```javascript
function _applyAdvisorGate(){
  document.body.classList.toggle('is-advisor', _isAdvisor);
  const navBtn=document.getElementById('nav-advisorClients');
  if(navBtn)navBtn.style.display=_isAdvisor?'':'none';
}
```

- [ ] **Step 5: Verify with Playwright**

Same server/bypass setup as prior tasks. Confirm via `browser_evaluate`: `document.getElementById('page-advisorClients')` exists; `document.getElementById('nav-advisorClients')` exists and has `style.display === 'none'` by default (no session ⇒ `_isAdvisor` stays `false`); manually set `_isAdvisor=true; _applyAdvisorGate();` via `browser_evaluate` and confirm the nav button's computed `display` is no longer `none`. Click it (or call `showPage('advisorClients', document.getElementById('nav-advisorClients'))` via `browser_evaluate`) and confirm `#page-advisorClients` gets `class="page active"` and `#advisorClientsList` shows the empty state (`"אין עדיין לקוחות מחוברים"`, since there's no real Supabase data in this sandbox).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "add advisor client-list screen and sidebar entry point"
```

---

### Task 6: Enter and exit a client's budget

**Files:**
- Modify: `index.html`, the `<style>` block (one new rule, `.advisor-view-bar`)
- Modify: `index.html`, `<main id="main-content">` — add the top-bar element as a direct child of `<body>` (sibling to `<header>`, so it can float above `<main>` regardless of which page is active)
- Modify: `index.html`, the advisor JS block (add `enterClientBudget`, `exitClientBudget`)

**Interfaces:**
- Consumes: `_householdOwner` (existing global, reused as the account-switch pointer — same mechanism a household member already uses to view their partner's budget), `_loadFromCloud()`, `refreshAll()`, `showPage()` (all existing).
- Produces: globals `_advisorViewingClient` (`{id, name}` or `null`) and `_advisorPriorHouseholdOwner` (saves/restores `_householdOwner` across the advisor view session), functions `enterClientBudget(clientUserId, clientName)` and `exitClientBudget()`.

- [ ] **Step 1: Add the top bar CSS**

Add this rule near the other fixed-positioned UI elements (e.g. right after the `.fab` rules, index.html around line 92):

```css
    .advisor-view-bar{display:none;position:fixed;top:var(--header-h);left:0;right:0;z-index:199;background:rgba(var(--accent-rgb),0.15);border-bottom:1px solid rgba(var(--accent-rgb),0.4);color:var(--accent);padding:10px 16px;align-items:center;justify-content:space-between;font-size:0.85rem;font-weight:700;gap:10px;}
    body.is-advisor.advisor-viewing-client .advisor-view-bar{display:flex;}
```

- [ ] **Step 2: Add the top bar HTML**

Insert immediately before the `<nav class="bottom-nav" ...>` element (so it's a sibling at the same DOM level, not nested inside `<main>`):

```html
<div class="advisor-view-bar" id="advisorViewBar">
  <span>👁️ אתה צופה בתקציב של <b id="advisorViewBarName"></b> — כל שינוי נשמר אצלם</span>
  <button class="btn btn-sm" style="background:var(--accent);color:#fff;border:none" onclick="exitClientBudget()">חזרה ללקוחות ←</button>
</div>
```

- [ ] **Step 3: Add `enterClientBudget` / `exitClientBudget`**

Add to the advisor JS block, right after `renderAdvisorClients()`:

```javascript
let _advisorViewingClient=null;
let _advisorPriorHouseholdOwner=null;
async function enterClientBudget(clientUserId,clientName){
  _advisorPriorHouseholdOwner=_householdOwner;
  _advisorViewingClient={id:clientUserId,name:clientName};
  _householdOwner=clientUserId;
  document.body.classList.add('advisor-viewing-client');
  document.getElementById('advisorViewBarName').textContent=clientName;
  await _loadFromCloud();
  refreshAll();
  showPage('dashboard',document.getElementById('nav-dashboard'));
}
async function exitClientBudget(){
  _householdOwner=_advisorPriorHouseholdOwner;
  _advisorPriorHouseholdOwner=null;
  _advisorViewingClient=null;
  document.body.classList.remove('advisor-viewing-client');
  await _loadFromCloud();
  refreshAll();
  showPage('advisorClients',document.getElementById('nav-advisorClients'));
}
```

- [ ] **Step 4: Verify with Playwright**

Same server/bypass setup. Via `browser_evaluate`, confirm `typeof enterClientBudget==='function'` and `typeof exitClientBudget==='function'`. Simulate entering a client view without live Supabase data (since `_loadFromCloud()` will no-op/fail safely against a null `_sb`/`_cloudUser` in this sandbox — confirm it doesn't throw): call `enterClientBudget('00000000-0000-0000-0000-000000000000','לקוח בדיקה')` via `browser_evaluate` wrapped in try/catch, then confirm `document.body.classList.contains('advisor-viewing-client')` is `true` and `document.getElementById('advisorViewBarName').textContent === 'לקוח בדיקה'`. Then call `exitClientBudget()` and confirm the class is removed. Document in the report that this exercises the DOM/state-switching logic only — the actual cross-account data fetch requires live Supabase auth, which is outside this sandbox's reach (same class of gap as Tasks 3-4).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "add advisor enter/exit client budget flow"
```
