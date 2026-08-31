import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Button, ListGroup, ListGroupHeader, ListItem, Progress, SettingsItem, Spinner } from '@beemvp/beeui-ui';

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

    it('stays semantically neutral (no listitem role) when rendered outside a ListGroup wrapper (load-bearing: fails if an orphan listitem role reappears)', () => {
      // WAI-ARIA Required Context Role (5.2.7): `listitem` is only meaningful when owned
      // by a `list`. A standalone ListItem has no such owner, so it must not claim
      // `listitem` semantics. An earlier fix regressed this by giving every non-interactive
      // ListItem `role="listitem"` unconditionally, including outside any ListGroup.
      const screen = render(<ListItem testID="row" title="Engine" />);
      expect(screen.getByTestId('row').props.role).toBeUndefined();
    });

    it('gains the listitem role only once owned by a ListGroup wrapper (load-bearing: fails if ownership scoping is dropped)', () => {
      const screen = render(
        <ListGroup>
          <ListItem testID="row" title="Engine" />
        </ListGroup>,
      );
      expect(screen.getByTestId('row').props.role).toBe('listitem');
    });

    it('renders a standalone interactive ListItem as a plain button with no orphan listitem wrapper (load-bearing: fails if an outside-list wrapper reappears)', () => {
      const onPress = jest.fn();
      const screen = render(<ListItem onPress={onPress} testID="row" title="Appearance" />);

      // Still reachable and operable as a button...
      const button = screen.getByRole('button', { name: 'Appearance' });
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.testID).toBe('row');

      // ...and, critically, with no `listitem`-role ancestor anywhere in the tree, since
      // there is no `ListGroup` `list` container for it to be owned by.
      expect(screen.UNSAFE_queryAllByProps({ role: 'listitem' })).toHaveLength(0);
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

  describe('Button loading/busy semantics', () => {
    it('exposes busy state on the Button itself via aria-busy, not the compound accessibilityState object (load-bearing: fails if busy moves back into accessibilityState)', () => {
      const screen = render(<Button loading>Loading action</Button>);

      // The button itself keeps its own accessible name...
      expect(screen.getByRole('button', { name: 'Loading action' })).toBeTruthy();

      // ...and exposes busy state via the individual `aria-busy` prop passed straight to
      // the underlying Pressable — verified against react-native-web 0.21's source:
      // `createDOMProps`/the Pressable-forwarded-prop allowlist only ever read `aria-busy`
      // (or the deprecated `accessibilityBusy`) directly off props, never the compound
      // `accessibilityState` object, so `accessibilityState.busy` alone would never reach
      // the DOM as `aria-busy` on Web. (React Native's own native Pressable additionally
      // normalizes this same `aria-busy` prop into `accessibilityState.busy` for native
      // platforms, which is why it no longer needs to be set inside the compound object here.)
      expect(screen.UNSAFE_getByProps({ 'aria-busy': true })).toBeTruthy();
    });

    it('does not report busy when not loading (load-bearing: fails if aria-busy is left set unconditionally)', () => {
      const screen = render(<Button>Save</Button>);
      expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
      expect(screen.UNSAFE_queryAllByProps({ 'aria-busy': true })).toHaveLength(0);
    });

    it('hides the purely decorative loading spinner from assistive tech instead of giving it a redundant accessible name (load-bearing: fails if the spinner regains its own announced name)', () => {
      const screen = render(<Button loading>Loading action</Button>);

      // react-native-web's ActivityIndicator always renders `role="progressbar"`
      // unconditionally and it cannot be suppressed by the caller, but the Button already
      // carries the loading semantics via `aria-busy` above, so the indicator itself must
      // be excluded from the accessibility tree rather than independently nameable.
      const indicator = screen.UNSAFE_getByProps({ 'aria-hidden': true });
      expect(indicator).toBeTruthy();
      expect(indicator.props.accessibilityLabel).toBeUndefined();
    });
  });
});
