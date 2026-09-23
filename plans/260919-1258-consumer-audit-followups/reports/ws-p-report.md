# WS-P report — regressions introduced by #617, fixed on fix/consumer-audit-batch

Branch: `ws/p-batch-regressions` (based on `origin/fix/consumer-audit-batch` @ `d28d8b9`).

## Summary

Fixed the three MAJOR regressions Astra's review #2 found in items 1, 2, 5:

1. `input.tsx`/`password-input.tsx` — masked password value leak via `accessibilityValue.text`.
2. `safe-area.tsx` — a caller's `className` padding silently dropped the matching safe-area inset edge.
3. `icon-button.tsx` — every `IconButton` gained an extra layout-root wrapper `View`, `size="sm"` only guarded height (not width), and a custom `count` node was unconditionally `aria-hidden`.

## 1. Input / PasswordInput accessibility value

`packages/ui/src/components/input.tsx`: `resolvedAccessibilityValue` now only auto-fills `text` when `secureTextEntry` is not set. A caller-supplied `accessibilityValue.text` still wins in every case (masked or not) — matched by checking `accessibilityValue?.text !== undefined` first. `PasswordInput` needed no change: it already forwards `secureTextEntry={!resolvedVisible}` straight into `Input`.

Tests (`apps/showcase/__tests__/input-masked-accessibility-value.test.tsx`, new file):
- masked `PasswordInput` inside `Field` → no `accessibilityValue.text`.
- after the show/hide toggle reveals it → value exposed.
- caller-supplied `accessibilityValue={{ text: 'PIN entered' }}` wins while masked.
- plain unmasked labelled `Input` still publishes its value (no regression).
- a directly `secureTextEntry` `Input` (outside `PasswordInput`) also omits the value.

## 2. SafeArea

`packages/ui/src/components/safe-area.tsx`: removed the per-edge `classNameSetsPadding`/`PADDING_TOKEN_PATTERN` edge-stripping logic entirely. `edges` (and therefore the resulting inset) is now always forwarded to `react-native-safe-area-context` unchanged — BeeUI never touches it. When the caller's own `className`/`style` carries a padding utility/property (checked structurally, not per-edge), `SafeArea` renders an inner wrapper `View` (`className={cn('flex-1', className)}`, forwarding `style`) that holds that padding, while the outer `SafeAreaView` keeps only the safe-area inset. When the caller supplies no padding, rendering stays exactly as before — a single node, no wrapper.

This means a caller's `pt-6` now composes *inside* the device's own top inset instead of replacing or stripping it, for both literal (`pt-6`) and variant-prefixed (`md:pt-6`) utilities alike — the fix no longer special-cases either.

Tests (`apps/showcase/__tests__/safe-area.test.tsx`, rewritten):
- Removed the entire `describe('className padding wins over the edge inset it conflicts with (#598)')` block — those 6 tests asserted the exact wrong behavior (edges being silently dropped) and are no longer true.
- Extended the mock `SafeAreaView` to compute a real inset style from `edges`/`mode` against mocked insets (`top: 47, right: 0, bottom: 34, left: 0`), mirroring the real library's own `[style, insetStyle]` merge order, so tests can assert actual final geometry instead of just prop pass-through.
- New: composes a caller `style={{ paddingTop: 24 }}` padding inside the `top: 47` inset — outer node's flattened style is `{ paddingTop: 47 }`, inner wrapper's is `{ paddingTop: 24 }` (both present in the final tree at once).
- New: `className="md:pt-6"` keeps the inset fully intact (`{ paddingTop: 47 }` unchanged) while the class still reaches the inner wrapper.
- New: no-padding case (`style={{ backgroundColor: 'red' }}`) renders the child directly with no wrapper `View`, vs. the padded case which does insert one.
- Kept the pre-existing non-padding-related tests (`edges`/`mode` forwarding, `undefined` className never reaching the host, defined className unchanged, Uniwind inset sync via `BeeUIProvider`) — all still valid under the new design and pass unchanged in spirit (the last one now also asserts single-node structure via `toJSON()`).

Docs text (page itself is owned elsewhere, not edited here): the `SafeArea` JSDoc above the component now describes the two failure modes (naive-merge losing padding, then edge-stripping losing the inset) and the additive composition fix — worth folding into the hand-authored `safe-area` docs page: caller padding renders on an inner wrapper `View`, not on the same node as the inset, only when actual padding is present.

