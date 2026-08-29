import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Button, ListGroup, ListGroupHeader, ListItem, Progress, SettingsItem, Spinner } from '@beeui/ui';

describe('BeeUI #276 structural/status semantics (ListGroup list/listitem + Progress accessible name)', () => {
  describe('ListGroup / ListItem list-listitem contract', () => {
    it('exposes non-interactive ListItem rows as listitem children of the list container', () => {
      const screen = render(
        <ListGroup testID="list-group">
          <ListGroupHeader title="Workspace" />
          <ListItem description="Canonical browser" testID="row" title="Engine" />
        </ListGroup>,
      );

      expect(screen.getByTestId('list-group').props.accessibilityRole).toBe('list');
      expect(screen.getByTestId('row').props.role).toBe('listitem');
      expect(screen.getByRole('listitem', { name: 'Engine, Canonical browser' })).toBeTruthy();
    });

    it('carries the listitem role even when rendered outside a ListGroup wrapper (load-bearing: fails if the role is dropped)', () => {
      // Pre-fix, a non-interactive ListItem rendered with no role at all, so it
      // could never satisfy ListGroup's `role="list"` -> `role="listitem"`
      // required-owned-children contract (WAI-ARIA `list.requiredOwned`).
      const screen = render(<ListItem testID="row" title="Engine" />);
      expect(screen.getByTestId('row').props.role).toBe('listitem');
    });

    it('wraps an interactive ListItem in a listitem element while preserving its button role', () => {
      const onPress = jest.fn();
      const screen = render(
        <ListGroup testID="list-group">
          <ListGroupHeader title="Settings" />
          <ListItem onPress={onPress} title="Appearance" />
        </ListGroup>,
      );

      // The interactive row must still be reachable and operable as a button...
      const button = screen.getByRole('button', { name: 'Appearance' });
      expect(button.props.accessibilityRole).toBe('button');

      // ...while a `listitem`-role ancestor wraps it to satisfy the list's required
      // owned-role contract (aria-required-children: list -> listitem). It's
      // intentionally NOT `accessible={true}` — an atomic wrapper would collapse
      // the inner button into a single combined VoiceOver/TalkBack stop and hide
      // its `button` trait, so this is read via its raw props rather than
      // `getByRole` (which requires `accessible={true}` to enumerate a node).
      const listItemWrapper = screen.UNSAFE_getByProps({ role: 'listitem' });
      expect(listItemWrapper).toBeTruthy();
      expect(listItemWrapper.props.accessible).not.toBe(true);
    });

    it('wraps an interactive SettingsItem row the same way as ListItem', () => {
      const onPress = jest.fn();
      const screen = render(
        <ListGroup>
          <SettingsItem onPress={onPress} title="Push notifications" value="On" />
        </ListGroup>,
      );

      expect(screen.getByRole('button', { name: 'Push notifications, On' })).toBeTruthy();
      expect(screen.UNSAFE_getByProps({ role: 'listitem' })).toBeTruthy();
    });

    it('gives every row in a fully populated ListGroup a listitem-role ancestor (load-bearing: fails if the wrapper is removed)', () => {
      const onPress = jest.fn();
      const screen = render(
        <ListGroup testID="list-group">
          <ListGroupHeader description="Workspace preferences" title="Settings" />
          <ListItem description="Build status" testID="static-row" title="BeeUI" trailing="Passing" />
          <ListItem onPress={onPress} testID="interactive-row" title="Appearance" />
        </ListGroup>,
      );

      // The non-interactive row is the listitem itself...
      expect(screen.getByTestId('static-row').props.role).toBe('listitem');
      // ...and the interactive row's button is wrapped by a listitem ancestor.
      const interactiveRow = screen.getByTestId('interactive-row');
      const wrappers = screen.UNSAFE_getAllByProps({ role: 'listitem' });
      expect(wrappers.some((wrapper) => wrapper !== interactiveRow)).toBe(true);
    });
  });

  describe('Progress accessible-name mechanism', () => {
    it('falls back to a generic, non-brand accessible name when the caller supplies none', () => {
      const screen = render(<Progress testID="progress" value={42} />);
      const progress = screen.getByTestId('progress');

      expect(progress.props.accessibilityRole).toBe('progressbar');
      expect(progress.props.accessibilityLabel).toBeTruthy();
      expect(progress.props.accessibilityLabel).not.toMatch(/BeeUI/i);
    });

    it('preserves a caller-supplied accessible name over the default', () => {
      const screen = render(<Progress accessibilityLabel="Profile completion" value={72} />);
      expect(screen.getByLabelText('Profile completion')).toBeTruthy();
    });

    it('does not apply the default label when the caller supplies accessibilityLabelledBy', () => {
      const screen = render(<Progress accessibilityLabelledBy="external-label" testID="progress" value={30} />);
      const progress = screen.getByTestId('progress');

      expect(progress.props.accessibilityLabelledBy).toBe('external-label');
      expect(progress.props.accessibilityLabel).toBeUndefined();
    });
  });

  describe('Spinner accessible-name mechanism', () => {
    it('falls back to a generic, non-brand accessible name when the caller supplies none', () => {
      const screen = render(<Spinner testID="spinner" />);
      const spinner = screen.getByTestId('spinner');

      expect(spinner.props.accessibilityLabel).toBeTruthy();
      expect(spinner.props.accessibilityLabel).not.toMatch(/BeeUI/i);
    });

    it('preserves a caller-supplied accessible name over the default', () => {
      const screen = render(<Spinner accessibilityLabel="Refreshing feed" testID="spinner" />);
      expect(screen.getByTestId('spinner').props.accessibilityLabel).toBe('Refreshing feed');
    });
  });

  describe("Button's inline loading indicator accessible name", () => {
    it('gives the busy-state indicator a non-empty, non-brand accessible name', () => {
      const screen = render(<Button loading>Loading action</Button>);

      // The button itself keeps its own accessible name and busy state...
      const button = screen.getByRole('button', { name: 'Loading action' });
      expect(button.props.accessibilityState.busy).toBe(true);

      // ...and its nested progressbar-role indicator (react-native-web's
      // ActivityIndicator always renders `role="progressbar"` on web, unconditionally)
      // is independently nameable rather than being left with an empty accessible name.
      const indicator = screen.getByLabelText('Loading');
      expect(indicator.props.accessibilityLabel).toBe('Loading');
      expect(indicator.props.accessibilityLabel).not.toMatch(/BeeUI/i);
    });
  });
});
