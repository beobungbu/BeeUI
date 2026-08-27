import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  avatarSize,
  beeBrandNames,
  beeRuntimeThemeNames,
  beeThemeNames,
  contentWidth,
  controlSize,
  defineSemanticColorOverrides,
  elevation,
  focusRing,
  fontSize,
  getBeeThemeSelection,
  iconSize,
  lineHeight,
  motionDuration,
  resolveBeeRuntimeTheme,
  semanticColorTokens,
  semanticColorVariable,
  type BeeRuntimeThemeName,
  type SemanticColorOverrides,
  type SemanticColorToken,
} from '@beeui/tokens';

const themeCss = fs.readFileSync(
  path.resolve(__dirname, '../../../packages/tokens/src/theme.css'),
  'utf8',
);

const legacySemanticColorContract = [
  'background',
  'foreground',
  'surface',
  'surface-muted',
  'surface-raised',
  'muted',
  'muted-foreground',
  'subtle-foreground',
  'primary',
  'primary-foreground',
  'primary-hover',
  'primary-pressed',
  'secondary',
  'secondary-foreground',
  'secondary-hover',
  'destructive',
  'destructive-foreground',
  'success',
  'success-foreground',
  'warning',
  'warning-foreground',
  'info',
  'info-foreground',
  'border',
  'border-strong',
  'input',
  'focus-ring',
  'disabled',
  'disabled-foreground',
  'overlay',
] as const satisfies readonly SemanticColorToken[];

const addedFilledActionStateTokens = [
  'secondary-pressed',
  'destructive-hover',
  'destructive-pressed',
] as const satisfies readonly SemanticColorToken[];

const addedControlBoundaryTokens = ['control-border'] as const satisfies readonly SemanticColorToken[];

const filledActionContrastContract = [
  {
    foreground: 'primary-foreground',
    backgrounds: ['primary', 'primary-hover', 'primary-pressed'],
  },
  {
    foreground: 'secondary-foreground',
    backgrounds: ['secondary', 'secondary-hover', 'secondary-pressed'],
  },
  {
    foreground: 'destructive-foreground',
    backgrounds: ['destructive', 'destructive-hover', 'destructive-pressed'],
  },
] as const satisfies readonly {
  foreground: SemanticColorToken;
  backgrounds: readonly SemanticColorToken[];
}[];

