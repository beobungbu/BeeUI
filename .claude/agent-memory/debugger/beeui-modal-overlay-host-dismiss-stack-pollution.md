---
name: beeui-modal-overlay-host-dismiss-stack-pollution
description: Any component mounted inside ModalOverlayHost that calls useOverlayDismissable joins the SAME modal-local dismiss stack Android hardware-back walks - registering a Dialog/Sheet's own escape-handler there pollutes child-first back counting
metadata:
  type: project
---

`packages/ui/src/components/overlay-runtime.tsx`: `ModalOverlayHost` creates one
`OverlayDismissStack` per modal instance and provides it via `OverlayScopeContext`
to everything rendered inside it. `useOverlayDismissable({ onDismiss, open,
overlayId })` (used by anchored overlays like Popover/DropdownMenu, AND by
`DialogEscapeBinding`/`SheetEscapeBinding`) calls `useNearestOverlayScope()` and
registers into whichever stack is nearest — so any component mounted as a
sibling/child of the modal content shares that ONE stack, indistinguishable from
a "real" nested anchored-overlay child.

Android hardware-back (`Modal.onRequestClose` → `dismissTopmostChild('back')` →
`dismissStack.dismissTop()`) dismisses whatever is topmost (last-registered) in
that stack. If a Dialog's own Escape-handling binding also registers there (to
get `isTopmost()` for nested-Popover precedence), it becomes a phantom "child":
back can dismiss the Dialog's own binding entry instead of falling through to
`dismissOnRequestClose`, or run BOTH the binding's `onDismiss` (which itself may
call `onRequestClose?.()`) and the outer `handleModalRequestClose`'s own
`onRequestClose?.()` call — double-firing callbacks and corrupting child-first
back counts (proven in PR #351: 3 `onRequestClose` calls over 2 backs instead of
2, plus AlertDialog's `dismissOnRequestClose` policy short-circuited once the
phantom entry "consumed" the back).

**Fix pattern**: gate any Web-only overlay-registering binding (e.g.
`DialogEscapeBinding`) behind `Platform.OS === 'web'` at the render call site —
not just inside its own effect — so `useOverlayDismissable` never runs, and
never registers, on native. `Platform.OS` is static per process so conditional
mounting is safe (no hooks-order violation across renders).

**How to verify**: `apps/showcase/__tests__/overlay-transport.test.tsx` describe
block "modal request-close is child-first for anchored overlays (Android
hardware back)" — asserts exact `onRequestClose` call counts across successive
`fireModalBack`. Any component that registers via `useOverlayDismissable` inside
a `ModalOverlayHost` should be suspected first when these counts drift.

Related: [[beeui-overlay-dismiss-layer-contract]] (a different overlay-stack
contract: outside-press dismissal + touch swallowing, not back-handling).
