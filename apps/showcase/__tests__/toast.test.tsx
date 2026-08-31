import { act, fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import {
  BeeUIProvider,
  TOAST_DEFAULT_DURATION,
  TOAST_MAX_VISIBLE,
  useToast,
  type ToastApi,
} from '@beemvp/beeui-ui';

const TEST_INSETS = { top: 47, right: 0, bottom: 34, left: 0 };

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: React.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) => (
        <View ref={ref} {...props}>
          {children}
        </View>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

function CaptureToast({ capture }: { capture: (api: ToastApi) => void }) {
  capture(useToast());
  return null;
}

function setup() {
  let api: ToastApi | null = null;
  const screen = render(
    <BeeUIProvider syncUniwindInsets={false}>
      <CaptureToast capture={(value) => { api = value; }} />
    </BeeUIProvider>,
  );
  if (!api) throw new Error('Toast API was not captured');
  return { screen, api };
}

function show(api: ToastApi, title: string, options: Parameters<ToastApi['show']>[0] = { title }) {
  let id = '';
  act(() => {
    id = api.show({ ...options, title });
  });
  return id;
}

describe('Toast transient notification runtime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows a descriptor-driven toast and returns an id', () => {
    const { screen, api } = setup();
    const id = show(api, 'Saved', { title: 'Saved', description: 'Profile updated', duration: 'persistent' });

    expect(id).toMatch(/^beeui-toast-/);
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('Profile updated')).toBeTruthy();
  });

  it('uses the documented default duration', () => {
    const { screen, api } = setup();
    show(api, 'Default duration');

    act(() => { jest.advanceTimersByTime(TOAST_DEFAULT_DURATION - 1); });
    expect(screen.getByText('Default duration')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(1); });
    expect(screen.queryByText('Default duration')).toBeNull();
  });

  it('dismisses an individual toast explicitly', () => {
    const { screen, api } = setup();
    const id = show(api, 'Dismiss me', { title: 'Dismiss me', duration: 'persistent' });

    act(() => api.dismiss(id));
    expect(screen.queryByText('Dismiss me')).toBeNull();
  });

  it('dismissAll clears visible and queued notifications', () => {
    const { screen, api } = setup();
    for (let index = 1; index <= 5; index += 1) show(api, `Toast ${index}`, { title: `Toast ${index}`, duration: 'persistent' });

    act(() => api.dismissAll());
    for (let index = 1; index <= 5; index += 1) expect(screen.queryByText(`Toast ${index}`)).toBeNull();
  });

  it('queues overflow notifications FIFO', () => {
    const { screen, api } = setup();
    const ids = [1, 2, 3, 4, 5].map((index) => show(api, `FIFO ${index}`, { title: `FIFO ${index}`, duration: 'persistent' }));

    expect(screen.queryByText('FIFO 4')).toBeNull();
    expect(screen.queryByText('FIFO 5')).toBeNull();
    act(() => api.dismiss(ids[0]!));
    expect(screen.getByText('FIFO 4')).toBeTruthy();
    expect(screen.queryByText('FIFO 5')).toBeNull();
    act(() => api.dismiss(ids[1]!));
    expect(screen.getByText('FIFO 5')).toBeTruthy();
  });

  it('enforces max-visible at three notifications', () => {
    const { screen, api } = setup();
    for (let index = 1; index <= TOAST_MAX_VISIBLE + 1; index += 1) {
      show(api, `Visible ${index}`, { title: `Visible ${index}`, duration: 'persistent' });
    }

    for (let index = 1; index <= TOAST_MAX_VISIBLE; index += 1) expect(screen.getByText(`Visible ${index}`)).toBeTruthy();
    expect(screen.queryByText(`Visible ${TOAST_MAX_VISIBLE + 1}`)).toBeNull();
  });

  it('promotes the next queued toast after visible dismissal', () => {
    const { screen, api } = setup();
    const firstId = show(api, 'First', { title: 'First', duration: 'persistent' });
    show(api, 'Second', { title: 'Second', duration: 'persistent' });
    show(api, 'Third', { title: 'Third', duration: 'persistent' });
    show(api, 'Promoted', { title: 'Promoted', duration: 'persistent' });

    act(() => api.dismiss(firstId));
    expect(screen.getByText('Promoted')).toBeTruthy();
  });

  it('keeps persistent notifications mounted across timer advances', () => {
    const { screen, api } = setup();
    show(api, 'Persistent', { title: 'Persistent', duration: 'persistent' });

    act(() => { jest.advanceTimersByTime(60_000); });
    expect(screen.getByText('Persistent')).toBeTruthy();
  });

  it('normalizes invalid durations back to the default', () => {
    const { screen, api } = setup();
    show(api, 'Invalid duration', { title: 'Invalid duration', duration: Number.NaN });

    act(() => { jest.advanceTimersByTime(TOAST_DEFAULT_DURATION); });
    expect(screen.queryByText('Invalid duration')).toBeNull();
  });

  it('cleans a toast timer when dismissed early', () => {
    const { api } = setup();
    const id = show(api, 'Timer cleanup');
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    act(() => api.dismiss(id));
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not let a stale timer dismiss a newer toast', () => {
    const { screen, api } = setup();
    const oldId = show(api, 'Old', { title: 'Old', duration: 1000 });
    act(() => api.dismiss(oldId));
    show(api, 'New', { title: 'New', duration: 'persistent' });

    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByText('New')).toBeTruthy();
  });

  it('runs the action callback', () => {
    const { screen, api } = setup();
    const onPress = jest.fn();
    show(api, 'Action callback', { title: 'Action callback', duration: 'persistent', action: { label: 'Undo', onPress } });

    fireEvent.press(screen.getByLabelText('Undo'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('dismisses after an action callback by default', () => {
    const { screen, api } = setup();
    show(api, 'Action dismissal', { title: 'Action dismissal', duration: 'persistent', action: { label: 'Undo', onPress: jest.fn() } });

    fireEvent.press(screen.getByLabelText('Undo'));
    expect(screen.queryByText('Action dismissal')).toBeNull();
  });

  it('can explicitly keep a toast after its action', () => {
    const { screen, api } = setup();
    show(api, 'Keep action', {
      title: 'Keep action',
      duration: 'persistent',
      action: { label: 'Retry', onPress: jest.fn(), dismissOnPress: false },
    });

    fireEvent.press(screen.getByLabelText('Retry'));
    expect(screen.getByText('Keep action')).toBeTruthy();
  });

  it.each([
    ['neutral', 'border-border-strong'],
    ['success', 'border-success'],
    ['warning', 'border-warning'],
    ['destructive', 'border-destructive'],
    ['info', 'border-info'],
  ] as const)('maps %s to a semantic surface token', (variant, token) => {
    const { screen, api } = setup();
    const id = show(api, `Variant ${variant}`, { title: `Variant ${variant}`, duration: 'persistent', variant });

    expect(screen.getByTestId(`beeui-toast-${id}`).props.className).toContain(token);
  });

  it('announces each mounted toast only once on iOS', () => {
    if (Platform.OS !== 'ios') return;
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => undefined);
    const { screen, api } = setup();
    show(api, 'Announced', { title: 'Announced', description: 'Once', duration: 'persistent' });
    show(api, 'Other', { title: 'Other', duration: 'persistent' });

    expect(announce.mock.calls.filter(([message]) => message === 'Announced, Once')).toHaveLength(1);
    expect(screen.getByText('Announced')).toBeTruthy();
  });

  it('exposes polite live-region semantics without hiding actions', () => {
    const { screen, api } = setup();
    const id = show(api, 'Accessible', { title: 'Accessible', duration: 'persistent', action: { label: 'Open', onPress: jest.fn() } });

    expect(screen.getByTestId(`beeui-toast-${id}`).props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByLabelText('Open').props.accessibilityRole).toBe('button');
    expect(screen.getByLabelText('Dismiss Accessible').props.accessibilityRole).toBe('button');
  });

  it('positions the viewport below the measured top safe-area inset', () => {
    const { screen } = setup();
    const style = StyleSheet.flatten(screen.getByTestId('beeui-toast-viewport').props.style);

    expect(style.top).toBe(TEST_INSETS.top + 12);
  });

  it('cleans visible timers when the provider unmounts', () => {
    const { screen, api } = setup();
    show(api, 'Unmount timer');
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    screen.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps separate BeeUIProvider runtimes isolated', () => {
    let first: ToastApi | null = null;
    let second: ToastApi | null = null;
    const screen = render(
      <View>
        <BeeUIProvider syncUniwindInsets={false}><CaptureToast capture={(api) => { first = api; }} /></BeeUIProvider>
        <BeeUIProvider syncUniwindInsets={false}><CaptureToast capture={(api) => { second = api; }} /></BeeUIProvider>
      </View>,
    );
    if (!first || !second) throw new Error('Toast APIs were not captured');

    show(first, 'First runtime', { title: 'First runtime', duration: 'persistent' });
    show(second, 'Second runtime', { title: 'Second runtime', duration: 'persistent' });
    act(() => first!.dismissAll());

    expect(screen.queryByText('First runtime')).toBeNull();
    expect(screen.getByText('Second runtime')).toBeTruthy();
  });

  it('rejects malformed JS descriptors without corrupting state', () => {
    const { screen, api } = setup();
    expect(() => api.show(null as never)).toThrow(TypeError);
    expect(() => api.show({ title: 42 } as never)).toThrow(TypeError);
    expect(screen.queryAllByTestId(/^beeui-toast-/)).toHaveLength(1); // viewport only
  });

  it('treats unknown dismissal ids as safe no-ops', () => {
    const { screen, api } = setup();
    show(api, 'Still here', { title: 'Still here', duration: 'persistent' });

    act(() => api.dismiss('unknown-toast'));
    expect(screen.getByText('Still here')).toBeTruthy();
  });

  it('fails clearly when useToast is used without BeeUIProvider', () => {
    const invalidRender = () => render(<CaptureToast capture={() => undefined} />);
    expect(invalidRender).toThrow('BeeUI toast APIs require BeeUIProvider at the application root.');
  });

  it('exports stable queue and timing constants', () => {
    expect(TOAST_DEFAULT_DURATION).toBe(5000);
    expect(TOAST_MAX_VISIBLE).toBe(3);
  });
});
