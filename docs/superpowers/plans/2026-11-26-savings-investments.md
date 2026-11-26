# Savings and Investments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the goals screen into "חיסכון והשקעות". Savings and investment rows from the cashflow accumulate there, and goals can link to them.

**Architecture:** Savings rows are `fixed_expenses` rows flagged `savings:true`, which is the shape the advisor app already reads. `SAVING_FIXED_CATS` gives way to one helper, `_savingCats()`. The goals page renders funds (one per savings row) and goals. Balances are derived values and are never stored.

**Tech Stack:** a single `index.html` (vanilla JS), `node --test scripts/personal-app.test.cjs`, and Playwright from the npx cache for screenshots.

**Spec:** `docs/superpowers/specs/2026-11-26-savings-investments-design.md`

## Global Constraints
- No new DB columns. Fund fields live on `fixed_expenses` rows: `{id, amount, savings:true, kind, fromSalary, opening, value, valueDate, since}`. Goal links live on `goals` rows: `{fund}`.
- `kind` is one of `standing|trading|hishtalmut|gemel|other`. The labels are: הוראת קבע לחסכון, תיק מסחר, קרן השתלמות, קופת גמל, אחר.
- `fromSalary` defaults to true for `hishtalmut` and `gemel`, and to false otherwise. From-salary rows never post a transaction.
- When the only savings row is "הוראת קבע לחסכון", every total in the cashflow, summary and home screen stays exactly what it is today.
- Hebrew UI, RTL, both themes, 44px targets, CSS custom properties only, amounts through `fmt`.
- Work happens in a `git worktree add --no-track` copy. Nothing reaches `main` until David approves the screenshots.

## Review Focus
- A from-salary fund must not lower "נשאר לך החודש", the cashflow "בפועל", or the summary actuals. Test in Task 1.
- Renaming or deleting a fund that a goal links to must leave the goal working, falling back to its manual `saved`. Test in Task 3.
- A value entered without a value date shows the value but no gain. Test in Task 2.
- A user who already made goal + deposits sees them counted as savings, not expenses, after load. Test in Task 1.
- An old client that runs the previous app version and sees `savings` rows must not crash. Tolerated, because extra row fields are ignored by `_mergeArrays`. No test, review only.

---

### Task 1: Savings categories helper and goal-deposit type

**Files:**
- Modify: `index.html`:
  - line 3289, `SAVING_FIXED_CATS`, and `catLabel` at line 3290;
  - every `SAVING_FIXED_CATS` use, at lines 3225, 4493, 4505, 4511, 7540-7541, 7765-7767, 8210 and 8232;
  - `_migrateCats` at line 3219;
  - `confirmAddToGoal` at about line 7974.
- Test: `scripts/personal-app.test.cjs`.

**Interfaces:**
- Produces:
  - `_savingCats(): string[]` returns `['הוראת קבע לחסכון', ...fixedExpenses.filter(r=>r.savings).map(r=>r.id)]`, deduplicated;
  - `_isSavingCat(cat): boolean`;
  - `_fundPostsTx(cat): boolean` is false only for a row with `fromSalary`.

- [ ] **Step 1: Write the failing tests**
  - `test('savings categories include flagged fixed rows', …)`:
    - with rows `[{id:'קרן השתלמות',savings:true},{id:'דיור'}]`, `_savingCats()` returns `['הוראת קבע לחסכון','קרן השתלמות']`;
    - `_isSavingCat('דיור')` is false.
  - `test('a goal deposit is saving, and old ones migrate', …)`: `_migrateCats` turns `{goalTx:true,type:'expense'}` into `type:'saving'` and returns true.
  - `test('from-salary funds post nothing', …)`: `_fxApply` with row `{id:'קופת גמל',amount:500,savings:true,fromSalary:true}` creates no transaction for that category.
- [ ] **Step 2: Run** `node --test scripts/personal-app.test.cjs`. Expected: the 3 new tests fail.
- [ ] **Step 3: Implement**
  - Replace every `SAVING_FIXED_CATS.includes(x)` with `_isSavingCat(x)`, and every array use with `_savingCats()`.
  - `catLabel` keeps "חיסכון והשקעות" for 'הוראת קבע לחסכון' only.
  - In `_fxApply`, skip categories where `!_fundPostsTx(cat)`.
  - In `confirmAddToGoal`, deposits use `type:'saving'`.
  - Add the `goalTx` migration to `_migrateCats`.
  - Update the summary test stubs: replace `SAVING_FIXED_CATS:[…]` with `_savingCats:()=>[…]` and `_isSavingCat:c=>[…].includes(c)`.
- [ ] **Step 4: Run tests.** Expected: everything passes, the existing summary tests included, which proves the totals did not change.
- [ ] **Step 5: Commit** with the message "savings: one helper for savings categories, goal deposits count as savings".

### Task 2: Fund balance math

**Files:** `index.html`, next to `_fxMonthly` at about line 8202. Test: `scripts/personal-app.test.cjs`.

