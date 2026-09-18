import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { PasswordInput } from '@beemvp/beeui-ui';

// `showLabel`/`hideLabel` only ever changed the toggle's accessible name;
// the visible button text was always the hardcoded English "Show"/"Hide",
// regardless of what a caller passed for localization.
describe('BeeUI PasswordInput showLabel/hideLabel drive the visible toggle text', () => {
  it('renders the localized showLabel as the visible toggle text, not the English default', () => {
    const screen = render(<PasswordInput hideLabel="Ẩn" showLabel="Hiện" />);

    expect(screen.getByText('Hiện')).toBeTruthy();
    expect(screen.queryByText('Show')).toBeNull();
  });

  it('renders the localized hideLabel as the visible toggle text after revealing the password', () => {
    const screen = render(<PasswordInput hideLabel="Ẩn" showLabel="Hiện" />);

    fireEvent.press(screen.getByRole('button', { name: 'Hiện' }));

    expect(screen.getByText('Ẩn')).toBeTruthy();
    expect(screen.queryByText('Hide')).toBeNull();
  });

  it('keeps the English default as both the visible text and accessible name when unset', () => {
    const screen = render(<PasswordInput />);

    expect(screen.getByText('Show password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show password' })).toBeTruthy();
  });
});
