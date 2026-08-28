# Semantic motion

BeeUI ships a small, evidence-backed vocabulary of semantic motion intents for the
recurring spatial/state transitions that already exist (or are planned) in the component
set. Motion is authored once in the canonical token source and generated into typed
TypeScript, CSS custom properties, and a native-facing config through the same pipeline as
every other token.

**Tokens never make animation mandatory.** A motion intent describes *how* a transition
should feel *if a component chooses to animate*. It does not require any component to
animate, and adding an intent does not animate anything on its own.

## Where motion tokens come from

- Canonical source: `packages/tokens/tokens.json`, under
  `$extensions["com.beeui"].semanticMotion`. Like focus-ring/elevation policy, motion lives
  in BeeUI's extension namespace and references the shared `motionDuration` /
  `motionEasing` tokens by name.
- Generator: `scripts/generate-tokens.mjs`.
- Generated artifacts: `packages/tokens/src/index.ts` (`motion`, `motionIntents`,
  `resolveMotion`) and `packages/tokens/src/theme.css` (`--motion-<intent>-*` plus
  `prefers-reduced-motion` overrides).
- Native executable-plan adapter: `@beeui/tokens/motion-runtime`. It derives only from the
  generated canonical `motion` object; it is not a second metadata source or preference
  store.

The existing `motionDuration` (`fast` 120 ms, `normal` 200 ms, `slow` 320 ms) and
`motionEasing` (`standard`, `emphasized`) exports remain compatible.

## Approved intents

| Intent | Recurring use | Classification |
| --- | --- | --- |
| `overlay-enter` | Dialog, alert dialog, popover, dropdown, select, toast appearing | opacity + small spatial scale (spring) |
| `overlay-exit` | The same overlays dismissing | opacity + small spatial scale (fast timing) |
| `disclosure` | Accordion / collapsible expand and collapse | size reveal + opacity (timing) |

Candidates without repeated product evidence — moving tab indicators, list entry/removal,
emphasized attention motion and animated icons — were inventoried but deliberately not
added.

## Web representation

For each intent the generator emits variables such as:

```css
--motion-overlay-enter-duration: 200ms;
--motion-overlay-enter-easing: cubic-bezier(0.2, 0, 0, 1);
--motion-overlay-enter-spatial: 1;
```

`motion[intent].web` carries `{ durationMs, easing, properties }`. The spatial variable is
`1` when transform/size motion is allowed and `0` when it must be removed. Under
`prefers-reduced-motion: reduce`, the same canonical policy drives duration and spatial
overrides. A targeted Playwright acceptance test switches the browser media preference at
runtime and verifies these actual computed custom properties, including `overlay-enter`
retaining its fade duration while spatial motion is removed and the `immediate` intents
collapsing to `0.01ms`.

## Native representation

`motion[intent].native` is a discriminated union:

- `{ type: 'spring', stiffness, damping, mass }` for `overlay-enter`;
- `{ type: 'timing', durationMs, easing }` for `overlay-exit` / `disclosure`.

`stiffness`, `damping`, and `mass` map to React Native `Animated.spring` parameters and are
validated as positive finite values. Raw physics remains an implementation detail behind
the semantic intent.

### Native reduced-motion executable plan

For consumers that need an actual native animation configuration, use:

```ts
import { resolveNativeMotion } from '@beeui/tokens/motion-runtime';

const plan = resolveNativeMotion('overlay-enter', { reducedMotion });
```

The resolver is derived from generated canonical motion data:

- normal `overlay-enter` → the canonical spring;
- reduced `overlay-enter` (`opacity-or-state`) → a timing-only fade using the intent's
  canonical duration/easing, with the spatial spring removed;
- reduced `overlay-exit` / `disclosure` (`immediate`) → `{ type: 'immediate' }`;
- future `shorten` / `remove-spatial` policies are handled by the same public policy
  vocabulary.

This removes ambiguity for native consumers: they never have to guess whether a spring
should still execute after the spatial portion has been disabled.

**No parity promise.** Web and native representations intentionally differ. BeeUI shares
semantic intent and final state, not frame-identical or time-identical animation.

## Reduced-motion contract

Every intent declares exactly one policy:

- `immediate` — jump to final state;
- `opacity-or-state` — preserve opacity/state change and remove spatial motion;
- `shorten` — keep motion but clamp duration to `fast`;
- `remove-spatial` — keep non-spatial timing and remove spatial motion.

Current assignments:

| Intent | Policy | Result |
| --- | --- | --- |
| `overlay-enter` | `opacity-or-state` | opacity fade preserved, scale removed |
| `overlay-exit` | `immediate` | dismissal instant |
| `disclosure` | `immediate` | expand/collapse instant |

BeeUI adds **no** motion/preference store. The platform/app supplies the reduced-motion
signal (`prefers-reduced-motion` on web, `AccessibilityInfo.isReduceMotionEnabled()` on
native).

`resolveMotion(intent, { reducedMotion })` remains the platform-neutral policy result:
`{ animate, durationMs, spatial, reducedMotionApplied }`. `resolveNativeMotion` turns the
same policy into the native executable spring/timing/immediate plan.

## Behavioral acceptance

The Showcase contains one focused representative fixture rather than animating every
component. Rendering it does **not** start animation. Only an explicit user interaction
requests the semantic intent. Tests spy on React Native `Animated` behavior and prove:

- no spring/timing runs merely because tokens or the fixture render;
- normal `overlay-enter` executes the canonical spring only after interaction;
- reduced `overlay-enter` executes the timing-only fallback, never the spring;
- reduced `overlay-exit` invokes no animation runtime;
- all paths end at the same final content state.

This tests behavior/final state instead of brittle frame-by-frame timing.

## When not to animate

- Do not animate a component that has no product requirement just to exercise a token.
- Do not use a spring for dismissal or height reveal where overshoot is undesirable.
- Do not introduce motion where a state change communicates the same thing more clearly.

## Runtime / dependency assumptions

BeeUI adds no Reanimated dependency. The representative native acceptance uses React
Native's built-in `Animated`, which is already part of the runtime. A future animation
runtime may map the same canonical spring/timing data onto its own API.

## Deferred #72 integration point

`#72` remains the runtime **token-reader** path and is not implemented here. The generated
`motion` data is the canonical readable metadata it can expose. The `motion-runtime`
subpath added here is only a deterministic executable-plan adapter over that generated data;
it does not read overrides, create another token source, or create another theme/motion
store. #72 therefore still owns future runtime token reading rather than being bypassed.
