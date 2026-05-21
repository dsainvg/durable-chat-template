## 2024-05-20 - Ensure consistent focus styles on custom interactive elements
**Learning:** Found multiple instances where custom buttons or interactive non-form elements lacked consistent keyboard focus styles (like `focus-visible:ring-2`), leading to poor navigation experience for screen reader or keyboard-only users.
**Action:** Adding explicit `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` styling to interactive elements, particularly those built from raw `<button>` elements that don't inherit from the base `Button` component, to ensure a standard accessibility standard.

## 2024-05-20 - Added Focus Visible styles to Custom Interactive Elements
**Learning:** Found an instance in `LoginDialog.tsx` where custom buttons lacked keyboard focus styles (like `focus-visible:ring-2`), leading to a poor navigation experience for screen reader or keyboard-only users.
**Action:** Adding explicit `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` styling to interactive elements, particularly those built from raw `<button>` elements that don't inherit from the base `Button` component, to ensure accessibility standards are met.
