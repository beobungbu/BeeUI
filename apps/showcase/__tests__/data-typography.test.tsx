import { cn } from '@beemvp/beeui-core';
import { fontFamily, fontSize, lineHeight, monoFontFamily, numericVariants } from '@beemvp/beeui-tokens';
import { Text, textVariants } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Platform, StyleSheet } from 'react-native';

function flatStyle(node: { props: { style?: unknown } }) {
  return StyleSheet.flatten(node.props.style as never) ?? {};
}

describe('data typography semantics', () => {
  it('exposes canonical, composable numeric and mono metadata (readable by non-className consumers)', () => {
    expect(numericVariants.tabular.webUtilityClass).toBe('bee-tabular-nums');
    expect(numericVariants.tabular.cssProperty).toBe('font-variant-numeric');
    expect(numericVariants.tabular.cssValue).toBe('tabular-nums');
    expect(numericVariants.tabular.nativeFontVariant).toEqual(['tabular-nums']);

    expect(monoFontFamily.webUtilityClass).toBe('font-mono');
    expect(monoFontFamily.native).toMatchObject({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
    expect(fontFamily.mono[fontFamily.mono.length - 1]).toBe('monospace');
    expect(fontFamily.sans).toBe('system');
  });

  it('does not introduce an arbitrary numeric typography scale — the six roles are untouched', () => {
    expect(fontSize).toEqual({ caption: 12, label: 14, body: 16, heading: 18, title: 24, display: 32 });
    expect(lineHeight).toEqual({ caption: 16, label: 20, body: 24, heading: 24, title: 32, display: 40 });
    // "tabular"/"mono" are features, never size roles.
    expect(Object.keys(fontSize)).not.toContain('tabular');
    expect(Object.keys(fontSize)).not.toContain('mono');
  });

  it('keeps default Text output byte-identical when no data-typography feature is requested', () => {
    const screen = render(<Text>Plain body</Text>);
    const node = screen.getByText('Plain body');
    expect(node.props.className).toBe(cn(textVariants({ variant: undefined, tone: undefined })));
    expect(node.props.className).not.toContain('bee-tabular-nums');
    expect(node.props.className).not.toContain('font-mono');
    expect(node.props.style).toBeUndefined();
  });

  it('applies tabular numerals on both web (class) and native (fontVariant style), tied to canonical tokens', () => {
    const screen = render(
      <Text numeric="tabular" variant="body">
        $1,111.00
      </Text>,
    );
    const node = screen.getByText('$1,111.00');
    // The component output must equal the canonical @beemvp/beeui-tokens metadata so the
    // inlined (standalone-portable) values can never drift from the source of truth.
    expect(node.props.className).toContain(numericVariants.tabular.webUtilityClass);
    expect(node.props.className).toContain('text-[length:var(--text-body)]');
    expect(flatStyle(node).fontVariant).toEqual(numericVariants.tabular.nativeFontVariant);
  });

  it('maps mono to the exact canonical iOS and Android family keys, not merely any fallback value', () => {
    const selectSpy = jest.spyOn(Platform, 'select');
    try {
      selectSpy.mockImplementation((config: any) => config.ios ?? config.default);
      const iosScreen = render(<Text family="mono">ios-code</Text>);
      expect(iosScreen.getByText('ios-code').props.className).toContain(monoFontFamily.webUtilityClass);
      expect(flatStyle(iosScreen.getByText('ios-code')).fontFamily).toBe(monoFontFamily.native.ios);
      iosScreen.unmount();

      selectSpy.mockImplementation((config: any) => config.android ?? config.default);
      const androidScreen = render(<Text family="mono">android-code</Text>);
      expect(flatStyle(androidScreen.getByText('android-code')).fontFamily).toBe(monoFontFamily.native.android);
      androidScreen.unmount();
    } finally {
      selectSpy.mockRestore();
    }
  });

  it('leaves Dynamic Type / OS font scaling controls untouched and preserves explicit caller settings', () => {
    const screen = render(
      <Text allowFontScaling maxFontSizeMultiplier={2} numeric="tabular" family="mono">
        scalable-data
      </Text>,
    );
    const node = screen.getByText('scalable-data');
    expect(node.props.allowFontScaling).toBe(true);
    expect(node.props.maxFontSizeMultiplier).toBe(2);
    expect(node.props.adjustsFontSizeToFit).toBeUndefined();
  });

  it('composes numeric + mono with size role, weight, tone, and alignment without dropping any of them', () => {
    const screen = render(
      <Text className="text-right" family="mono" numeric="tabular" tone="success" variant="label">
        +$8,920.00
      </Text>,
    );
    const node = screen.getByText('+$8,920.00');
    const className = node.props.className as string;
    expect(className).toContain('text-[length:var(--text-label)]'); // size role preserved
    expect(className).toContain('leading-[var(--text-label--line-height)]');
    expect(className).toContain('font-semibold'); // label weight preserved
    expect(className).toContain('text-success'); // tone preserved
    expect(className).toContain('text-right'); // alignment preserved
    expect(className).toContain('bee-tabular-nums');
    expect(className).toContain('font-mono');
    expect(flatStyle(node).fontVariant).toEqual(['tabular-nums']);
  });

  it('survives tailwind-merge: the numeric size role is never clobbered by feature/family utilities', () => {
    const merged = cn(textVariants({ variant: 'title' }), 'bee-tabular-nums', 'font-mono', 'text-right');
    expect(merged).toContain('text-[length:var(--text-title)]');
    expect(merged).toContain('leading-[var(--text-title--line-height)]');
    expect(merged).toContain('font-bold'); // title weight
    expect(merged).toContain('bee-tabular-nums');
    expect(merged).toContain('font-mono');
    expect(merged).toContain('text-right');
  });

  it('applies tabular numerals uniformly across a numeric column so unequal-length values can align', () => {
    const amounts = ['1', '11', '111', '1,111.00'];
    const screen = render(
      <>
        {amounts.map((amount) => (
          <Text className="text-right" key={amount} numeric="tabular" variant="body">
            {amount}
          </Text>
        ))}
      </>,
    );
    for (const amount of amounts) {
      const node = screen.getByText(amount);
      expect(node.props.className).toContain('bee-tabular-nums');
      expect(flatStyle(node).fontVariant).toEqual(['tabular-nums']);
    }
  });
});
