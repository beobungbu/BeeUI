import { Input, SearchInput } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Platform, TextInput } from 'react-native';

// On Web, Uniwind resolves a TextInput's `placeholderTextColorClassName` by reading
// stylesheet rules during the first render. When the stylesheet arrives after that render
// (a cold load from Metro) the colour is empty, Uniwind logs "className
// 'accent-muted-foreground' ... no color was found", and the placeholder keeps the browser
// default. Web therefore passes the theme-variable colour and no accent classes; native
// keeps the class bridge, which resolves from the compiled style store.

const ACCENT_CLASS_PROPS = [
  'cursorColorClassName',
  'placeholderTextColorClassName',
  'selectionColorClassName',
  'selectionHandleColorClassName',
  'underlineColorAndroidClassName',
] as const;

const originalOS = Platform.OS;

function setOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

afterEach(() => setOS(originalOS));

describe('Input placeholder colour', () => {
  for (const [name, element] of [
    ['Input', <Input key="input" placeholder="Search" />],
    ['SearchInput', <SearchInput key="search" placeholder="Search" />],
  ] as const) {
    it(`${name} uses the theme variable and no accent class on Web`, () => {
      setOS('web');
      const field = render(element).UNSAFE_getByType(TextInput);

      expect(field.props.placeholderTextColor).toBe('var(--color-muted-foreground)');
      for (const prop of ACCENT_CLASS_PROPS) expect(field.props[prop]).toBeUndefined();
    });
  }

  it("keeps a caller's own placeholderTextColor on Web", () => {
    setOS('web');
    const field = render(<Input placeholder="Search" placeholderTextColor="var(--brand-hint)" />).UNSAFE_getByType(
      TextInput,
    );

    expect(field.props.placeholderTextColor).toBe('var(--brand-hint)');
  });

  it('keeps the accent class bridge on native', () => {
    const field = render(<Input placeholder="Search" />).UNSAFE_getByType(TextInput);

    expect(field.props.placeholderTextColorClassName).toBe('accent-muted-foreground');
    expect(field.props.cursorColorClassName).toBe('accent-primary');
    expect(field.props.selectionColorClassName).toBe('accent-primary');
    expect(field.props.selectionHandleColorClassName).toBe('accent-primary');
    expect(field.props.underlineColorAndroidClassName).toBe('accent-transparent');
    expect(field.props.placeholderTextColor).toBeUndefined();
  });
});
