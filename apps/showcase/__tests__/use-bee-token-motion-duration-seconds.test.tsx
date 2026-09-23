import { getBeeToken, useBeeToken } from '@beemvp/beeui-ui';
import { act, render } from '@testing-library/react-native';
import * as React from 'react';
import { Text } from 'react-native';
import { __resetUniwindMockVariables, Uniwind } from 'uniwind';

// #549 — `useBeeToken('motion.normal')` crashed on Web when Uniwind's
// `getComputedStyle`/CSSOM round-trip re-serialized the `--motion-duration-*`
// CSS custom property back out in seconds (`.2s`/`0.2s`) instead of `200ms`.
// Both are valid, semantically identical CSS `<time>` values; BeeUI's shared
// token reader only ever accepted the `ms` shape, so a seconds-serialized
// runtime threw `Invalid BeeUI token reader: ... expected a "ms" duration
// value ... got ".2s"` before ever reaching a scoped-theme assertion.

afterEach(() => {
  Uniwind.setTheme('light');
  __resetUniwindMockVariables();
});

function MotionProbe({ testID }: { testID: string }) {
  const value = useBeeToken('motion.normal');
  return <Text testID={testID}>{value}</Text>;
}

describe('useBeeToken(\'motion.normal\') normalizes a seconds-serialized Uniwind value (#549)', () => {
  it.each([
    ['.2s', 200],
    ['0.2s', 200],
    ['1s', 1000],
    ['-0.1s', -100],
  ] as const)('does not throw and normalizes %s to %dms via useBeeToken', (serialized, expectedMs) => {
    act(() => Uniwind.updateCSSVariables('light', { '--motion-duration-normal': serialized }));

    const screen = render(<MotionProbe testID="probe" />);
    expect(screen.getByTestId('probe').props.children).toBe(expectedMs);
  });

  it('applies the same normalization to getBeeToken (the shared reader path)', () => {
    act(() => Uniwind.updateCSSVariables('light', { '--motion-duration-normal': '.2s' }));
    expect(getBeeToken('motion.normal')).toBe(200);
  });

  it('still accepts the existing ms serialization unchanged', () => {
    act(() => Uniwind.updateCSSVariables('light', { '--motion-duration-normal': '350ms' }));
    expect(getBeeToken('motion.normal')).toBe(350);
  });

  it('leaves the native numeric default (200) unaffected', () => {
    expect(getBeeToken('motion.normal')).toBe(200);
    expect(typeof getBeeToken('motion.normal')).toBe('number');
  });

  it('still rejects a genuinely invalid duration string (not a silent fallback)', () => {
    act(() => Uniwind.updateCSSVariables('light', { '--motion-duration-normal': 'not-a-duration' }));
    expect(() => getBeeToken('motion.normal')).toThrow(/expected a "ms" duration value/);
  });
});
