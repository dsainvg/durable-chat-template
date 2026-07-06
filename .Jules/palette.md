## 2026-06-14 - Initializing Palette Journal\n**Learning:** Creating journal to store critical UX learnings.\n**Action:** Start looking for UX enhancements.
## 2026-06-14 - Enhanced Login Dialog Accessibility and Feedback
**Learning:** Adding a password visibility toggle greatly improves UX, especially when creating or verifying secure passwords. Ensuring the toggle uses an `aria-label` allows screen readers to provide context for the action, while updating the label based on the state ("Show password" / "Hide password") offers dynamic feedback. Using a `Loader2` spinner with `"Please wait..."` keeps the user informed and prevents redundant submissions during async operations.
**Action:** Always include an accessible (aria-labeled) visibility toggle in password inputs and pair disabled loading buttons with a clear visual indicator (like a spinner) and informative text.
## 2026-06-14 - Inline Input Context
**Learning:** Icon-only action buttons next to inline inputs (like a chat input) lack both explicit screen-reader context and visual explanation.
**Action:** Always add an `aria-label` to the inline input (since there is no visible label), and wrap the adjacent icon-only action button in a Tooltip (while keeping the `aria-label` on the button itself) to ensure the intent is accessible via both assistive tech and visual hovering.
