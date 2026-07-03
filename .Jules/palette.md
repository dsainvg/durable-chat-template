## 2026-06-14 - Initializing Palette Journal\n**Learning:** Creating journal to store critical UX learnings.\n**Action:** Start looking for UX enhancements.
## 2026-06-14 - Enhanced Login Dialog Accessibility and Feedback
**Learning:** Adding a password visibility toggle greatly improves UX, especially when creating or verifying secure passwords. Ensuring the toggle uses an `aria-label` allows screen readers to provide context for the action, while updating the label based on the state ("Show password" / "Hide password") offers dynamic feedback. Using a `Loader2` spinner with `"Please wait..."` keeps the user informed and prevents redundant submissions during async operations.
**Action:** Always include an accessible (aria-labeled) visibility toggle in password inputs and pair disabled loading buttons with a clear visual indicator (like a spinner) and informative text.

## 2024-05-24 - Tooltips for Icon-only Buttons
**Learning:** Found an icon-only button with an ARIA label but lacking a tooltip in the `ExcelIntegration` component. Adding a tooltip provides visible context on hover/focus, which is a helpful fallback description for visual users. Also learned that `TooltipProvider` shouldn't be inside a `.map()` loop, but instead should wrap the entire section.
**Action:** When auditing icon-only buttons, prioritize wrapping them in standard design system Tooltips where available to enhance both visual UX and accessibility. Ensure `TooltipProvider` wraps the parent container rather than individual items.
