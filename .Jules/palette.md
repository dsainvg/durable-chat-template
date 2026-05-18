## 2024-05-18 - Add Task Deletion Confirmation Dialog
**Learning:** Destructive actions like deleting tasks were previously executed immediately upon clicking the "Delete" button without confirmation. This lacked friction and was prone to accidental data loss. Using Radix UI's (or shadcn/ui's) `AlertDialog` is an effective, accessible, and standardized way to solve this in the app without custom modal implementations.
**Action:** When working on destructive actions in this repo, standard practice should be to wrap the trigger button with the existing `AlertDialog` components to ensure a safe, accessible, and user-friendly experience.

## 2024-05-19 - Improve Chat Send Button UX
**Learning:** Icon-only buttons (like the chat "Send" button) need not only `aria-label`s for screen readers but also explicit focus indicators and disabled states to improve accessibility. Specifically, disabling the send button when the input is empty provides immediate visual feedback, avoiding confusing "silent failures" on click.
**Action:** Always verify that icon-only interactive elements have clear focus styles (`focus-visible:ring-2`), meaningful ARIA labels, and explicit disabled states (with visual cues like `disabled:opacity-50 disabled:cursor-not-allowed`) when their action is conditionally valid.
