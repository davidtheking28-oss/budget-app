# Desktop Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a ≥1024px desktop layout to `index.html` — the bottom nav becomes a right-side sidebar, and page content expands to fill the extra width — with zero changes to data, JS logic, or the existing mobile layout.

**Architecture:** Pure CSS addition inside the existing `<style>` block (index.html:29-...), gated by a single `@media(min-width:1024px)` rule. No new files, no JS changes, no schema changes. Verified by loading the file in a local static server and checking both a mobile viewport (390×844) and a desktop viewport (1440×900) with Playwright.

**Tech Stack:** Plain CSS (no build step — `index.html` is served as-is), Playwright MCP for visual verification (this repo has no CSS/unit test framework).

## Global Constraints

- Single-file app: all changes go into `c:\Users\david\projects\ai-budget\index.html`. Do not create new files or extract CSS.
- RTL layout throughout — `dir="rtl"` on `<html>` (index.html:2). "Right side" in CSS means the `right` property, not `left`.
- Never touch JS logic, Supabase calls, or the `budget_data`/`households` schema — this plan is CSS/layout only, per the approved spec (`docs/superpowers/specs/2026-07-13-advisor-desktop-platform-design.md`, Step 1).
- Existing CSS custom properties must be reused, not hardcoded: `--accent`, `--accent-rgb`, `--border`, `--surface`, `--nav-h`, `--header-h` (defined at index.html:30).
- No test framework exists in this repo. Verification for every task is: (a) start a local static server, (b) use Playwright MCP to load the page at a mobile width and confirm the existing mobile layout is pixel-unchanged in structure, (c) load at a desktop width and confirm the new layout renders. This substitutes for automated tests in this plan.
- The mobile bottom-nav bar (index.html:2118-2153), its `showPage()` handler (index.html:5081-5098), and the FAB button (index.html:2116) must keep working unmodified below 1024px.

---

### Task 1: Local static server + baseline mobile screenshot

**Files:**
- No file changes. This task only establishes the verification harness used by every later task.

**Interfaces:**
- Produces: a documented server-start command and a baseline screenshot file (`.playwright-mcp/baseline-mobile.png`) that Task 2 and Task 3 compare against.

- [ ] **Step 1: Start a local static server for the project root**

Run in the project root:

```bash
cd "c:/Users/david/projects/ai-budget" && python -m http.server 8973
```

Run this with `run_in_background: true` (it never exits on its own) so later steps can proceed.

- [ ] **Step 2: Load the page at mobile width and capture a baseline screenshot**

Use the Playwright MCP tools:

```
mcp__playwright__browser_navigate  { "url": "http://localhost:8973/index.html" }
mcp__playwright__browser_resize    { "width": 390, "height": 844 }
mcp__playwright__browser_take_screenshot { "type": "png", "scale": "css", "filename": "baseline-mobile.png", "fullPage": true }
```

Expected: page loads (some console errors from Supabase network calls being blocked are fine — CSS/DOM still renders), bottom nav with 5 items (`ראשי`, `הוצאות`, `תקציב`, `ניתוח`, `הגדרות`) visible fixed at the bottom, FAB visible as a floating circle above it.

- [ ] **Step 3: Capture a baseline desktop screenshot at the current (unfixed) layout**

```
mcp__playwright__browser_resize    { "width": 1440, "height": 900 }
mcp__playwright__browser_take_screenshot { "type": "png", "scale": "css", "filename": "baseline-desktop-before.png", "fullPage": true }
```

Expected: today's broken/un-adapted desktop view — bottom nav still full-width at the bottom, content still capped at `max-width:600px` and centered with large empty margins on both sides. This is the "before" reference for Task 2.

No commit for this task — it produces only local screenshots for comparison, not repo changes.

---

### Task 2: Convert the bottom nav into a desktop sidebar

**Files:**
- Modify: `index.html:79-97` (the `.bottom-nav`, `.nav-item`, `.fab`, and `main` CSS rules, inside the existing `<style>` block starting at index.html:29)

**Interfaces:**
- Consumes: existing CSS custom properties `--accent`, `--accent-rgb`, `--border`, `--surface`, `--header-h`, `--nav-h` (index.html:30).
- Produces: a `@media(min-width:1024px)` block placed immediately after the existing `main{...}` rule (index.html:95) and before `#inlineMonthNav{...}` (index.html:96), so Task 3 can append to the same block. This block must not redefine any selector already scoped only to mobile (`.sheet`, `.month-sheet`, etc.) — it only touches `.bottom-nav`, `.nav-item`, `.nav-item.active::after`, `.fab`, `.fab:active`, and `main`.

- [ ] **Step 1: Add the desktop media query**

Insert this block into `index.html` immediately after line 95 (`main{padding:...}`) and before line 96 (`#inlineMonthNav{...}`):