## 3. IconButton

`packages/ui/src/components/icon-button.tsx`:
- When `count` is `undefined`, `Button` renders directly as the sole outermost node (the exact pre-#617 layout root) — a caller's `className`/`style` (e.g. `flex-1`, `self-center`) lands on it directly again.
- When `count` is present, the wrapper `View` needed for the badge overlay now also receives the caller's `className`/`style` (`cn('relative', className)`), so a layout prop still reaches the outermost node exactly as it would with no badge; the inner `Button` keeps the same classes/style for its own visual sizing. (`style` can be a `Pressable` state-callback function; the wrapper is a plain `View`, so only a static style object forwards to it — a function-form `style` is dropped there, same as it always was for a non-Pressable node.)
- `size="sm"`: added `ios:min-w-touch-target android:min-w-touch-target` alongside the existing `min-h-*` guards, so the 44dp tappable region is guaranteed in both dimensions, not just height.
- Custom-node `count`: the badge container is `aria-hidden` only when the count is the numeric/string case (already folded into `accessibilityLabel`); a custom node keeps the container out of the aria-hidden subtree so its own accessible text (per the existing JSDoc's documented contract) actually reaches assistive tech. No JSDoc text needed to change — the doc already promised this; the implementation just violated it.

Tests (`apps/showcase/__tests__/icon-button-size-and-count.test.tsx`, extended):
- `size="sm"` test now also asserts `ios:min-w-touch-target`/`android:min-w-touch-target`.
- Custom-node count test renamed and updated to assert `getByLabelText('online')` (no `includeHiddenElements` escape hatch needed anymore) instead of requiring the flag to reach a hidden node.
- New `describe('IconButton layout root')`: asserts via `screen.toJSON()` that the rendered tree's own root is the `Button` itself (not a wrapper) when `count` is omitted, carrying the caller's `className`/`style`; and that the wrapper *is* the root (carrying the same `className`/`style`) when `count` is present, with the inner `Button` still keeping its own size class.

## Gates

- `pnpm lint` — pass.
- `pnpm --filter @beemvp/beeui-ui typecheck` — pass.
- `pnpm --filter @beemvp/beeui-showcase typecheck` — pass.
- `pnpm --filter @beemvp/beeui-showcase test` (full suite) — 124 suites / 1114 tests, all pass.
- `pnpm ui-exports:check` — pass (63 public component subpaths, unchanged).
- `pnpm docs:contract:check` — pass, no drift (no per-prop JSDoc was changed on any owned component).
- `pnpm docs:portal-pages:check` — investigated but **not required and not run to completion as a commit gate**: it flags `password-input.md` as stale solely because the new `input-masked-accessibility-value.test.tsx` test file references `PasswordInput` and the generator auto-cites every fixture that touches a component. No JSDoc/props comment changed on any WS-P-owned component, so per the phase spec's conditional ("if a JSDoc/props comment changed, regenerate"), this doesn't apply. I generated it once to confirm the exact diff, then reverted `apps/docs/` (out of file ownership) rather than commit it. Flagging here so whichever workstream next touches docs pages knows to run `pnpm docs:portal-pages:generate` and pick up that one citation addition/reordering in `password-input.md`.

## Commits (conventional, no attribution trailers)

- `9ad88b5 fix(input): never auto-publish a masked value through accessibilityValue`
- `bbe6484 fix(safe-area): compose caller padding with the inset instead of stripping edges`
- `b0ac151 fix(icon-button): restore the pre-badge layout root and touch-target width`

## Files touched

- `packages/ui/src/components/input.tsx`
- `packages/ui/src/components/safe-area.tsx`
- `packages/ui/src/components/icon-button.tsx`
- `apps/showcase/__tests__/input-masked-accessibility-value.test.tsx` (new)
- `apps/showcase/__tests__/safe-area.test.tsx` (rewritten)
- `apps/showcase/__tests__/icon-button-size-and-count.test.tsx` (extended)

`password-input.tsx` needed no code change (item 1 was fully in `input.tsx`).

## Unresolved / worth a follow-up

- The `password-input.md` docs-portal staleness noted above needs a regeneration pass by whoever owns docs in a later workstream.
