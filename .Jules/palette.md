## 2026-06-14 - Initializing Palette Journal\n**Learning:** Creating journal to store critical UX learnings.\n**Action:** Start looking for UX enhancements.
## 2026-06-14 - Enhanced Login Dialog Accessibility and Feedback
**Learning:** Adding a password visibility toggle greatly improves UX, especially when creating or verifying secure passwords. Ensuring the toggle uses an `aria-label` allows screen readers to provide context for the action, while updating the label based on the state ("Show password" / "Hide password") offers dynamic feedback. Using a `Loader2` spinner with `"Please wait..."` keeps the user informed and prevents redundant submissions during async operations.
**Action:** Always include an accessible (aria-labeled) visibility toggle in password inputs and pair disabled loading buttons with a clear visual indicator (like a spinner) and informative text.
## 2026-06-14 - Enhanced Login Dialog Accessibility and Feedback
**Learning:** Adding explicit visual loading indicators (like a `Loader2` spinner) to interactive elements (such as profile selection buttons) during async operations provides critical feedback to the user, improving upon simply disabling the element.
**Action:** Always pair a disabled state with an explicit visual loading indicator, such as a spinner, when an interactive element triggers an asynchronous operation.