**Interfaces:**
- Consumes: `_fundPostsTx` from Task 1.
- Produces: `_fundStats(row, now=new Date()): {deposited:number, value:number|null, gain:number|null}`.
  - `deposited` is `opening` plus:
    - for posting rows, the sum of `saving` transactions with `cat===row.id`;
    - for from-salary rows, `amount × months` from `since` to `now` inclusive.
  - `gain` is `value − deposited` when `value` and `valueDate` are both set. The deposits counted are those up to `valueDate`. Otherwise `gain` is null.
- `_funds(): row[]` returns the savings rows. When the standing-order category has an amount but no row, it is included as `{id:'הוראת קבע לחסכון',kind:'standing'}`.

- [ ] **Step 1: Write the failing tests**
  - `_fundStats({id:'X',opening:1000,savings:true}, …)` with two saving transactions of 500 in category X: `deposited` is 2000 and `gain` is null.
  - from-salary `{amount:300,fromSalary:true,since:'2026-09',opening:0}` with `now` set to 2026-11-26: `deposited` is 900.
  - with `{value:2500,valueDate:'2026-11-20'}` and the same transactions: `gain` is 500.
  - with `value` set and no `valueDate`: `value` is 2500 and `gain` is null.
- [ ] **Step 2: Run.** Expected: FAIL, `_fundStats` is not defined.
- [ ] **Step 3: Implement** both functions.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with the message "savings: fund balance from deposits, salary months and value".

### Task 3: Cashflow section, fund editing and goal links

**Files:** `index.html`:
- the cashflow savings section at lines 4491-4509;
- `_expEditManual` and `_expDeleteManual` at lines 4664-4682;
- the `addGoalSheet` markup at line 2006;
- `addGoal` and `editGoal`, and `deleteGoal` at about line 7941.

Test: `scripts/personal-app.test.cjs`.

**Interfaces:**
- Consumes: `_funds`, `_fundStats` and `_isSavingCat` from Tasks 1 and 2.
- Produces:
  - `addFund()` and `editFund(id)` open a `promptSheet` with fields name, kind (select), monthly amount, source (select, מהחשבון or מהמשכורת), opening balance, current value. `valueDate` is set to today whenever the value changes.
  - `deleteFund(id)` removes the row, clears `fund` on the goals that link to it, and shows an undo toast.
  - `_goalSaved(g): number` returns the linked fund's `value ?? deposited` when the fund exists, and `g.saved` otherwise.

- [ ] **Step 1: Write the failing tests**
  - `_goalSaved({saved:100,fund:'X'})` returns the fund's `deposited` when a fund X exists, and 100 when X was deleted.
  - `deleteFund('X')` removes the row and sets `goal.fund` to undefined.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**
  - The cashflow savings section lists every `_funds()` row, with a small tag for מהמשכורת. Its "+" calls `addFund()`, and a row's edit and delete call `editFund` and `deleteFund`.
  - The section total counts only posting rows, so the flow totals do not change.
  - The goal sheet gets a "קשר לקופה" select, with ללא plus the funds.
  - Delete moves into the goal sheet as a quiet text button "מחק יעד", shown only while editing.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** with the message "savings: add, edit and delete funds from the cashflow, link goals to funds".

### Task 4: The "חיסכון והשקעות" screen

**Files:** `index.html`:
- `#page-goals` markup at lines 2542-2552;
- `renderGoals` at about line 8260;
- the goal CSS at lines 392-413;
- the labels "יעדי חיסכון" at lines 2232, 2609 and 3749.

**Interfaces:**
- Consumes: `_funds`, `_fundStats` and `_goalSaved`.
- Produces: `renderGoals()`, which renders three things in order.
  - **The summary box:** total deposited, total value (shown only when any fund has a value), and the goals' monthly need against the planned savings (the sum of `_fxMonthly` over `_savingCats()`). The warning reads "היעדים דורשים ₪X בחודש, מתוכננים לחיסכון ₪Y" when the need is greater.
  - **Funds:** one card per fund. The card shows the kind label, "הופקד" and, when a value exists, the value plus a gain line in green or red with the date of the value. Tapping the card calls `editFund`.
  - **Goals:** linked goals show the fund name and have no + or −. Completed goals sit under a "הושלמו" heading at the bottom. There is no ✕ on cards.
- CSS: `.goal-card .prog-wrap{direction:rtl}`, so the bar fills from the right.

- [ ] **Step 1:** Implement the render and the CSS.
- [ ] **Step 2: Run** `node --test scripts/personal-app.test.cjs`. Expected: PASS.
- [ ] **Step 3: Screenshots** at 390 px in light and dark, saved to the scratchpad, with seed data of 3 funds (standing, trading with a value, hishtalmut from salary) and 3 goals (linked, manual, completed):
  - the page;
  - the cashflow savings section;
  - the fund sheet;
  - the goal sheet.
- [ ] **Step 4: Check totals** with the old single-row seed: dashboard, summary and cashflow numbers equal the `main` build's numbers.
- [ ] **Step 5: Commit** with the message "savings: חיסכון והשקעות screen with funds, linked goals and summary". Then show the screenshots to David, and merge to `main` only after he approves.
