import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@beemvp/beeui-ui';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 320, height: 240 };
  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ReactActual.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) => (
        <View ref={ref} {...props}>
          {children}
        </View>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

// #613 item 2 — reported: "SelectValue renders nothing when the bound value
// is the empty string (no placeholder either), so an 'all' option keyed by
// '' shows a blank trigger." Verified against current source: `SelectValue`
// already treats `resolvedValue === ''` like any other real value (only
// `undefined` — no selection — falls back to the placeholder), so a `''`-keyed
// item's label renders correctly, and `''` with no matching item correctly
// falls back to the placeholder. Not reproducible against this repo's current
// `select.tsx` (see `plans/260918-1559-consumer-audit-fix-all/reports/ws-b-report.md`
// for the exact repro attempts) — this locks the already-correct behavior in.
describe('SelectValue with an empty-string bound value (#613 item 2)', () => {
  it('shows the matching item label for a controlled empty-string value', () => {
    const screen = render(
      <OverlayRuntimeProvider>
        <Select value="">
          <SelectTrigger testID="trigger">
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
      </OverlayRuntimeProvider>,
    );

    expect(screen.getByText('All')).toBeTruthy();
  });

  it('shows the matching item label for an uncontrolled defaultValue empty string', () => {
    const screen = render(
      <OverlayRuntimeProvider>
        <Select defaultValue="">
          <SelectTrigger testID="trigger">
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
          </SelectContent>
        </Select>
      </OverlayRuntimeProvider>,
    );

    expect(screen.getByText('All')).toBeTruthy();
  });

  it('falls back to the placeholder when the empty-string value has no matching item', () => {
    const screen = render(
      <OverlayRuntimeProvider>
        <Select value="">
          <SelectTrigger testID="trigger">
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
      </OverlayRuntimeProvider>,
    );

    expect(screen.getByText('Choose')).toBeTruthy();
  });
});
