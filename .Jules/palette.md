## 2024-05-18 - Add Task Deletion Confirmation Dialog
**Learning:** Destructive actions like deleting tasks were previously executed immediately upon clicking the "Delete" button without confirmation. This lacked friction and was prone to accidental data loss. Using Radix UI's (or shadcn/ui's) `AlertDialog` is an effective, accessible, and standardized way to solve this in the app without custom modal implementations.
**Action:** When working on destructive actions in this repo, standard practice should be to wrap the trigger button with the existing `AlertDialog` components to ensure a safe, accessible, and user-friendly experience.

## 2024-05-19 - Improve Chat Send Button UX
**Learning:** Icon-only buttons (like the chat "Send" button) need not only `aria-label`s for screen readers but also explicit focus indicators and disabled states to improve accessibility. Specifically, disabling the send button when the input is empty provides immediate visual feedback, avoiding confusing "silent failures" on click.
**Action:** Always verify that icon-only interactive elements have clear focus styles (`focus-visible:ring-2`), meaningful ARIA labels, and explicit disabled states (with visual cues like `disabled:opacity-50 disabled:cursor-not-allowed`) when their action is conditionally valid.

## 2025-02-18 - Add Focus Indicators to Interactive Elements
**Learning:** Raw `<button>` or `<Link>` tags without explicit focus indicators lead to poor accessibility for keyboard navigation. While many of the customized components in this application (like shadcn `Button`) include robust keyboard focus styles by default, unstyled semantic HTML elements do not inherit these out-of-the-box.
**Action:** Always add explicit keyboard focus indicators (e.g. `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`) to raw buttons, anchor links, and custom interactive components to ensure visual affordances remain intact during keyboard-based navigation.

## 2026-05-27 - Add Tooltips to Icon-only Buttons
**Learning:** Icon-only buttons with `aria-label` are accessible to screen readers, but sighted users (especially new ones) may struggle to understand ambiguous icons like `+`. Adding tooltips bridges this gap and improves discoverability.
**Action:** Always pair icon-only buttons with tooltips using the existing UI components (like `Tooltip` from Radix UI) so that visual context is provided alongside screen reader context.
## 2026-06-03 - Add Tooltips to Icon-only Buttons in CalendarView
**Learning:** Icon-only buttons with `aria-label` are accessible to screen readers, but sighted users may struggle to understand ambiguous icons. Adding tooltips bridges this gap and improves discoverability.
**Action:** Always pair icon-only buttons with tooltips using the existing UI components (like `Tooltip` from Radix UI) so that visual context is provided alongside screen reader context.
## 2026-06-06 - Added aria-label to channel input\n**Learning:** Relying solely on the placeholder attribute for input fields is an accessibility anti-pattern because placeholders are not always reliably announced by screen readers and can disappear as soon as the user starts typing. Providing a proper aria-label ensures screen readers can announce the purpose of an otherwise unlabeled input field, making components like chat inputs more accessible.\n**Action:** Add aria-label or explicit visible label elements alongside inputs, especially those used in compact interfaces like sidebars or messaging panels.
## 2026-06-08 - Add Focus Indicators to Unstyled Interactive Elements
**Learning:** Standard UI components inherit keyboard focus styles, but customized unstyled button components (like the Theme selection buttons) or error page buttons can easily miss these crucial styles, making them inaccessible for keyboard users.
**Action:** Always ensure that custom `<button>` or unstyled interactive elements have explicit focus indicators (e.g., `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`).
