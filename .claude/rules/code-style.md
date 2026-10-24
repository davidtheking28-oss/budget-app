# Code Style Rules (this project)

## JavaScript
- Prefer `const` and `let`, never `var`
- Use `async/await` over `.then()` chains — except for fire-and-forget background calls
- Optimistic UI updates first, then persist to Supabase in background
- IDs from Supabase are the source of truth — never use local fake IDs for Supabase operations
- Always check for null before accessing nested properties (use `?.` optional chaining)

## HTML/CSS
- Inline styles are acceptable for one-off overrides — no need to create a class for everything
- Use CSS custom properties (`var(--accent)`, `var(--bg)`) for colors — never hardcode hex in new rules
- `!important` only when overriding a third-party or legacy block that can't be refactored
