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
