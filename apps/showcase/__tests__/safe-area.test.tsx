import { render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { View } from 'react-native';
import { Uniwind } from 'uniwind';
import { BeeUIProvider, SafeArea, Text } from '@beemvp/beeui-ui';

const TEST_INSETS = { top: 47, right: 0, bottom: 34, left: 0 };

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({
      children,
      onChange,
    }: {
      children?: React.ReactNode;
      onChange: (metrics: { frame: typeof frame; insets: typeof insets }) => void;
    }) => {
      React.useEffect(() => {
        onChange({ frame, insets });
      }, [onChange]);
      return children;
    },
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

describe('BeeUI safe-area foundation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('forwards explicit edge ownership and mode through SafeArea', () => {
    const screen = render(
      <SafeArea edges={['top', 'left', 'right']} mode="margin" testID="safe-area">
        <Text>Safe content</Text>
      </SafeArea>,
    );

    const safeArea = screen.getByTestId('safe-area');
    expect(safeArea.props.edges).toEqual(['top', 'left', 'right']);
    expect(safeArea.props.mode).toBe('margin');
    expect(screen.getByText('Safe content')).toBeTruthy();
  });

  it('syncs measured insets into Uniwind by default', async () => {
    const updateInsets = jest.spyOn(Uniwind, 'updateInsets').mockImplementation(() => undefined);

    render(
      <BeeUIProvider>
        <Text>App</Text>
      </BeeUIProvider>,
    );

    await waitFor(() => expect(updateInsets).toHaveBeenCalledWith(TEST_INSETS));
  });

  it('lets applications disable the Uniwind bridge when they already own it', () => {
    const updateInsets = jest.spyOn(Uniwind, 'updateInsets').mockImplementation(() => undefined);

    render(
      <BeeUIProvider syncUniwindInsets={false}>
        <Text>App</Text>
      </BeeUIProvider>,
    );

    expect(updateInsets).not.toHaveBeenCalled();
  });

  // #563/#564: a `className={undefined}` (the common `cond ? "x" : undefined`
  // idiom) forwarded raw to the underlying Uniwind-wrapped host crashes real
  // styleq with "typeof undefined is not \"string\" or \"null\"" — this mock
  // cannot execute styleq itself (it stands in for the whole `uniwind`
  // package), so this asserts the exact invariant that avoids it: BeeUI never
  // hands the host a raw `undefined` `className`, always a string.
  it('never forwards a raw `undefined` className to the underlying host (#563/#564)', () => {
    const screen = render(<SafeArea testID="safe-area" />);
    expect(typeof screen.getByTestId('safe-area').props.className).toBe('string');
  });

  it('still forwards a defined className unchanged', () => {
    const screen = render(<SafeArea className="bg-surface" testID="safe-area" />);
    expect(screen.getByTestId('safe-area').props.className).toBe('bg-surface');
  });

  // #598: the library's own inset padding is a native inline style, which
  // otherwise always beats a class regardless of source order, silently
  // dropping a caller's `className` padding despite the documented "wins on
  // conflict" `cn()` contract. BeeUI resolves this by excluding exactly the
  // edges the caller's own className already pads, so the library sets no
  // competing style there and the class applies untouched.
  describe('className padding wins over the edge inset it conflicts with (#598)', () => {
    it('drops both horizontal edges for `px-4`', () => {
      const screen = render(
        <SafeArea className="px-4" edges={['top', 'right', 'bottom', 'left']} testID="safe-area" />,
      );
      expect(screen.getByTestId('safe-area').props.edges).toEqual(['top', 'bottom']);
    });

    it('drops only `top` for `pt-6`, keeping the other three edges inset', () => {
      const screen = render(
        <SafeArea className="pt-6" edges={['top', 'right', 'bottom', 'left']} testID="safe-area" />,
      );
      expect(screen.getByTestId('safe-area').props.edges).toEqual(['right', 'bottom', 'left']);
    });

    it('drops every edge for the catch-all `p-4`', () => {
      const screen = render(
        <SafeArea className="p-4" edges={['top', 'right', 'bottom', 'left']} testID="safe-area" />,
      );
      expect(screen.getByTestId('safe-area').props.edges).toEqual([]);
    });

    it('applies the same resolution to the library default edge set when `edges` is omitted', () => {
      const screen = render(<SafeArea className="py-6" testID="safe-area" />);
      expect(screen.getByTestId('safe-area').props.edges).toEqual(['right', 'left']);
    });

    it('keeps every edge inset when className sets no padding', () => {
      const screen = render(
        <SafeArea className="bg-surface" edges={['top', 'right', 'bottom', 'left']} testID="safe-area" />,
      );
      expect(screen.getByTestId('safe-area').props.edges).toEqual(['top', 'right', 'bottom', 'left']);
    });

    it('forwards the per-edge object form of `edges` unchanged', () => {
      const objectEdges = { bottom: 'off', top: 'padding' } as const;
      const screen = render(
        <SafeArea className="pt-4" edges={objectEdges} testID="safe-area" />,
      );
      expect(screen.getByTestId('safe-area').props.edges).toEqual(objectEdges);
    });
  });
});
