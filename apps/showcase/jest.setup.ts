import type * as React from 'react';

/**
 * Deterministic bounded-measurement test environment (BeeUI issue #121, ADR-003
 * `docs/decisions/003-native-measurement-timeout.md`).
 *
 * The overlay measurement watchdog's production timing primitive is the
 * `requestAnimationFrame` frame clock. In the JS-only Jest environment, native
 * `measureInWindow` mocks never invoke their callback, so if the ambient frame
 * clock were allowed to drive the watchdog it would spontaneously time out
 * measurements at wall-clock-dependent moments — precisely the "arbitrary flaky
 * wall-clock behavior" the ADR forbids, and a source of cross-suite flakiness.
 *
 * We therefore neutralize the ambient `requestAnimationFrame`/`cancelAnimationFrame`
 * so no test accidentally depends on the frame loop to complete a measurement.
 * Tests that specifically exercise the bounded-completion watchdog inject the
 * internal `measurementScheduler` seam and advance it explicitly (see
 * `overlay-measurement-completion-budget.test.tsx`). Suites that mock rAF for their
 * own purposes (e.g. `keyboard-aware-screen.test.tsx`) still override this locally.
 */
const globalWithFrameClock = globalThis as typeof globalThis & {
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
};

globalWithFrameClock.requestAnimationFrame = () => 0;
globalWithFrameClock.cancelAnimationFrame = () => undefined;

/**
 * Global `react-native-reanimated` + `@gorhom/bottom-sheet` mocks (BeeUI
 * issue #158, ADR-006 `docs/decisions/006-sheet-gesture-engine.md`).
 *
 * `packages/ui/src/index.ts`'s single barrel eagerly requires every component
 * module, including `./components/sheet` — which Jest's platform-extension
 * resolution now resolves to `sheet.native.tsx` (the #158 `@gorhom/bottom-sheet`
 * adapter) for every suite that imports from `@beemvp/beeui-ui`, not just Sheet's own
 * tests. `sheet.native.tsx` requires `@gorhom/bottom-sheet`, which requires the
 * real `react-native-reanimated`, which requires the real
 * `react-native-worklets` native module — none of which exist in this
 * JS-only Jest environment, so *every* suite that transitively imports
 * `@beemvp/beeui-ui` would otherwise fail to load at all.
 *
 * `react-native-reanimated`'s own official `react-native-reanimated/mock`
 * still requires its real `./initializers`, which requires the real
 * `react-native-worklets` native module and throws the same way — it is not
 * a usable escape hatch here. This hand-rolled mock covers exactly the seam
 * `sheet.native.tsx` uses (a stable `createAnimatedComponent`, a
 * pass-through `useAnimatedStyle`, and the `ReduceMotion`/`Extrapolation`/
 * `Easing` surface plus `interpolate`) without touching the native worklets
 * runtime. `react-native-worklets` itself is never required once
 * `react-native-reanimated` is mocked (verified: neither
 * `@gorhom/bottom-sheet` nor `react-native-gesture-handler` import it
 * directly), so it needs no mock of its own.
 *
 * `@gorhom/bottom-sheet` is *also* mocked globally, not just
 * `react-native-reanimated`: its own real `BottomSheet.tsx` calls further
 * Reanimated UI-thread registration APIs (e.g. `addWhitelistedUIProps`) at
 * **module scope** — chasing every such call with an ever-larger hand-rolled
 * Reanimated mock is an unbounded surface, whereas mocking gorhom's own
 * (small, BeeUI-controlled) import surface directly is a fixed, known one.
 * This lightweight mock only needs to not crash and to invoke the
 * `backdropComponent`/`handleComponent` render props for structural
 * completeness; `issue-158-sheet-native.test.tsx` overrides both mocks
 * locally with `jest.fn()`-tracked versions to assert BeeUI's own wiring
 * around the seam in detail — a local `jest.mock()` call takes precedence
 * over this global one for that file's own module registry.
 */
jest.mock('react-native-reanimated', () => {
  const ReactActual = require('react');

  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (Component: unknown) =>
        ReactActual.forwardRef((props: object, ref: unknown) =>
          ReactActual.createElement(Component as never, { ...props, ref }),
        ),
    },
    Easing: {
      ease: (t: number) => t,
      exp: (t: number) => t,
      in: (easing: (t: number) => number) => easing,
      inOut: (easing: (t: number) => number) => easing,
      linear: (t: number) => t,
      out: (easing: (t: number) => number) => easing,
    },
    Extrapolation: { CLAMP: 'clamp' },
    ReduceMotion: { Always: 'always', Never: 'never', System: 'system' },
    interpolate: (value: number, input: number[], output: number[]) => {
      if (value <= input[0]) return output[0];
      if (value >= input[input.length - 1]) return output[output.length - 1];
      return output[0];
    },
    useAnimatedStyle: (factory: () => object) => factory(),
  };
});

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');

  const BottomSheetModal = ReactActual.forwardRef(
    (
      props: {
        backdropComponent?: (p: { animatedIndex: { value: number } }) => React.ReactNode;
        children?: React.ReactNode;
        handleComponent?: ((p: Record<string, never>) => React.ReactNode) | null;
      },
      ref: unknown,
    ) => {
      ReactActual.useImperativeHandle(ref, () => ({ present: () => undefined, dismiss: () => undefined }));
      return ReactActual.createElement(
        View,
        null,
        props.backdropComponent ? props.backdropComponent({ animatedIndex: { value: 0 } }) : null,
        props.handleComponent ? props.handleComponent({}) : null,
        props.children,
      );
    },
  );

  const BottomSheetView = ({ children }: { children?: React.ReactNode }) =>
    ReactActual.createElement(View, null, children);

  return {
    __esModule: true,
    BottomSheetModal,
    BottomSheetView,
  };
});
