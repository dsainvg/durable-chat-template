## 2026-06-14 - Initializing Palette Journal\n**Learning:** Creating journal to store critical UX learnings.\n**Action:** Start looking for UX enhancements.
## 2026-06-14 - Enhanced Login Dialog Accessibility and Feedback
**Learning:** Adding a password visibility toggle greatly improves UX, especially when creating or verifying secure passwords. Ensuring the toggle uses an `aria-label` allows screen readers to provide context for the action, while updating the label based on the state ("Show password" / "Hide password") offers dynamic feedback. Using a `Loader2` spinner with `"Please wait..."` keeps the user informed and prevents redundant submissions during async operations.
**Action:** Always include an accessible (aria-labeled) visibility toggle in password inputs and pair disabled loading buttons with a clear visual indicator (like a spinner) and informative text.

## 2026-06-14 - Explicit ARIA Labels for Truncated List Items
**Learning:** In timeline, calendar, and Kanban views, item titles are frequently truncated visually (e.g., using `text-overflow: ellipsis` or limiting to `...`). While sighted users infer context from layout, screen readers might only announce the truncated string or confusing internal DOM structure without explicitly hearing the full title.
**Action:** Always add an explicit, non-truncated `aria-label` (e.g., `aria-label={"Task: " + task.title}`) to the interactive wrapper (`<button>` or `<a href>`) of dynamic list items that might be visually compressed or truncated, ensuring complete context is available to assistive technologies.