function extractVariant(css: string, name: string) {
  const marker = `@variant ${name} {`;
  const markerIndex = css.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing theme variant: ${name}`);

  const openIndex = css.indexOf('{', markerIndex);
  let depth = 0;
  for (let index = openIndex; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(openIndex + 1, index);
  }

  throw new Error(`Unclosed theme variant: ${name}`);
}

function colorVariables(variant: string) {
  const entries = Array.from(
    variant.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6,8});/g),
    (match) => [match[1], match[2]] as const,
  );
  return { entries, values: new Map(entries) };
}

function relativeLuminance(hex: string) {
  const rgb = hex
    .slice(1, 7)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!rgb || rgb.length !== 3) throw new Error(`Unsupported color: ${hex}`);

  const linear = rgb.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(left: string, right: string) {
  const [lighter, darker] = [relativeLuminance(left), relativeLuminance(right)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

describe('theme/token system v2', () => {
  it('preserves every legacy semantic color while adding filled-action states and the control-boundary role', () => {
    expect(semanticColorTokens).toEqual(expect.arrayContaining(legacySemanticColorContract));
    expect(semanticColorTokens).toEqual(expect.arrayContaining(addedFilledActionStateTokens));
    expect(semanticColorTokens).toEqual(expect.arrayContaining(addedControlBoundaryTokens));
    expect(semanticColorTokens).toHaveLength(
      legacySemanticColorContract.length +
        addedFilledActionStateTokens.length +
        addedControlBoundaryTokens.length,
    );
    expect(new Set(semanticColorTokens).size).toBe(semanticColorTokens.length);
  });

  it('self-registers custom brand variants in distributable theme CSS', () => {
    expect(themeCss).toContain(
      '@custom-variant violet-light (&:where(.violet-light, .violet-light *));',
    );
    expect(themeCss).toContain(
      '@custom-variant violet-dark (&:where(.violet-dark, .violet-dark *));',
    );
    expect(themeCss.indexOf('@custom-variant violet-light')).toBeLessThan(
      themeCss.indexOf('@variant violet-light'),
    );
    expect(themeCss.indexOf('@custom-variant violet-dark')).toBeLessThan(
      themeCss.indexOf('@variant violet-dark'),
    );
  });

  it('defines complete color counterparts for every runtime theme', () => {
    expect(beeThemeNames).toEqual(['light', 'dark']);
    expect(beeBrandNames).toEqual(['bee', 'violet']);
    expect(beeRuntimeThemeNames).toEqual(['light', 'dark', 'violet-light', 'violet-dark']);

    for (const theme of beeRuntimeThemeNames) {
      const { entries } = colorVariables(extractVariant(themeCss, theme));
      expect(entries.map(([name]) => name).sort()).toEqual([...semanticColorTokens].sort());
      expect(new Set(entries.map(([name]) => name)).size).toBe(semanticColorTokens.length);
    }
  });

  it('maps brand and light/dark intent to deterministic Uniwind runtime themes', () => {
    const runtimeTheme: BeeRuntimeThemeName = resolveBeeRuntimeTheme('violet', 'dark');
    expect(runtimeTheme).toBe('violet-dark');
    expect(getBeeThemeSelection(runtimeTheme)).toEqual({ brand: 'violet', theme: 'dark' });
    expect(resolveBeeRuntimeTheme('bee', 'light')).toBe('light');
  });

  it('keeps semantic runtime overrides typed to public CSS variable names', () => {
    const overrides = {
      '--color-primary': '#123456',
      '--color-focus-ring': '#654321',
    } satisfies SemanticColorOverrides;
    const defined = defineSemanticColorOverrides(overrides);

    expect(defined).toEqual(overrides);
    expect(Object.isFrozen(defined)).toBe(true);
    expect(semanticColorVariable('primary')).toBe('--color-primary');
  });

  it('exports the intentional v2 sizing, type, elevation, motion, and focus contracts', () => {
    expect(fontSize).toEqual({ caption: 12, label: 14, body: 16, heading: 18, title: 24, display: 32 });
    expect(lineHeight).toEqual({ caption: 16, label: 20, body: 24, heading: 24, title: 32, display: 40 });
    expect(controlSize).toEqual({ compact: 36, default: 44, large: 48, icon: 44, touchTarget: 44 });
    expect(iconSize).toEqual({ xs: 12, sm: 16, md: 20, lg: 24 });
    expect(avatarSize).toEqual({ sm: 32, md: 40, lg: 48, xl: 64 });
    expect(contentWidth).toEqual({ form: 512, reading: 704, page: 1152, dialog: 512 });
    expect(elevation.raised.nativeElevation).toBe(2);
    expect(elevation.overlay.nativeElevation).toBe(8);
    expect(motionDuration).toEqual({ fast: 120, normal: 200, slow: 320 });
    expect(focusRing).toMatchObject({ width: 2, offset: 2, colorToken: 'focus-ring' });
    expect(controlSize.touchTarget).toBeGreaterThanOrEqual(44);
  });

  it('emits the semantic Tailwind/Uniwind variable names consumed by representative components', () => {
    for (const role of ['caption', 'label', 'body', 'heading', 'title', 'display']) {
      expect(themeCss).toContain(`--text-${role}:`);
      expect(themeCss).toContain(`--text-${role}--line-height:`);
    }

    for (const variable of [
      '--spacing-control-compact:',
      '--spacing-control-default:',
      '--spacing-control-large:',
      '--spacing-control-icon:',
      '--spacing-touch-target:',
      '--spacing-avatar-md:',
      '--container-form:',
      '--container-reading:',
      '--container-page:',
      '--container-dialog:',
      '--shadow-raised:',
      '--shadow-overlay:',
      '--motion-duration-fast:',
      '--motion-duration-normal:',
      '--motion-duration-slow:',
      '--focus-ring-width:',
      '--focus-ring-offset:',
      '@utility bee-focus-ring',
    ]) {
      expect(themeCss).toContain(variable);
    }
  });

  it.each(beeRuntimeThemeNames)(
    '%s meets representative text, status, focus, filled-action, and control-boundary contrast targets',
    (theme) => {
      const { values } = colorVariables(extractVariant(themeCss, theme));
      const color = (name: SemanticColorToken) => {
        const value = values.get(name);
        if (!value) throw new Error(`Missing ${name} in ${theme}`);
        return value;
      };

      expect(contrastRatio(color('foreground'), color('background'))).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(color('muted-foreground'), color('background'))).toBeGreaterThanOrEqual(4.5);

      expect(contrastRatio(color('control-border'), color('input'))).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(color('focus-ring'), color('background'))).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(color('focus-ring'), color('input'))).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(color('focus-ring'), color('surface'))).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(color('focus-ring'), color('surface-muted'))).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(color('destructive'), color('input'))).toBeGreaterThanOrEqual(3);

      for (const { foreground, backgrounds } of filledActionContrastContract) {
        for (const background of backgrounds) {
          expect(contrastRatio(color(background), color(foreground))).toBeGreaterThanOrEqual(4.5);
        }
      }

      for (const role of ['success', 'warning', 'info'] as const) {
        expect(contrastRatio(color(role), color(`${role}-foreground`))).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
