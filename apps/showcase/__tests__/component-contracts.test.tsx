import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { Button, Input } from '@beeui/ui';

describe('BeeUI component contracts', () => {
  it('exposes an accessible button and forwards presses', () => {
    const onPress = jest.fn();
    const screen = render(<Button onPress={onPress}>Save changes</Button>);
    const button = screen.getByRole('button', { name: 'Save changes' });

    expect(button.props.accessibilityState).toEqual({ disabled: false, busy: false });

    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('marks a loading button as disabled and busy', () => {
    const onPress = jest.fn();
    const screen = render(
      <Button loading onPress={onPress}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });

    expect(button.props.disabled).toBe(true);
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });

    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('keeps disabled inputs non-editable while preserving accessibility state', () => {
    const screen = render(<Input accessibilityLabel="Email" disabled placeholder="Email" />);
    const input = screen.getByLabelText('Email');

    expect(input.props.editable).toBe(false);
    expect(input.props.accessibilityState).toEqual({ disabled: true });
  });
});
