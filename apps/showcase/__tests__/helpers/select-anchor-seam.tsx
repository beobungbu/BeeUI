import { render as rtlRender } from '@testing-library/react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../../packages/ui/src/components/overlay-runtime';
import { Select, SelectTrigger } from '@beemvp/beeui-ui';

/**
 * Deterministic anchor/host-measurement seam for Wave-2A Select contract tests.
 *
 * Under the current jest-expo/React 19 environment, RN components are class mocks
 * whose instance methods (including `measureInWindow`) are silent auto-mocks, and
 * `createNodeMock` results never reach component refs. The RN mock layer can also
 * expose distinct classes for top-level exports versus internal requires, so this
 * seam patches every reachable prototype variant — including the exact prototype
 * of the inner View behind a real `SelectTrigger` instance — so any instance
 * resolves measurements from the currently activated configuration.
 */

export type AnchorRect = { x: number; y: number; width: number; height: number };

export type AnchorSeam = {
  focusMocks: Record<string, jest.Mock>;
};

type ActiveSeamConfig = {
  match: (testID: string) => boolean;
  rectFor: (testID: string) => AnchorRect | undefined;
  modalHostRect?: AnchorRect;
};

let activeConfig: ActiveSeamConfig | null = null;
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

function ensureInstalled(): void {
  if (installed) return;
  installed = true;

  const capturePrototype = (Component: React.ComponentType<unknown>): Record<string, unknown> => {
    const ref = React.createRef<unknown>();
    const screen = rtlRender(
      React.createElement(
        Component,
        { ref, collapsable: false, accessible: false, pointerEvents: 'box-none' },
        null,
      ),
    );
    const instance = ref.current as unknown as object | null;
    screen.unmount();
    if (!instance || typeof instance !== 'object') {
      throw new Error('anchor-seam: could not capture an instance for prototype patching');
    }
    return Object.getPrototypeOf(instance) as Record<string, unknown>;
  };

  for (const Component of [Pressable, View]) {
    patchMeasurementPrototype(capturePrototype(Component));
  }

  // Patch the exact prototype used by production components: the inner View
  // behind a real SelectTrigger instance rendered through @beemvp/beeui-ui itself.
  const uiRef = React.createRef<unknown>();
  const uiScreen = rtlRender(
    <OverlayRuntimeProvider hostRectOverride={{ x: 0, y: 0, width: 390, height: 844 }}>
      <Select>
        <SelectTrigger ref={uiRef as never} />
      </Select>
    </OverlayRuntimeProvider>,
  );
  uiScreen.unmount();
  const uiInstance = uiRef.current as unknown as object | null;
  if (uiInstance && typeof uiInstance === 'object') {
    const uiProto = Object.getPrototypeOf(uiInstance) as Record<string, unknown>;
    patchMeasurementPrototype(uiProto);
  }
}

/**
 * Creates a seam and activates it globally until replaced or cleared. The latest
 * activation wins; suites create a fresh seam immediately before rendering.
 */
export function createAnchorSeam(options: {
  match: (testID: string) => boolean;
  rectFor: (testID: string) => AnchorRect | undefined;
  explicitFocus?: Record<string, jest.Mock>;
  modalHostRect?: AnchorRect;
}): AnchorSeam {
  ensureInstalled();
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
