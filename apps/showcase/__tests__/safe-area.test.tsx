import { render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { StyleSheet } from 'react-native';
import { Uniwind } from 'uniwind';
import { BeeUIProvider, SafeArea, Text } from '@beemvp/beeui-ui';

const TEST_INSETS = { top: 47, right: 0, bottom: 34, left: 0 };

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  const EDGE_ORDER = ['top', 'right', 'bottom', 'left'];
  const STYLE_KEY_BY_MODE = {
    padding: { top: 'paddingTop', right: 'paddingRight', bottom: 'paddingBottom', left: 'paddingLeft' },
    margin: { top: 'marginTop', right: 'marginRight', bottom: 'marginBottom', left: 'marginLeft' },
  };

  function resolveEdges(edges: unknown): string[] {
    if (edges === undefined) return EDGE_ORDER;
    if (Array.isArray(edges)) return edges;
    const objectEdges = edges as Record<string, string>;
    return EDGE_ORDER.filter((edge) => objectEdges[edge] && objectEdges[edge] !== 'off');
  }

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
    // Mirrors react-native-safe-area-context's own SafeAreaView closely enough to prove
    // real geometry composition: each active edge's inset is applied as an inline style
    // placed AFTER the caller's own `style` in the array (RN's later-wins merge) — the
    // same "inline inset always wins" mechanic that made a naive className merge lose a
    // caller's padding. Defaults to all four edges and `mode="padding"` when omitted,
    // matching the real library's own documented default.
    SafeAreaView: React.forwardRef(
      (
        { children, edges, mode = 'padding', style, ...rest }: Record<string, unknown>,
        ref: React.Ref<typeof View>,
      ) => {
        const styleKey = STYLE_KEY_BY_MODE[mode as 'padding' | 'margin'];
        const insetStyle: Record<string, number> = {};
        resolveEdges(edges).forEach((edge) => {
          insetStyle[styleKey[edge as keyof typeof styleKey]] = insets[edge as keyof typeof insets];
        });
        return (
          <View ref={ref} {...rest} edges={edges} mode={mode} style={[style, insetStyle]}>
            {children}
          </View>
        );
      },
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

  // A `className={undefined}` (the common `cond ? "x" : undefined` idiom) forwarded raw to
  // the underlying Uniwind-wrapped host crashes real styleq with "typeof undefined is not
  // \"string\" or \"null\"" — this mock cannot execute styleq itself (it stands in for the
  // whole `uniwind` package), so this asserts the exact invariant that avoids it: BeeUI
  // never hands the host a raw `undefined` `className`, always a string.
  it('never forwards a raw `undefined` className to the underlying host', () => {
    const screen = render(<SafeArea testID="safe-area" />);
    expect(typeof screen.getByTestId('safe-area').props.className).toBe('string');
  });

  it('still forwards a defined, non-padding className unchanged on the single rendered node', () => {
    const screen = render(
      <SafeArea className="bg-surface" testID="safe-area">
        <Text>Safe content</Text>
      </SafeArea>,
    );
    const tree = screen.toJSON() as {
      type: string;
      props: Record<string, unknown>;
      children: Array<{ type: string }>;
    };

    expect(screen.getByTestId('safe-area').props.className).toBe('bg-surface');
    // No extra wrapper node: the child renders directly inside the safe-area host.
    expect(tree.type).toBe('View');
    expect(tree.props.testID).toBe('safe-area');
    expect(tree.children[0].type).toBe('Text');
  });

  // The library's own inset padding is a native inline style, which always beats a CSS
  // class regardless of source order — a naive merge silently dropped a caller's own
  // className/style padding, and a since-reverted fix that instead stripped the
  // conflicting edge from `edges` silently dropped the device inset on that edge. Inset
  // and caller padding now compose on two different nodes instead of competing on one:
  // the outer element keeps only the safe-area inset, and an inner wrapper View (only
  // rendered when the caller actually supplies padding) carries the caller's own
  // className/style padding, so both are visible in the final layout at once.
  describe('caller padding composes additively with the safe-area inset', () => {
    it('renders the caller style padding inside the safe-area inset instead of replacing it', () => {
      const screen = render(
        <SafeArea edges={['top']} style={{ paddingTop: 24 }} testID="safe-area">
          <Text testID="content">Safe content</Text>
        </SafeArea>,
      );

      const tree = screen.toJSON() as {
        type: string;
        props: Record<string, unknown>;
        children: Array<{ type: string; props: Record<string, unknown> }>;
      };

      // Outer node: only the device inset, none of the caller's own padding.
      expect(StyleSheet.flatten(tree.props.style)).toEqual({ paddingTop: 47 });
      // Inner wrapper: only the caller's own padding, sitting inside the inset above.
      const wrapper = tree.children[0];
      expect(StyleSheet.flatten(wrapper.props.style)).toEqual({ paddingTop: 24 });
      expect(screen.getByTestId('content')).toBeTruthy();
    });

    it('keeps the safe-area inset fully intact when className uses a variant-prefixed padding utility (e.g. `md:pt-6`)', () => {
      const screen = render(
        <SafeArea className="md:pt-6" edges={['top']} testID="safe-area">
          <Text testID="content">Safe content</Text>
        </SafeArea>,
      );

      const tree = screen.toJSON() as {
        type: string;
        props: Record<string, unknown>;
        children: Array<{ type: string; props: Record<string, unknown> }>;
      };

      // The inset is never stripped for any edge, variant-prefixed padding or not.
      expect(StyleSheet.flatten(tree.props.style)).toEqual({ paddingTop: 47 });
      // The caller's own class still reaches an element — just the inner wrapper now,
      // not the outer node that owns the inset.
      expect(tree.children[0].props.className).toContain('md:pt-6');
    });

    it('renders an inner wrapper only when the caller actually supplies padding, keeping the no-padding case at a single node', () => {
      const withPadding = render(
        <SafeArea style={{ padding: 8 }} testID="padded">
          <Text>Padded</Text>
        </SafeArea>,
      );
      const withoutPadding = render(
        <SafeArea style={{ backgroundColor: 'red' }} testID="unpadded">
          <Text>Unpadded</Text>
        </SafeArea>,
      );

      const paddedTree = withPadding.toJSON() as { children: unknown[] };
      const unpaddedTree = withoutPadding.toJSON() as { children: Array<{ type: string }> };

      expect(Array.isArray(paddedTree.children)).toBe(true);
      // The wrapper View is the sole child of the padded case's outer node.
      expect((paddedTree.children as Array<{ type: string }>)[0].type).toBe('View');
      // The unpadded case's child is the Text itself, with no wrapping View in between.
      expect(unpaddedTree.children[0].type).toBe('Text');
    });
  });
});
