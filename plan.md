1. **Understand the Goal**: The memory `.Jules/palette.md` has an entry from `2026-05-27` instructing to "Add tooltips to icon-only buttons... Always pair icon-only buttons with tooltips using the existing UI components (like `Tooltip` from Radix UI) so that visual context is provided alongside screen reader context."

2. **Identify Target Files**:
   - `src/components/SpaceSettingsDialog.tsx`
     - View Delete Button (`aria-label="Delete view"`)
     - Move Field Up Button (`aria-label="Move field up"`)
     - Move Field Down Button (`aria-label="Move field down"`)
     - Delete Custom Field Button (`aria-label="Delete field"`)
   - `src/components/GlobalAutomationsDialog.tsx`
     - Delete Automation Button (`aria-label="Delete automation"`)
     - Remove Condition Button (`aria-label="Remove condition"`)
   - `src/components/ExcelIntegration.tsx`
     - Remove Constant Mapping Button (`aria-label="Remove constant mapping"`)
   *(Note: AppSidebar and ApiKeysDialog already use Tooltips, I'll double check just to be sure).*

3. **Implement Changes**:
   - Import `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger` from `@/components/ui/tooltip` into the target files.
   - Wrap the `DialogContent` or `div` containing these buttons with `<TooltipProvider>` if not already present. Actually, it's often better to just wrap the individual button with `<TooltipProvider><Tooltip><TooltipTrigger asChild>...</TooltipTrigger><TooltipContent><p>Label</p></TooltipContent></Tooltip></TooltipProvider>` or wrap the whole dialog in `TooltipProvider` at the top level. Given `SpaceSettingsDialog` doesn't have it, I'll add `TooltipProvider` around the content.
   - Ensure the inner `<Button>` has `type="button"` if it's in a form, and `aria-label` is set.
   - Per memory: "do not wrap the inner component in intermediate HTML elements like `<div>`. Doing so breaks the React `cloneElement` chain".

4. **Run Verification Commands**:
   - `pnpm test`
   - `pnpm run check`
   - `pnpm format` / `pnpm lint` are explicitly mentioned to not work, except the prompt says "run commands like `pnpm lint` ... based on this repo before creating PR". The memory states "The project's `package.json` does not currently define `lint` or `format` scripts; therefore, running commands like `pnpm lint`, `pnpm run lint`, or `pnpm format` will intentionally fail." So I will only run `pnpm test` and `pnpm run check`.
   - `pnpm build`

5. **Write PR / Journal**:
   - I am allowed <50 lines changes ideally. Adding tooltips to 7 places across 3 files might be a bit many lines depending on how I format it.
   - Wait, "Your mission is to find and implement ONE micro-UX improvement". Maybe I just do this for `SpaceSettingsDialog`? No, let's do it for all places since it's the same pattern, or maybe just `SpaceSettingsDialog` to keep it under 50 lines. Let's look at `SpaceSettingsDialog.tsx` size of changes.
   - 4 buttons in `SpaceSettingsDialog.tsx`:
     - Delete View
     - Move up
     - Move down
     - Delete custom field
   - Wrapping these in tooltips will add around 6 lines each * 4 = 24 lines. This is well under 50. Let's do `SpaceSettingsDialog.tsx`.
   - Let's check `SpaceSettingsDialog` first.
