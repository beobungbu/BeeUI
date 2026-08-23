import { Popover, PopoverContent, PopoverTrigger } from '@beeui/ui';
import { render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Text, View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
  const frame = { x: 0, y: 0, width: 300, height: 200 };

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

const HOST_RECT = { x: 0, y: 0, width: 300, height: 200 };
const ANCHOR_RECT = { x: 100, y: 60, width: 40, height: 20 };
const ScreenLocalContext = React.createContext('context-default');

function ConsumerUsingScreenLocalContext() {
  const value = React.useContext(ScreenLocalContext);
  return <Text testID="consumer-context-value">{value}</Text>;
}

// The teleport host preserves consumer context and is verified on a real device
// (see plans/.../reports/feat-impl-device-context-preserved.png). It cannot be
// exercised faithfully here: jest is a JS-only runtime where teleport's native
// PortalHostView is unregistered, so the runtime selects the legacy store host.
// This test therefore pins the legacy host's behavior — the web and
// New-Architecture-off backend — which renders overlay content under the
// provider-owned host and does not preserve context scoped below it.
describe('BeeUI anchored-overlay legacy host consumer context contract', () => {
  it('legacy store host does not preserve consumer context scoped below the host', async () => {
    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
        <ScreenLocalContext.Provider value="screen-value">
          <Popover defaultOpen>
            <PopoverTrigger testID="trigger">Open</PopoverTrigger>
            <PopoverContent avoidSafeArea={false} testID="content">
              <ConsumerUsingScreenLocalContext />
            </PopoverContent>
          </Popover>
        </ScreenLocalContext.Provider>
      </OverlayRuntimeProvider>,
      {
        createNodeMock: (element) => {
          if (element.props?.testID !== 'trigger') return null;
          return {
            measureInWindow: (
              callback: (x: number, y: number, width: number, height: number) => void,
            ) =>
              callback(
                ANCHOR_RECT.x,
                ANCHOR_RECT.y,
                ANCHOR_RECT.width,
                ANCHOR_RECT.height,
              ),
          };
        },
      },
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('consumer-context-value', { includeHiddenElements: true }).props.children,
      ).toBe('context-default');
    });
  });
});
