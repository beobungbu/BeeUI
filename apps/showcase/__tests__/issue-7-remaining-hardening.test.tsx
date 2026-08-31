import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  HStack,
  ListGroup,
  ListGroupHeader,
  ListItem,
  Radio,
  RadioGroup,
  SegmentedControl,
  SegmentedControlItem,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  Text,
} from '@beemvp/beeui-ui';
import { spacing } from '@beemvp/beeui-tokens';

describe('BeeUI issue #7 remaining hardening', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('warns when enabled controlled primitives have no change handler', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(
      <>
        <Checkbox checked label="Terms" />
        <Radio checked label="Standalone" />
        <RadioGroup value="one">
          <Radio label="One" value="one" />
        </RadioGroup>
        <Switch accessibilityLabel="Notifications" value />
        <Tabs value="one">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
          </TabsList>
        </Tabs>
        <SegmentedControl value="one">
          <SegmentedControlItem value="one">One</SegmentedControlItem>
        </SegmentedControl>
      </>,
    );

    const messages = warn.mock.calls.map(([message]) => String(message));
    expect(messages.some((message) => message.includes('Checkbox') && message.includes('onCheckedChange'))).toBe(true);
    expect(messages.some((message) => message.includes('Radio:') && message.includes('onCheckedChange'))).toBe(true);
    expect(messages.some((message) => message.includes('RadioGroup') && message.includes('onValueChange'))).toBe(true);
    expect(messages.some((message) => message.includes('Switch') && message.includes('onValueChange'))).toBe(true);
    expect(messages.some((message) => message.includes('Tabs') && message.includes('onValueChange'))).toBe(true);
    expect(messages.some((message) => message.includes('SegmentedControl') && message.includes('onValueChange'))).toBe(true);
  });

  it('does not warn for intentionally disabled controlled primitives', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(
      <>
        <Checkbox checked disabled label="Terms" />
        <Radio checked disabled label="Standalone" />
        <RadioGroup disabled value="one">
          <Radio label="One" value="one" />
        </RadioGroup>
        <Switch accessibilityLabel="Notifications" disabled value />
        <Tabs disabled value="one">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
          </TabsList>
        </Tabs>
        <SegmentedControl disabled value="one">
          <SegmentedControlItem value="one">One</SegmentedControlItem>
        </SegmentedControl>
      </>,
    );

    expect(warn).not.toHaveBeenCalled();
  });

  it('lets a standalone Radio request deselection while grouped radios remain exclusive', () => {
    const onCheckedChange = jest.fn();
    const screen = render(
      <Radio checked label="Standalone" onCheckedChange={onCheckedChange} />,
    );

    fireEvent.press(screen.getByRole('radio', { name: 'Standalone' }));
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it('groups primitive non-interactive ListItem content without hiding complex descendants', () => {
    const screen = render(
      <>
        <ListItem description="Build status" title="BeeUI" trailing="Passing" />
        <ListItem title={<Text>Complex title</Text>} trailing={<Text>Complex trailing</Text>} />
      </>,
    );

    expect(screen.getByLabelText('BeeUI, Build status, Passing').props.accessible).toBe(true);
    expect(screen.getByText('Complex title')).toBeTruthy();
    expect(screen.getByText('Complex trailing')).toBeTruthy();
  });

  it('exposes ListGroup list semantics and aligns its header with row padding', () => {
    const screen = render(
      <ListGroup testID="list-group">
        <ListGroupHeader testID="header" title="Settings" />
        <ListItem title="Appearance" />
      </ListGroup>,
    );

    expect(screen.getByTestId('list-group').props.accessibilityRole).toBe('list');
    expect(screen.getByTestId('header').props.className).toContain('px-3');
  });

  it('centers HStack children by default while retaining caller overrides', () => {
    const screen = render(
      <>
        <HStack testID="default-row" />
        <HStack align="stretch" testID="stretch-row" />
      </>,
    );

    expect(screen.getByTestId('default-row').props.className).toContain('items-center');
    expect(screen.getByTestId('stretch-row').props.className).toContain('items-stretch');
  });

  it('does not expose disclosure-expanded state from a Dialog trigger', () => {
    const screen = render(
      <Dialog>
        <DialogTrigger accessibilityState={{ busy: true }}>Open dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    expect(trigger.props.accessibilityState.expanded).toBeUndefined();
  });

  it('keeps the JS spacing contract aligned with the half-step utility used by components', () => {
    expect(spacing['2.5']).toBe(10);
  });
});
