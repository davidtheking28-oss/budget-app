# Savings and investments screen

Date: 2026-11-26. Status: waiting for David's approval.

## Intent
David wants the savings-goals screen (`#page-goals` in `index.html`) to become a screen for savings **and investments**. What the cashflow already records as savings should flow into it on its own. Investments here means a trading account, a study fund (קרן השתלמות) and a provident fund (קופת גמל).

## Goals
- Approach chosen: **A**. Investments are a kind of savings row in the cashflow. Each row becomes a card on the new screen.
- The cashflow section "חסכונות והשקעות" can hold several rows, with quick picks: הוראת קבע לחסכון, תיק מסחר, קרן השתלמות, קופת גמל, and a free name.
- Every savings row has:
  - a monthly amount;
  - a source. "From the account" reduces the cashflow. "From the salary" does not, which is the default for study fund and provident fund.
  - an opening balance, optional;
  - a current value plus the date it was set, optional.
- The card shows the amount deposited: the opening balance plus the deposits accumulated so far. When a value was set, it also shows the value and the gain or loss.
- Goals stay. A goal can be linked to one savings row, and its progress then comes from that row's balance with no manual taps. Unlinked goals keep working with + and −.
- Fixes found in the review:
  - The progress bar fills left to right. It should fill from the right (RTL).
  - A + deposit is recorded as an `expense` (category "חיסכון ליעד") and inflates expenses. It should be type `saving`, and existing rows get migrated.
  - Delete (✕) sits on the card as prominently as + and −. Move it into the edit sheet.
  - A completed goal moves to a "הושלמו" group at the bottom.
  - A summary at the top: total deposited, total value, and the monthly amount the goals need against what is planned for savings. Warn when the goals need more than that.

## Non-goals
- Advisor-entered assets ("נכסים והתחייבויות") stay separate and unchanged.
- No live market prices and no bank or broker connections.
- Advisor-app screens are not redesigned. Data stays readable there: see the constraints.

## Anti-goals
- The cashflow, summary or home screen must not change their totals for a user who changes nothing. The single existing "הוראת קבע לחסכון" row keeps working exactly as it does today.
- A from-salary deposit must never reduce the cashflow or the "נשאר לך החודש" amount.

## Constraints
- Data lives in the existing synced collections only:
  - savings rows extend `fixed_expenses` rows: `{id, amount, savings:true, kind, fromSalary, opening, value, valueDate, since}`;
  - goal links extend `goals` rows: `{fund}`.
  - No new DB column, so `_mergeArrays`, sync and the advisor read path keep working.
- The advisor app already treats `fixed_expenses` rows with `savings:true` and `type:'saving'` transactions as savings (`advisor-app/src/budget/budgetMath.js:98`). Keep that shape.
- Today `SAVING_FIXED_CATS` is hardcoded to one category. It becomes "the fixed rows marked `savings`, plus 'הוראת קבע לחסכון'", in one helper used everywhere it is read now: summary, cashflow, fixed page, `_fxApply` and the migration.
- How balances accumulate:
  - "from the account" rows: the opening balance plus the sum of `saving` transactions in that category, which is what `_fxApply` already posts each month;
  - "from the salary" rows: post no transaction. The balance is the opening balance plus the amount times the months since `since`, counting the current month.
- Hebrew, RTL, both themes, 44px touch targets. Rounding uses the existing `fmt` (rounds up).

## Approaches considered
- **A, chosen:** investments as savings rows in the cashflow. It reuses the monthly fixed-row mechanism and sync, and deposits record themselves. It touches the cashflow and the summary.
- **B, rejected:** investments only on the goals screen, entered by hand. Simpler, but money would not move from the cashflow, which is the point of the request.

## Left to the builder
- Card layout and the edit-sheet fields, within the existing card and sheet styles.
- Where the gain or loss and the value date sit on the card.
- Rename the screen and its entry points to "חיסכון והשקעות".

## Verification
- Tests in `scripts/personal-app.test.cjs`:
  - the savings-row helper;
  - balance accumulation for both sources;
  - the goal deposit migration;
  - a linked goal's progress;
  - totals unchanged for the existing single-row data shape.
- Screenshots at 390 px in light and dark: the new screen, the cashflow section and the edit sheets. Shown to David before deploy (work in a `--no-track` worktree).
