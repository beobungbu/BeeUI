import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Field,
  Input,
  ListItem,
  Progress,
  Radio,
  RadioGroup,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
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

  it('preserves caller accessibility state while enforcing loading semantics', () => {
    const onPress = jest.fn();
    const screen = render(
      <Button accessibilityState={{ selected: true }} loading onPress={onPress}>Save</Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.props.accessibilityState).toEqual({ selected: true, disabled: true, busy: true });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('keeps disabled inputs non-editable while preserving accessibility state', () => {
    const screen = render(
      <Input accessibilityLabel="Email" accessibilityState={{ selected: true }} disabled placeholder="Email" />,
    );
    const input = screen.getByLabelText('Email');
    expect(input.props.editable).toBe(false);
    expect(input.props.accessibilityState).toEqual({ selected: true, disabled: true });
  });

  it('propagates Field label, error, and state into Input', () => {
    const screen = render(
      <Field error="Enter a valid email" invalid label="Email"><Input /></Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input.props.accessibilityHint).toBe('Enter a valid email');
    expect(input.props.accessibilityState.disabled).toBe(false);
    expect(screen.getByText('Enter a valid email')).toBeTruthy();
  });

  it('exposes checkbox state and requests controlled changes', () => {
    const onCheckedChange = jest.fn();
    const screen = render(<Checkbox checked={false} label="Accept terms" onCheckedChange={onCheckedChange} />);
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
    const group = screen.getByLabelText('Plan');
    const starter = screen.getByRole('radio', { name: 'Starter plan' });
    const pro = screen.getByRole('radio', { name: 'Pro plan' });
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(starter.props.accessibilityState.checked).toBe(true);
    expect(pro.props.accessibilityState.checked).toBe(false);
    fireEvent.press(pro);
    expect(onValueChange).toHaveBeenCalledWith('pro');
  });

  it('coordinates tab selection and only mounts active content', () => {
    const onValueChange = jest.fn();
    const screen = render(
      <Tabs onValueChange={onValueChange} value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><Text>Overview content</Text></TabsContent>
        <TabsContent value="details"><Text>Details content</Text></TabsContent>
      </Tabs>,
    );
    const overview = screen.getByRole('tab', { name: 'Overview' });
    const details = screen.getByRole('tab', { name: 'Details' });
    expect(overview.props.accessibilityState.selected).toBe(true);
    expect(details.props.accessibilityState.selected).toBe(false);
    expect(screen.getByText('Overview content')).toBeTruthy();
    expect(screen.queryByText('Details content')).toBeNull();
    fireEvent.press(details);
    expect(onValueChange).toHaveBeenCalledWith('details');
  });

  it('clamps progress values for accessibility', () => {
    const screen = render(<Progress accessibilityLabel="Upload" max={100} value={140} />);
    const progress = screen.getByLabelText('Upload');
    expect(progress.props.accessibilityRole).toBe('progressbar');
    expect(progress.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 100 });
  });

  it('toggles uncontrolled Collapsible content and exposes expanded state', () => {
    const screen = render(
      <Collapsible>
        <CollapsibleTrigger>Advanced</CollapsibleTrigger>
        <CollapsibleContent><Text>Advanced content</Text></CollapsibleContent>
      </Collapsible>,
    );
    const trigger = screen.getByRole('button', { name: 'Advanced' });
    expect(trigger.props.accessibilityState.expanded).toBe(false);
    expect(screen.queryByText('Advanced content')).toBeNull();
    fireEvent.press(trigger);
    expect(screen.getByText('Advanced content')).toBeTruthy();
  });

  it('coordinates single Accordion state', () => {
    const screen = render(
      <Accordion defaultValue="account">
        <AccordionItem value="account">
          <AccordionTrigger>Account</AccordionTrigger>
          <AccordionContent><Text>Account content</Text></AccordionContent>
        </AccordionItem>
        <AccordionItem value="billing">
          <AccordionTrigger>Billing</AccordionTrigger>
          <AccordionContent><Text>Billing content</Text></AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    expect(screen.getByText('Account content')).toBeTruthy();
    expect(screen.queryByText('Billing content')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Billing' }));
    expect(screen.queryByText('Account content')).toBeNull();
    expect(screen.getByText('Billing content')).toBeTruthy();
  });

  it('forwards ListItem presses with inferred button labeling', () => {
    const onPress = jest.fn();
    const screen = render(<ListItem description="Account preferences" onPress={onPress} title="Settings" />);
    const item = screen.getByRole('button', { name: 'Settings' });
    fireEvent.press(item);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
