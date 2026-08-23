# Toast / transient notifications

BeeUI Toast is a provider-scoped transient-notification system for short status messages and lightweight actions. It is intentionally separate from anchored overlays such as Popover and DropdownMenu.

## Public API

`BeeUIProvider` owns the runtime. Descendants use `useToast()`:

```tsx
const toast = useToast();

const id = toast.show({
  title: 'Saved',
  description: 'Your profile has been updated.',
  variant: 'success',
  duration: 5000,
  action: {
    label: 'Undo',
    onPress: undoSave,
  },
});

toast.dismiss(id);
toast.dismissAll();
```

The public surface is deliberately small:

- `useToast()` returns `{ show, dismiss, dismissAll }`.
- `show(descriptor)` returns a provider-local `ToastId`.
- `ToastVariant` is `neutral | success | warning | destructive | info`.
- `duration` is a positive finite millisecond value or the explicit string `persistent`.
- `TOAST_DEFAULT_DURATION` is `5000`.
- `TOAST_MAX_VISIBLE` is `3`.

## Data-driven content contract

Toast v1 accepts descriptors rather than arbitrary `ReactNode` payloads. `title`, `description`, and action `label` are strings. An action may provide a callback and `dismissOnPress?: boolean`.

This constraint is intentional. Moving an arbitrary consumer React tree into root-owned runtime state and rendering it elsewhere would create React-ancestry and context-preservation questions that a transient-notification API does not need to own. Toast therefore does not use `OverlayPortal`, does not depend on the anchored-overlay context work tracked separately, and does not transport arbitrary application React nodes through root state.

A future custom-content Toast API requires an explicit context-preservation design before it can be added.

## Queue and stacking

Each `BeeUIProvider` owns an isolated queue and id sequence.

- At most three notifications are visible.
- Additional notifications wait in FIFO order.
- Dismissing a visible toast promotes the oldest queued toast.
- Unknown ids are safe no-ops.
- Generated ids are provider-local and never intentionally reused during that provider lifetime.
- Newest visible notifications render at the top of the stack. The ordering is platform-independent.

Queued notifications are not mounted and do not start their timeout until promoted into the visible set.

## Timing and persistence

A toast defaults to 5000 ms. Any invalid numeric duration (zero, negative, `NaN`, or infinity) normalizes back to the default. Use `duration: 'persistent'` for a notification that must remain until explicit dismissal or `dismissAll()`.

Visible-toast timers are tied to the toast id and component lifetime. They are cleared when the toast is dismissed or the provider unmounts. A late callback for an already-dismissed id is harmless because unknown dismissal ids are no-ops and ids are not reused within the runtime.

## Action semantics

Action callbacks run first. The toast then dismisses by default. Set `dismissOnPress: false` when an action must deliberately keep the toast visible.

This is an explicit option rather than prevent-default event magic, so callback and dismissal ordering is deterministic across native and web runtimes.

## Accessibility

Toast content exposes polite live-region semantics for platforms that consume React Native live-region metadata. iOS additionally uses `AccessibilityInfo` announcement support so a newly mounted notification is announced without requiring focus movement.

The iOS announcement is keyed to the toast id, so ordinary rerenders do not repeatedly announce the same notification. Action controls remain independently accessible buttons, and the visible close control has an explicit `Dismiss <title>` accessible label.

Automated tests verify semantic intent and announcement behavior. They do not claim VoiceOver or TalkBack device verification; device-level assistive-technology validation remains a release/manual verification concern.

## Safe area and interaction

The Toast viewport is rendered by the provider as a separate absolute notification layer above normal application content. It reads the provider's top safe-area inset and adds a small visual offset.

The viewport uses `pointerEvents="box-none"`, so the full screen does not become an interaction blocker. Only the rendered toast surfaces and their controls intercept touches. Toast does not own keyboard avoidance in v1.

## Non-goals for v1

Toast v1 does not provide:

- anchored geometry or trigger measurement;
- React Native core `Modal` presentation;
- `OverlayPortal` reuse;
- arbitrary rich `ReactNode` payloads;
- swipe-to-dismiss gestures;
- a new animation or gesture dependency;
- router integration;
- push/remote-notification delivery;
- module-global singleton state.

Static presentation is intentional for the first production contract. Dependency-free transitions, swipe gestures, richer custom content, and alternate viewport positions can be considered later only if their behavior remains deterministic and their accessibility/context contracts are explicit.
