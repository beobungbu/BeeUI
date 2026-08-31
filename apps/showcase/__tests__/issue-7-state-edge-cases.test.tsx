import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import {
  Chip,
  ChipGroup,
  OTPInput,
  Pagination,
  PaginationItem,
  SettingsItem,
  Stepper,
  StepperItem,
  Text,
} from '@beemvp/beeui-ui';

describe('BeeUI issue #7 state edge cases', () => {
  it('emits OTP completion once per completed value and can complete again after becoming incomplete', () => {
    const onComplete = jest.fn();
    const screen = render(
      <OTPInput accessibilityLabel="Code" defaultValue="123" length={4} onComplete={onComplete} />,
    );
    const input = screen.getByLabelText('Code');

    fireEvent.changeText(input, '1234');
    fireEvent.changeText(input, '1234');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenLastCalledWith('1234');

    fireEvent.changeText(input, '123');
    fireEvent.changeText(input, '1234');
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('uses safe text-entry defaults for text OTP mode while preserving the one-time-code contract', () => {
    const screen = render(<OTPInput accessibilityLabel="Code" mode="text" />);
    const input = screen.getByLabelText('Code');

    expect(input.props.autoCapitalize).toBe('none');
    expect(input.props.autoCorrect).toBe(false);
    expect(input.props.spellCheck).toBe(false);
    expect(input.props.autoComplete).toBe('one-time-code');
  });

  it('disables and warns for a Chip inside ChipGroup without a value', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onSelectedChange = jest.fn();
    const screen = render(
      <ChipGroup value="selected">
        <Chip onSelectedChange={onSelectedChange}>Missing value</Chip>
      </ChipGroup>,
    );

    const chip = screen.getByRole('radio', { name: 'Missing value' });
    expect(chip.props.accessibilityState).toEqual({ checked: false, disabled: true });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('requires a `value`'));
    fireEvent.press(chip);
    expect(onSelectedChange).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('disables malformed runtime page items that omit a finite page', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onPageChange = jest.fn();
    const RuntimePaginationItem = PaginationItem as React.ComponentType<{
      children?: React.ReactNode;
      page?: number;
      type?: 'page' | 'previous' | 'next';
    }>;
    const screen = render(
      <Pagination onPageChange={onPageChange} page={1} pageCount={3}>
        <RuntimePaginationItem type="page" />
      </Pagination>,
    );

    const item = screen.getByRole('button', { name: 'Page' });
    expect(item.props.accessibilityState.disabled).toBe(true);
    expect(item.props.accessibilityState.selected).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('requires a finite `page`'));
    fireEvent.press(item);
    expect(onPageChange).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('disables duplicate normalized Stepper values instead of exposing multiple active steps', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onStepChange = jest.fn();
    const screen = render(
      <Stepper currentStep={1} onStepChange={onStepChange}>
        <StepperItem step={1} title="Account" />
        <StepperItem step={1.8} title="Profile" />
      </Stepper>,
    );

    const account = screen.getByRole('button', { name: 'Account' });
    const profile = screen.getByRole('button', { name: 'Profile' });
    expect(account.props.accessibilityState).toEqual({ disabled: true, selected: false });
    expect(profile.props.accessibilityState).toEqual({ disabled: true, selected: false });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('duplicate normalized step values'));
    fireEvent.press(account);
    expect(onStepChange).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps SettingsItem value visible and accessible when trailing content is also provided', () => {
    const screen = render(
      <SettingsItem
        description="Manage alerts"
        onPress={() => undefined}
        title="Notifications"
        trailing={<Text>›</Text>}
        value="On"
      />,
    );

    expect(screen.getByText('On')).toBeTruthy();
    expect(screen.getByText('›')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Notifications, Manage alerts, On' }),
    ).toBeTruthy();
  });
});
