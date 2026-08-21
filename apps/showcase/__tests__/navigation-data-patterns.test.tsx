import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  HStack,
  Stack,
  Timeline,
  TimelineItem,
  VStack,
} from '@beeui/ui';

describe('BeeUI navigation and data pattern contracts', () => {
  it('renders Stack aliases without owning application state', () => {
    const screen = render(
      <Stack testID="stack">
        <HStack testID="hstack" />
        <VStack testID="vstack" />
      </Stack>,
    );

    expect(screen.getByTestId('stack')).toBeTruthy();
    expect(screen.getByTestId('hstack')).toBeTruthy();
    expect(screen.getByTestId('vstack')).toBeTruthy();
  });

  it('exposes breadcrumb links while keeping the current item non-interactive', () => {
    const onPress = jest.fn();
    const screen = render(
      <Breadcrumb>
        <BreadcrumbItem onPress={onPress}>Home</BreadcrumbItem>
        <BreadcrumbItem current testID="current-crumb">Project</BreadcrumbItem>
      </Breadcrumb>,
    );

    fireEvent.press(screen.getByRole('link', { name: 'Home' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('current-crumb').props.accessibilityState.selected).toBe(true);
  });

  it('preserves disabled breadcrumb accessibility state and blocks activation', () => {
    const onPress = jest.fn();
    const screen = render(
      <Breadcrumb>
        <BreadcrumbItem disabled onPress={onPress} testID="disabled-crumb">
          Disabled
        </BreadcrumbItem>
      </Breadcrumb>,
    );

    const item = screen.getByTestId('disabled-crumb');
    expect(item.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(item);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders timeline content as read-only information', () => {
    const screen = render(
      <Timeline testID="timeline">
        <TimelineItem description="Workspace created" meta="09:00" status="success" title="Created" />
        <TimelineItem description="Profile reviewed" meta="10:30" status="primary" title="Reviewed" />
      </Timeline>,
    );

    expect(screen.getByTestId('timeline')).toBeTruthy();
    expect(screen.getByText('Workspace created')).toBeTruthy();
    expect(screen.getByText('Profile reviewed')).toBeTruthy();
    expect(screen.getByText('10:30')).toBeTruthy();
  });
});
