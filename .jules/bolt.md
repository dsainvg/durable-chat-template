## 2024-10-24 - SyncDuo Real-time Re-renders
**Learning:** The application's core data model relies on a real-time `useStore` pattern that broadcasts updates globally to trigger React re-renders. As a result, views mapped directly to these state changes execute render functions frequently. Any O(N) operations inside these renders (like parsing dates, creating hashmaps for `users`, or iterating through tasks to compute timeline bounds) cause noticeable performance penalties.
**Action:** Always wrap derived state calculations—especially those involving date parsing, array mapping, or hashmap generation—inside `useMemo` hooks with strict dependency arrays to ensure they are only recalculated when the specific underlying data (`tasks` or `users`) actually changes.
## 2024-05-14 - React Re-renders and Expensive Operations
**Learning:** The combination of global state management (e.g. `useStore` triggering re-renders on any state change) and unmemoized array filtering inside loops (O(N*C)) or re-initializing date formatters causes performance degradation, especially in listing views like Kanban and ListView where many tasks are rendered.
**Action:** Always memoize derived grouping logic (e.g., grouping tasks by column) and extract stable formatters (like `Intl.DateTimeFormat`) outside the component to avoid costly operations on every render.
## 2024-05-20 - Native Date Formatting Performance
**Learning:** Native `Date.toLocaleDateString` calls inside React render loops (e.g., TableView and GanttView iterating over tasks or days) are remarkably slow because they re-initialize formatters on every render iteration.
**Action:** Extract stable `Intl.DateTimeFormat` instances outside the component scope to avoid this overhead in list views.
## 2024-11-20 - Chat Message Render Performance
**Learning:** Similar to list views, native `Date.toLocaleTimeString` calls inside `.map()` loops for rendering chat messages (e.g., in `ChannelPanel` and `chat.$userId`) cause noticeable performance degradation as they instantiate formatters for every message on each re-render.
**Action:** Define static `Intl.DateTimeFormat` instances outside the component scope and use `.format(timestamp)` to avoid costly instantiations inside chat loops.
## 2025-05-18 - Cloudflare Workers and Node APIs
**Learning:** The `nodemailer` package uses Node APIs that are not compatible with standard Cloudflare Workers unless specific socket shims/nodejs_compat flags are set, and it must be explicitly imported or its usage causes a `ReferenceError`.
**Action:** Ensure proper mock/shim or environment-specific imports are used when calling Node libraries in Worker endpoints.