```css
    @media(min-width:1024px){
      .bottom-nav{position:fixed;top:var(--header-h);right:0;left:auto;bottom:0;width:224px;height:auto;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:2px;padding:20px 0;border-top:none;border-left:1px solid var(--border);box-shadow:none;}
      .nav-item{flex:none;flex-direction:row;justify-content:flex-start;align-items:center;gap:12px;padding:12px 24px;}
      .nav-item .nav-icon{padding:6px;border-radius:10px;}
      .nav-item .nav-label{font-size:0.88rem;}
      .nav-item.active::after{display:none;}
      .nav-item.active{background:rgba(var(--accent-rgb),0.08);}
      .fab{left:auto;right:calc(224px + 32px);transform:none;}
      .fab:active{transform:scale(0.88);}
      main{margin-right:224px;margin-left:0;max-width:1040px;padding:calc(32px + env(safe-area-inset-top,0px) + var(--demo-bar-h)) 40px 40px;}
    }
```

- [ ] **Step 2: Verify the desktop sidebar renders correctly**

```
mcp__playwright__browser_navigate  { "url": "http://localhost:8973/index.html" }
mcp__playwright__browser_resize    { "width": 1440, "height": 900 }
mcp__playwright__browser_take_screenshot { "type": "png", "scale": "css", "filename": "desktop-sidebar-v1.png", "fullPage": true }
```

Expected, compared against `baseline-desktop-before.png`: the 5 nav items (`ראשי`, `הוצאות`, `תקציב`, `ניתוח`, `הגדרות`) now run vertically down a ~224px-wide strip on the right edge of the viewport, below the header; the main content area now spans from the left edge to the sidebar instead of being centered in a 600px column; the FAB (round add button) sits just to the left of the sidebar instead of centered under the whole viewport.

- [ ] **Step 3: Verify mobile is unchanged**

```
mcp__playwright__browser_resize    { "width": 390, "height": 844 }
mcp__playwright__browser_take_screenshot { "type": "png", "scale": "css", "filename": "mobile-after-task2.png", "fullPage": true }
```

Expected: pixel-identical layout to `baseline-mobile.png` — bottom nav still horizontal and fixed to the bottom, FAB still centered, content still in a single centered column. If anything differs, the media query leaked outside its `min-width:1024px` guard — fix before continuing.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "add desktop sidebar layout for >=1024px viewports"
```

---

### Task 3: Widen the dashboard summary cards row on desktop

**Files:**
- Modify: `index.html:98-99` (`.cards-row` / `.cards-row.three` rules)

**Interfaces:**
- Consumes: the `@media(min-width:1024px)` block added in Task 2 (index.html, immediately after the original `main{...}` rule) — this task adds one more declaration to that same block rather than creating a second media query.
- Produces: no new selectors — only extends the existing `.cards-row` rule's desktop behavior.

- [ ] **Step 1: Add a desktop override for `.cards-row`**

The existing rule (index.html:98-99):

```css
    .cards-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
    .cards-row.three{grid-template-columns:repeat(3,1fr);}
```

stays as the mobile default. Add one line inside the `@media(min-width:1024px)` block created in Task 2 (append after the `main{...}` line added in Task 2, Step 1):

```css
      .cards-row{grid-template-columns:repeat(4,1fr);gap:14px;}
```

- [ ] **Step 2: Verify the dashboard summary cards lay out in a row on desktop**

```
mcp__playwright__browser_navigate  { "url": "http://localhost:8973/index.html" }
mcp__playwright__browser_resize    { "width": 1440, "height": 900 }
mcp__playwright__browser_take_screenshot { "type": "png", "scale": "css", "filename": "desktop-cards-row.png", "fullPage": true }
```

Expected: any element using `.cards-row` (income/expense sub-cards on the dashboard, index.html:1535, plus any other `.cards-row` usage in the budget/analytics pages) lays out across up to 4 columns instead of 2, using the extra horizontal space freed up by the sidebar conversion in Task 2.

- [ ] **Step 3: Verify mobile is still unchanged**

```
mcp__playwright__browser_resize    { "width": 390, "height": 844 }
mcp__playwright__browser_take_screenshot { "type": "png", "scale": "css", "filename": "mobile-after-task3.png", "fullPage": true }
```

Expected: identical to `baseline-mobile.png` — cards still stack 2-per-row.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "widen summary cards row on desktop layout"
```

---

### Task 4: Deploy verification

**Files:**
- No file changes.

**Interfaces:**
- Consumes: the committed changes from Tasks 2-3, pushed to `main` (push happens automatically via the repo's auto-push hook after each commit, per `C:\Users\david\.claude\rules\git-workflow.md`).

- [ ] **Step 1: Confirm GitHub Pages picked up the deploy**

Per `CLAUDE.md`'s deploy-verification convention, after the auto-push completes and the `.github/workflows/deploy.yml` run finishes:

```bash
curl -s https://davidtheking28-oss.github.io/budget-app/index.html | grep -c "bottom-nav"
```

Expected: a non-zero count, confirming the deployed file is the updated one (not a stale cache). This does not check layout visually — it only confirms the deploy shipped the right file. Cross-check the desktop layout live in a browser at davidtheking28-oss.github.io/budget-app/ resized to ≥1024px width if you want visual confirmation beyond this.

No commit for this task.
