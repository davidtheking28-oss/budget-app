# Frontend Rules

Applies to the personal app (`index.html`). `advisor-app/` is a separate React/Vite app with its own CSS modules.

## Stack
- Single HTML file: `index.html` — all CSS, HTML, JS in one file
- Chart.js 4 is lazy-loaded by `_ensureChartLibrary()` — await it before creating a chart, and set `maintainAspectRatio: false` on every chart
- Supabase JS client (`_sb`) for all cloud operations; the signed-in user is `_cloudUser`
- RTL layout (Hebrew) — use `text-align: right`, be aware of flex/grid direction

## Design System
- Light mode (`body:not(.dark)`, the "LIGHT-MODE POLISH" block): soft mint-grey — `--bg:#eef3f1`, `--surface:#fff`, `--accent:#0a7a62`
- Dark mode (`body.dark`): `--bg:#100f0d`, `--surface:#1a1916`, `--accent:#34d3a9`; toggled via `budget_theme` in localStorage
- Text hierarchy: `var(--text)` → `var(--text2)` → `var(--text3)`
- Border radius: `var(--radius)` (18px), `var(--radius-sm)` (12px)
- Font: Assistant, via `var(--font-sans)`; numbers use `var(--font-num)`
- Every new rule must work in both themes — use the custom properties, never hardcoded hex

## UX Patterns
- Optimistic UI: update DOM immediately, save in background
- Show `showToast()` for success/error feedback on every user action
- Use `cursor: pointer` on all clickable elements
- Transitions: 150–300ms for micro-interactions
- Mobile: minimum 44×44px touch targets

## Data Flow
- State lives in localStorage (`budget_*` keys, account-scoped) and syncs to the user's single `budget_data` row
- `saveData()` persists locally and schedules the cloud save (`scheduleCloudSave()` → `_doCloudSave()`); `_loadFromCloud()` pulls and merges
- `refreshAll()` re-renders the current page after a data change
