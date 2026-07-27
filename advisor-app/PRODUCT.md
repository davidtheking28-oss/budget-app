# Product

## Register

product

## Users
Financial advisors managing multiple clients' personal budgets. They work through
a client list, then drill into one client at a time to review expenses, budgets,
goals, subscriptions/loans, and CRM notes (meetings, tasks). Sessions are focused,
repeated daily/weekly work — not a marketing surface, not a consumer app. Desktop-first
with a functional mobile fallback.

## Product Purpose
"Budget Advisor" gives an advisor a fast, trustworthy operational view into each
client's finances: where money is going, whether budgets and goals are on track,
what's coming up (meetings, tasks, renewals), and how much debt/recurring cost the
client is carrying. Success looks like an advisor being able to prep for or run a
client meeting entirely from this screen, with numbers they trust and can act on.

## Brand Personality
Precise, calm, quietly confident. Not playful, not corporate-sterile. The existing
codebase commits to this: a light-default, dark-optional mint-teal palette, a single
type family (Assistant) carrying both display and body with hierarchy from weight and
size, a restrained single teal accent, and flat surfaces with a soft card shadow
rather than gradients or texture. Assistant is also the family used by the sibling
client budget app, so the two products read as one system. Reads as a considered
financial tool, not a generic SaaS template.

## Anti-references
No strong preference stated by the user — treat the established in-repo design
language (see DESIGN.md, and `src/theme.css` as its source of truth) as the reference
to stay consistent with. Avoid one-off styling that ignores the token set, and avoid
decoration that competes with the numbers.

## Design Principles
- Consistency over novelty: new/redesigned sections must read as part of the same
  system as Dashboard, Goals, Budget — same tokens, same empty-state and card
  language, not a one-off style.
- Numbers are the product: currency, dates, and counts get clear hierarchy and
  `direction: ltr` + `unicode-bidi: isolate` + tabular-nums treatment; never let
  decoration compete with data.
- Calm density: an advisor scans this between/during client calls, so favor clear
  grouping and scannability over compact-but-cluttered layouts.
- RTL-first: every layout decision must hold up in Hebrew RTL — logical CSS
  properties by default, with the documented physical-property exceptions for
  progress fills (see DESIGN.md section 7).
- Both themes are real: light is the default and dark is opt-in via the rail
  toggle; any change must be checked in both.

## מיפוי כלכלי (Economic Mapping)
A first-meeting tool, separate from the client's ongoing budget: the advisor
uploads up to 3 months of the client's credit-card statements (PDF or photos),
AI extracts and categorizes every transaction, and the advisor sees a
calendar-month average per category — a data-driven starting point before
building the client's actual budget together. It is deliberately decoupled
from `budget_data`: a standalone snapshot the advisor references during
onboarding, not a synced record that feeds the other tabs. Statement files are
parsed transiently and never stored — only the extracted, aggregated numbers
persist.

## Accessibility & Inclusion
No specific requirements stated. Maintain existing standards already in the
codebase: visible focus rings (`:focus-visible`), `prefers-reduced-motion` handling,
44x44px minimum touch targets on mobile, sufficient text contrast in both the light
and dark themes.
