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
codebase already commits to this: a dark, tinted-neutral palette, a serif display
face (Frank Ruhl Libre) paired with a clean grotesque body face (Heebo), restrained
single-accent blue, subtle gradients and film grain for depth rather than flat panels.
Reads as a considered financial tool, not a generic SaaS template.

## Anti-references
No strong preference stated by the user — treat the established in-repo design
language (see DESIGN.md) as the reference to stay consistent with, and avoid drifting
toward generic light-mode SaaS dashboard cliches (flat white cards, blue-on-white
stat tiles, Bootstrap-y form controls) that would clash with the existing app.

## Design Principles
- Consistency over novelty: new/redesigned sections must read as part of the same
  system as Dashboard, Goals, Budget — same tokens, same empty-state and card
  language, not a one-off style.
- Numbers are the product: currency, dates, and counts get clear hierarchy and
  `direction: ltr` / tabular-nums treatment; never let decoration compete with data.
- Calm density: an advisor scans this between/during client calls, so favor clear
  grouping and scannability over compact-but-cluttered layouts.
- RTL-first: every layout decision must hold up in Hebrew RTL — logical CSS
  properties, not physical left/right.

## Accessibility & Inclusion
No specific requirements stated. Maintain existing standards already in the
codebase: visible focus rings (`:focus-visible`), `prefers-reduced-motion` handling,
44x44px minimum touch targets on mobile, sufficient text contrast against the dark
background.
