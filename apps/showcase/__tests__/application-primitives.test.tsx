import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import {
  FormMessage,
  HelperText,
  Link,
  ListGroup,
  ListGroupHeader,
  ListItem,
  Stat,
  StatHelpText,
  StatLabel,
  StatValue,
  Stepper,
  StepperItem,
} from '@beemvp/beeui-ui';

describe('BeeUI application primitive contracts', () => {
  it('exposes Link semantics and preserves caller accessibility state', () => {
    const screen = render(
      <Link accessibilityState={{ selected: true }}>Documentation</Link>,
    );

    const link = screen.getByRole('link', { name: 'Documentation' });
    expect(link.props.accessibilityState).toEqual({ selected: true, disabled: false });
  });

  it('marks disabled links as disabled for accessibility', () => {
    const screen = render(<Link disabled>Disabled link</Link>);

    const link = screen.getByRole('link', { name: 'Disabled link' });
    expect(link.props.accessibilityState.disabled).toBe(true);
  });

  it('renders helper and form feedback with polite live-region semantics', () => {
    const screen = render(
      <>
        <HelperText>Use at least eight characters.</HelperText>
        <FormMessage>Password is required.</FormMessage>
      </>,
    );

    expect(screen.getByText('Use at least eight characters.')).toBeTruthy();
    expect(screen.getByText('Password is required.').props.accessibilityLiveRegion).toBe('polite');
  });

  it('composes grouped application rows without owning row behavior', () => {
    const onPress = jest.fn();
    const screen = render(
      <ListGroup testID="settings-group">
        <ListGroupHeader description="Workspace preferences" title="Settings" />
        <ListItem onPress={onPress} title="Appearance" />
      </ListGroup>,
    );

    expect(screen.getByTestId('settings-group')).toBeTruthy();
    expect(screen.getByText('Workspace preferences')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Appearance' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('composes stat labels, values, and helper text without hidden state', () => {
    const screen = render(
      <Stat>
        <StatLabel>Active users</StatLabel>
        <StatValue>1,284</StatValue>
        <StatHelpText>Up 12% this month</StatHelpText>
      </Stat>,
    );

    expect(screen.getByText('Active users')).toBeTruthy();
    expect(screen.getByText('1,284')).toBeTruthy();
    expect(screen.getByText('Up 12% this month')).toBeTruthy();
  });

  it('reports current Stepper state and requests controlled step changes', () => {
    const onStepChange = jest.fn();
    const screen = render(
      <Stepper currentStep={2} onStepChange={onStepChange}>
        <StepperItem step={1} title="Account" />
        <StepperItem step={2} title="Profile" />
        <StepperItem step={3} title="Review" />
      </Stepper>,
    );

    const account = screen.getByRole('button', { name: 'Account' });
    const profile = screen.getByRole('button', { name: 'Profile' });
    const review = screen.getByRole('button', { name: 'Review' });

    expect(account.props.accessibilityState.selected).toBe(false);
    expect(profile.props.accessibilityState.selected).toBe(true);
    expect(profile.props.accessibilityValue.text).toBe('Step 2 of 3');
    fireEvent.press(review);
    expect(onStepChange).toHaveBeenCalledWith(3);
  });

  it('counts only rendered Stepper children for accessibility position', () => {
    const onStepChange = jest.fn();
    const optionalStep = false;
    const screen = render(
      <Stepper currentStep={2} onStepChange={onStepChange}>
        <StepperItem step={1} title="Account" />
        {optionalStep ? <StepperItem step={2} title="Optional" /> : null}
        <StepperItem step={2} title="Review" />
      </Stepper>,
    );

    expect(screen.getByRole('button', { name: 'Review' }).props.accessibilityValue.text).toBe(
      'Step 2 of 2',
    );
  });

  it('propagates Stepper disabled state to interactive items', () => {
    const onStepChange = jest.fn();
    const screen = render(
      <Stepper currentStep={1} disabled onStepChange={onStepChange}>
        <StepperItem step={1} title="Account" />
        <StepperItem step={2} title="Profile" />
      </Stepper>,
    );

    const profile = screen.getByRole('button', { name: 'Profile' });
    expect(profile.props.accessibilityState.disabled).toBe(true);
  });
});
