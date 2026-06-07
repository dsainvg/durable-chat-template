## 2024-05-18 - Add Task Deletion Confirmation Dialog
**Learning:** Destructive actions like deleting tasks were previously executed immediately upon clicking the "Delete" button without confirmation. This lacked friction and was prone to accidental data loss. Using Radix UI's (or shadcn/ui's) `AlertDialog` is an effective, accessible, and standardized way to solve this in the app without custom modal implementations.
**Action:** When working on destructive actions in this repo, standard practice should be to wrap the trigger button with the existing `AlertDialog` components to ensure a safe, accessible, and user-friendly experience.

## 2024-05-19 - Improve Chat Send Button UX
**Learning:** Icon-only buttons (like the chat "Send" button) need not only `aria-label`s for screen readers but also explicit focus indicators and disabled states to improve accessibility. Specifically, disabling the send button when the input is empty provides immediate visual feedback, avoiding confusing "silent failures" on click.
**Action:** Always verify that icon-only interactive elements have clear focus styles (`focus-visible:ring-2`), meaningful ARIA labels, and explicit disabled states (with visual cues like `disabled:opacity-50 disabled:cursor-not-allowed`) when their action is conditionally valid.

## 2025-02-18 - Add Focus Indicators to Interactive Elements
**Learning:** Raw `<button>` or `<Link>` tags without explicit focus indicators lead to poor accessibility for keyboard navigation. While many of the customized components in this application (like shadcn `Button`) include robust keyboard focus styles by default, unstyled semantic HTML elements do not inherit these out-of-the-box.
**Action:** Always add explicit keyboard focus indicators (e.g. `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`) to raw buttons, anchor links, and custom interactive components to ensure visual affordances remain intact during keyboard-based navigation.

## 2026-05-22 - Add Proper Form Associations
**Learning:** Complex dialogs with many input fields (like the Task Dialog) often miss explicit programmatic label associations (`htmlFor` and `id`). This makes it difficult for screen reader users to understand what input they are focusing on, and removes the ability for all users to click the label to focus the input.
**Action:** Always ensure that every `<Label>` component has an `htmlFor` attribute that strictly matches the `id` of its corresponding `<Input>`, `<Textarea>`, or `<SelectTrigger>`.
## 2026-05-25 - Add Label to Form Inputs
## 2025-05-25 - Add Label to Form Inputs
**Learning:** Form `<input>` fields that lack an explicitly associated `<label>` are flagged as accessibility violations and prevent screen readers from properly conveying the field's purpose.
**Action:** Always ensure that form inputs (like password fields in dialogs) are accompanied by a `<Label>` component from the design system, linked using matching `id` and `htmlFor` attributes.
## 2025-02-18 - Add Task Deletion Confirmation Dialog to Global Automations
**Learning:** Destructive actions like deleting global automations were previously executed immediately upon clicking the "Delete" button without confirmation. This lacked friction and was prone to accidental data loss. Using Radix UI's (or shadcn/ui's) `AlertDialog` is an effective, accessible, and standardized way to solve this in the app without custom modal implementations.
**Action:** When working on destructive actions in this repo, standard practice should be to wrap the trigger button with the existing `AlertDialog` components to ensure a safe, accessible, and user-friendly experience.

## 2026-05-25 - Add visual Tooltips to Icon-Only Buttons
**Learning:** While `aria-label`s on icon-only buttons like `<Trash2 />` ensure screen reader accessibility, sighted users might still struggle to understand the button's explicit action without a visual label. Wrapping icon-only buttons with `<Tooltip>` components ensures a better user experience for everyone, bridging the gap between semantic accessibility and visual clarity.
**Action:** Always wrap icon-only interactive elements with `Tooltip` components from `@/components/ui/tooltip` when they lack text labels, ensuring the `aria-label` context is also available visually on hover/focus.
