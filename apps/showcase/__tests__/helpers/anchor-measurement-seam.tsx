import { render as rtlRender } from '@testing-library/react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

/**
 * Deterministic anchor/host-measurement seam for RN overlay geometry tests.
 *
 * Under the current jest-expo/React 19 environment, RN components are class mocks
 * whose instance methods (including `measureInWindow`) are silent auto-mocks, and
 * RTL's `createNodeMock` option never reaches the actual ref a component receives
 * (see BeeUI issue #58). This seam works around that by patching the *prototypes*
 * RN's auto-mock layer hands out, so any instance resolves measurements from the
 * currently activated per-test configuration instead of relying on `createNodeMock`.
 *
 * The RN mock layer can expose distinct classes for `Pressable`/`View` reached
 * directly versus the same primitives reached through a product component (e.g. a
 * `PopoverTrigger` wrapping `Button` wrapping `Pressable`). `Pressable` and `View`
 * are always patched; callers that render a trigger through product code should
 * additionally register a `capture` for that component so its exact prototype gets
 * patched too (see `createAnchorSeam`'s `captures` option).
 */

export type AnchorRect = { x: number; y: number; width: number; height: number };

export type AnchorSeam = {
  focusMocks: Record<string, jest.Mock>;
};

/**
 * Renders a throwaway element, attaching `ref` to whatever node should have its
 * prototype patched (a trigger component, a wrapping provider's child, etc).
 * The element is unmounted immediately after the ref is captured.
 */
export type AnchorSeamCapture = (ref: React.Ref<unknown>) => React.ReactElement;

let activeConfig: {
  match: (testID: string) => boolean;
  rectFor: (testID: string) => AnchorRect | undefined;
  modalHostRect?: AnchorRect;
} | null = null;
let focusRegistry: Record<string, jest.Mock> = {};
let installed = false;

function resolveRectForInstance(instance: { props?: { testID?: unknown } }): AnchorRect | null {
  const config = activeConfig;
  if (!config) return null;
  const props = (instance as { props?: Record<string, unknown> }).props ?? {};
  if (typeof props.testID === 'string') {
    if (!config.match(props.testID)) return null;
    return config.rectFor(props.testID) ?? null;
  }
  // Modal-local hosts have no testID; identify them structurally.
  const host =
    props.collapsable === false &&
    props.accessible === false &&
    props.pointerEvents === 'box-none';
  return host ? config.modalHostRect ?? null : null;
}

const patchMeasurementPrototype = (prototype: Record<string, unknown>): void => {
  prototype.measureInWindow = function measureInWindow(
    this: { props?: Record<string, unknown> },
    callback: (x: number, y: number, width: number, height: number) => void,
  ) {
    const rect = resolveRectForInstance(this);
    if (!rect) return;
    callback(rect.x, rect.y, rect.width, rect.height);
  };
  prototype.focus = function focus(this: { props?: Record<string, unknown> }) {
    const testID = this.props?.testID;
    if (typeof testID !== 'string') return;
    // Lazily register, mirroring createNodeMock's per-testID mock registry.
    const mock = (focusRegistry[testID] ??= jest.fn());
    mock();
  };
};

function capturePrototype(element: React.ReactElement, ref: React.RefObject<unknown>): void {
  const screen = rtlRender(element);
  const instance = ref.current;
  screen.unmount();
  if (!instance || typeof instance !== 'object') {
    throw new Error('anchor-measurement-seam: could not capture an instance for prototype patching');
  }
  patchMeasurementPrototype(Object.getPrototypeOf(instance) as Record<string, unknown>);
}

const baseCaptures: AnchorSeamCapture[] = [
  (ref) => (
    <Pressable
      accessible={false}
      collapsable={false}
      pointerEvents="box-none"
      ref={ref as React.Ref<React.ComponentRef<typeof Pressable>>}
    />
  ),
  (ref) => (
    <View
      accessible={false}
      collapsable={false}
      pointerEvents="box-none"
      ref={ref as React.Ref<React.ComponentRef<typeof View>>}
    />
  ),
];

function ensureInstalled(captures: AnchorSeamCapture[]): void {
  if (installed) return;
  installed = true;
  for (const capture of [...baseCaptures, ...captures]) {
    const ref = React.createRef<unknown>();
    capturePrototype(capture(ref), ref);
  }
}

/**
 * Creates a seam and activates it globally until replaced or cleared. The latest
 * activation wins; suites create a fresh seam immediately before rendering.
 *
 * `captures` register additional component prototypes to patch (e.g. a suite's own
 * trigger component, rendered through the product code that wraps it in whatever
 * context provider it needs). Prototype installation happens once per test module
 * (first call wins) — pass the full capture list your file needs on every call, or
 * install it once up front, since later calls are no-ops if already installed.
 */
export function createAnchorSeam(options: {
  captures?: AnchorSeamCapture[];
  explicitFocus?: Record<string, jest.Mock>;
  match: (testID: string) => boolean;
  modalHostRect?: AnchorRect;
  rectFor: (testID: string) => AnchorRect | undefined;
}): AnchorSeam {
  ensureInstalled(options.captures ?? []);
  focusRegistry = {};
  for (const [testID, focus] of Object.entries(options.explicitFocus ?? {})) {
    focusRegistry[testID] = focus;
  }
  activeConfig = {
    match: options.match,
    rectFor: options.rectFor,
    modalHostRect: options.modalHostRect,
  };
  return { focusMocks: focusRegistry };
}

/** Deactivate after each test so stray late measurements stay inert. */
export function clearActiveAnchorSeam(): void {
  activeConfig = null;
}
