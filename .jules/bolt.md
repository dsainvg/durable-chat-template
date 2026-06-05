## 2024-05-23 - Dictionary Lookups for Inner Loops
**Learning:** Found a major performance bottleneck where `users.find()`, `hardcodedStatuses.find()`, and `customFields.find()` were nested inside inner `.map()` loops during Excel imports (`src/components/ExcelIntegration.tsx`). This O(N*M) iteration causes massive application slow-down for large CSV/Excel files. Replacing these inner `.find()` calls with O(1) dictionary maps reduces execution time linearly.
**Action:** Always pre-compute map lookups (e.g., `Object.fromEntries()` or `new Map()`) outside of tight loops (like `data.map` in imports or React `useMemo` renders) and use O(1) `.get()` lookups instead of `.find()` to maintain application responsiveness.

## 2024-05-24 - More Dictionary Lookups in React Loops
**Learning:** O(N) array search methods like `.find()` inside React rendering loops (e.g. `.map()`) can cause heavy layout thrashing and input lag when the arrays are large or change frequently.
**Action:** If `.find()` is used inside a `.map()` callback to look up a value from an array, immediately replace the array with an O(1) lookup map (e.g. `Object.fromEntries(arr.map(...))`) created *outside* the render loop, optimally wrapped in `useMemo`.
