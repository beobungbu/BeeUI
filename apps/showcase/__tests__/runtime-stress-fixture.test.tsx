import { fireEvent, render } from '@testing-library/react-native';
import { BeeUIProvider } from '@beeui/ui';
import * as React from 'react';
import type * as ReactTypes from 'react';
import { View } from 'react-native';
import { ShowcaseRoot } from '../showcase-root';
import { RuntimeAcceptance, RuntimeStressAcceptance } from '../runtime-smoke';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: ReactTypes.ReactNode }) => children,
    SafeAreaListener: ({ children, onChange }: { children?: ReactTypes.ReactNode; onChange: (metrics: { frame: typeof frame; insets: typeof insets }) => void }) => {
      React.useEffect(() => onChange({ frame, insets }), [onChange]);
      return children;
    },
    SafeAreaView: React.forwardRef(
      ({ children, ...props }: { children?: ReactTypes.ReactNode }, ref: ReactTypes.ForwardedRef<ReactTypes.ComponentRef<typeof View>>) => <View ref={ref} {...props}>{children}</View>,
    ),
    useSafeAreaInsets: () => insets,
  };
});

const ROOT_SELECT_TEST_IDS = [
  'runtime-stress-select-trigger',
  'runtime-stress-select-value',
  'runtime-stress-select-selection',
] as const;

const MOVEMENT_TEST_IDS = [
  'runtime-stress-popover-trigger',
  'runtime-stress-scroll-sentinel-1',
  'runtime-stress-scroll-sentinel-2',
  'runtime-stress-scroll-sentinel-3',
  'runtime-stress-scroll-target',
] as const;

const DIALOG_CHILD_TEST_IDS = [
  'runtime-stress-dialog-select-trigger',
  'runtime-stress-dialog-select-value',
  'runtime-stress-dialog-select-selection',
  'runtime-stress-dialog-popover-trigger',
  'runtime-stress-dialog-input',
] as const;

describe('Runtime overlay-stress fixture (#126)', () => {
  it('is reachable one tap from Showcase home and returns home', () => {
    const view = render(<BeeUIProvider><ShowcaseRoot /></BeeUIProvider>);
    fireEvent.press(view.getByTestId('showcase-open-runtime-stress'));
    expect(view.getByTestId('runtime-stress-smoke')).toBeTruthy();
    expect(view.getByTestId('runtime-stress-ready')).toBeTruthy();
    expect(view.queryByTestId('showcase-home')).toBeNull();
    fireEvent.press(view.getByTestId('runtime-stress-back'));
    expect(view.getByTestId('showcase-home')).toBeTruthy();
    expect(view.queryByTestId('runtime-stress-smoke')).toBeNull();
  });

  it('renders root Select evidence testIDs', () => {
    const view = render(<BeeUIProvider><RuntimeStressAcceptance onBack={() => undefined} /></BeeUIProvider>);
    for (const testID of ROOT_SELECT_TEST_IDS) expect(view.getByTestId(testID)).toBeTruthy();
    expect(view.getByText('select: none')).toBeTruthy();
  });

  it('renders visible movement sentinels across the real scroll corridor', () => {
    const view = render(<BeeUIProvider><RuntimeStressAcceptance onBack={() => undefined} /></BeeUIProvider>);
    for (const testID of MOVEMENT_TEST_IDS) expect(view.getByTestId(testID)).toBeTruthy();
    expect(view.getByText('Scroll corridor 1')).toBeTruthy();
    expect(view.getByText('Scroll corridor 2')).toBeTruthy();
    expect(view.getByText('Scroll corridor 3')).toBeTruthy();
  });

  it('renders modal-local child evidence once the stress Dialog opens', () => {
    const view = render(<BeeUIProvider><RuntimeStressAcceptance onBack={() => undefined} /></BeeUIProvider>);
    fireEvent.press(view.getByTestId('runtime-stress-dialog-trigger'));
    for (const testID of DIALOG_CHILD_TEST_IDS) expect(view.getByTestId(testID)).toBeTruthy();
    expect(view.getByText('select selection: none')).toBeTruthy();
  });

  it('renders the in-Popover keyboard evidence surface', () => {
    const view = render(<BeeUIProvider><RuntimeStressAcceptance onBack={() => undefined} /></BeeUIProvider>);
    fireEvent.press(view.getByTestId('runtime-stress-dialog-trigger'));
    fireEvent.press(view.getByTestId('runtime-stress-dialog-popover-trigger'));
    const hidden = { includeHiddenElements: true } as const;
    expect(view.getByTestId('runtime-stress-dialog-popover-content', hidden)).toBeTruthy();
    expect(view.getByTestId('runtime-stress-dialog-popover-keyboard-toggle', hidden)).toBeTruthy();
    expect(view.getByTestId('runtime-stress-dialog-popover-close', hidden)).toBeTruthy();
    expect(view.getByTestId('runtime-stress-keyboard-state', hidden)).toBeTruthy();
    expect(view.getByText('keyboard: hidden', hidden)).toBeTruthy();
  });

  it('keeps shared RuntimeAcceptance free of #126 stress content', () => {
    const view = render(<BeeUIProvider><RuntimeAcceptance onBack={() => undefined} /></BeeUIProvider>);
    expect(view.queryByTestId('runtime-select-trigger')).toBeNull();
    expect(view.queryByTestId('runtime-stress-select-trigger')).toBeNull();
    expect(view.queryByTestId('runtime-stress-dialog-trigger')).toBeNull();
  });
});
