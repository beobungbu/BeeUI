import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import {
  Button,
  Checkbox,
  Input,
  Progress,
  Radio,
  RadioGroup,
  Switch,
} from '@beeui/ui';

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

  it('exposes checkbox state and requests controlled changes', () => {
    const onCheckedChange = jest.fn();
    const screen = render(
      <Checkbox checked={false} label="Accept terms" onCheckedChange={onCheckedChange} />,
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Accept terms' });

    expect(checkbox.props.accessibilityState).toEqual({ checked: false, disabled: false });

    fireEvent.press(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('maps switch value to its accessibility state', () => {
    const screen = render(<Switch accessibilityLabel="Notifications" value />);
    const toggle = screen.getByRole('switch', { name: 'Notifications' });

    expect(toggle.props.accessibilityState).toEqual({ checked: true, disabled: false });
  });

  it('coordinates radio values through RadioGroup', () => {
    const onValueChange = jest.fn();
    const screen = render(
      <RadioGroup accessibilityLabel="Plan" onValueChange={onValueChange} value="starter">
        <Radio label="Starter plan" value="starter" />
        <Radio label="Pro plan" value="pro" />
      </RadioGroup>,
    );

    const group = screen.getByRole('radiogroup', { name: 'Plan' });
    const starter = screen.getByRole('radio', { name: 'Starter plan' });
    const pro = screen.getByRole('radio', { name: 'Pro plan' });

    expect(group).toBeTruthy();
    expect(starter.props.accessibilityState.checked).toBe(true);
    expect(pro.props.accessibilityState.checked).toBe(false);

    fireEvent.press(pro);
    expect(onValueChange).toHaveBeenCalledWith('pro');
  });

  it('clamps progress values for accessibility', () => {
    const screen = render(<Progress accessibilityLabel="Upload" max={100} value={140} />);
    const progress = screen.getByRole('progressbar', { name: 'Upload' });

    expect(progress.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 100 });
  });
});
