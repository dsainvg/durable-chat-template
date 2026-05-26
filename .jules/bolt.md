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
## 2024-05-19 - Unmemoized Hashmap Creation in Chat Views
**Learning:** Object.fromEntries mapping over arrays to create hashmaps (like `userMap`) within React render functions (e.g., in `ChannelPanel` and `chat.$userId`) forces O(N) recalculations on every single keystroke due to controlled text inputs.
**Action:** Always wrap state-derived object maps (like user lookup dictionaries) in `useMemo` hooks, ensuring they only recalculate when the source array (e.g. `state.users`) actually changes, decoupling them from frequent state updates like input typing.

## 2024-05-24 - Extracted Field Filtering from Task Iteration Loop
**Learning:** In the views architecture (KanbanView, ListView, TableView), custom field filtering and ordering was happening *inside* the task mapping loops. For large spaces with many tasks (T) and custom fields (F), this caused an O(T * F) complexity bottleneck on every render.
**Action:** Always precalculate layout arrays or visible fields outside the render loops using `useMemo` (e.g. `visibleCustomFields = useMemo(() => customFields.filter(f => !hiddenFields[f.id]), [...])`) before mapping over items, changing complexity to O(F) + O(T).
## 2024-05-24 - Extracted GanttView Layout Calculation
**Learning:** In `GanttView`, parsing dates (`new Date()`) and executing layout math (like computing `offset` and `width` by scaling milliseconds to days against `min`) inside the `.map` render loop caused significant O(N) performance overhead during rapid state updates, such as timeline resizing.
**Action:** Extract all layout math into an independent, pre-computed `layoutMap` dictionary inside the parent `useMemo` dependency array tracking `tasks`. Inside the `.map` render loop, look up the pre-computed bounds via `layoutMap[t.id]` instead of recalculating them dynamically.
