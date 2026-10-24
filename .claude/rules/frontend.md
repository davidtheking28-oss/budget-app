# Frontend Rules

## Stack
- Single HTML file: `budget-app-new.html` — all CSS, HTML, JS in one file
- Chart.js for charts — use `maintainAspectRatio: false` on all charts
- Supabase JS client (`_sb`) for all data operations
- RTL layout (Hebrew) — use `text-align: right`, be aware of flex/grid direction

## Design System
- Background: `var(--bg)` (#0d1526 dark navy)
- Accent: `var(--accent)` (#4f83ff indigo-blue)
- Text hierarchy: `var(--text)` → `var(--text2)` → `var(--text3)`
- Card background: `linear-gradient(145deg, #091525, #0b1e38)`
- Border: `rgba(255,255,255,0.07)` for dark cards
- Border radius: 14px cards, 18px larger sections
- Font: Inter / Plus Jakarta Sans

## UX Patterns
- Optimistic UI: update DOM immediately, save to Supabase in background — rollback on error
- Show `toast()` for success/error feedback on every user action
- Use `cursor: pointer` on all clickable elements
- Transitions: 150–300ms for micro-interactions
- Mobile: minimum 44×44px touch targets

## Charts (Chart.js)
- Always set `maintainAspectRatio: false` on every chart
- Use canvas gradient fills for line charts — not flat rgba colors
- Tick color: `#8faac8`, font size 12px weight 500
- Grid color: `rgba(148,163,184,0.09)`

## Data Flow
- `db.stocks` and `db.crypto` are the in-memory arrays loaded from Supabase
- `loadDB()` fetches fresh from Supabase and rebuilds the arrays
- `_rowToTrade(row)` converts Supabase row → JS object
- `_tradeToRow(trade)` converts JS object → Supabase row
- `renderTable(type)` re-renders the trade table for 'stock' or 'crypto'
- `renderOverview()` re-renders the overview/dashboard tab

## Privacy Mode
- Wrap sensitive numbers in `<span class="sensitive">` — the privacy toggle hides these
- Call `applyPrivacy()` after rendering content that contains sensitive data
