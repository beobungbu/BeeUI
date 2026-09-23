import { Input, SearchInput } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';
import { FONT_SCALE_STRESS_LEVELS, withFontScale } from './helpers/dynamic-type';

// A single-line text field must not pin its line box on native. React Native
// scales an explicit `lineHeight` together with the font, but iOS lays a
// single-line field's glyphs out at the bottom of that fixed paragraph line
// box, so at accessibility text sizes (font scale ~2.14) descenders crossed
// the field's bottom border even though the row grew. Without an explicit
// line height the field uses the font's own metrics, which scale with the
// glyphs. On Web the line height stays, bound to the typography token so it
// tracks the token font size (`controls-sizing.spec.ts` measures that).

function classTokens(className: unknown) {
  return String(className ?? '')
    .split(/\s+/)
    .filter(Boolean);
}

// A utility with no platform prefix (or `ios:`/`android:`/`native:`) that
// sets line-height reaches the native TextInput style.
function nativeLineHeightUtilities(className: unknown) {
  return classTokens(className).filter((token) => /^(?:(?:ios|android|native):)?leading-/.test(token));
}

const FIELDS = [
  { name: 'Input sm', role: 'label', element: <Input accessibilityLabel="Field" size="sm" testID="field" /> },
  { name: 'Input md', role: 'body', element: <Input accessibilityLabel="Field" size="md" testID="field" /> },
  { name: 'Input lg', role: 'body', element: <Input accessibilityLabel="Field" size="lg" testID="field" /> },
  { name: 'SearchInput', role: 'body', element: <SearchInput accessibilityLabel="Field" testID="field" /> },
] as const;

describe('Input and SearchInput line height', () => {
  for (const field of FIELDS) {
    it(`${field.name} sets no native line height at any font scale`, () => {
      for (const scale of FONT_SCALE_STRESS_LEVELS) {
        withFontScale(scale, () => {
          const { getByTestId, unmount } = render(field.element);
          const className = getByTestId('field').props.className;
          expect({ scale, utilities: nativeLineHeightUtilities(className) }).toEqual({ scale, utilities: [] });
          unmount();
        });
      }
    });

    it(`${field.name} keeps the semantic font size everywhere and the token line height on Web`, () => {
      const className = render(field.element).getByTestId('field').props.className;
      const tokens = classTokens(className);
      expect(tokens).toContain(`text-[length:var(--text-${field.role})]`);
      expect(tokens).toContain(`web:leading-[var(--text-${field.role}--line-height)]`);
    });
  }
});
