import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Platform } from 'react-native';
import { Checkbox, FormGroup } from '@beemvp/beeui-ui';

// #571 (rc.2 verification, PARTIAL): a Switch inside a `Field` already gets
// its accessible name via `aria-labelledby`; a Checkbox *list* inside a
// `FormGroup`, however, got no `aria-labelledby`/`aria-describedby` to the
// legend or error, no `aria-invalid`, and no `group` ancestor at all — the
// group container carried none of its own semantics, unlike `RadioGroup`.
describe('BeeUI FormGroup exposes group semantics for a Checkbox list', () => {
  afterEach(() => {
    Platform.OS = 'ios';
  });

  it('labels the group container by its legend and reflects disabled, cross-platform', () => {
    const screen = render(
      <FormGroup disabled legend="Assign to stores" testID="stores-group">
        <Checkbox checked={false} label="Store A" onCheckedChange={() => {}} testID="store-a" />
        <Checkbox checked={false} label="Store B" onCheckedChange={() => {}} testID="store-b" />
      </FormGroup>,
    );

    const group = screen.getByTestId('stores-group');
    expect(group.props.role).toBe('group');
    expect(group.props.accessibilityLabelledBy).toMatch(/^beeui-form-group-.*-legend$/);
    expect(group.props.accessibilityState.disabled).toBe(true);
  });

  it('reflects required on the group container through each Checkbox aria-required', () => {
    const screen = render(
      <FormGroup legend="Assign to stores" required>
        <Checkbox checked={false} label="Store A" onCheckedChange={() => {}} testID="store-a" />
      </FormGroup>,
    );

    expect(screen.getByTestId('store-a').props['aria-required']).toBe(true);
  });

  it('exposes aria-labelledby/aria-describedby/aria-invalid literally on the DOM-facing group container on web', () => {
    Platform.OS = 'web';
    const screen = render(
      <FormGroup
        error="Select at least one store."
        invalid
        legend="Assign to stores"
        testID="stores-group"
      >
        <Checkbox checked={false} label="Store A" onCheckedChange={() => {}} testID="store-a" />
      </FormGroup>,
    );

    const group = screen.getByTestId('stores-group');
    expect(group.props['aria-labelledby']).toMatch(/^beeui-form-group-.*-legend$/);
    expect(group.props['aria-describedby']).toMatch(/^beeui-form-group-.*-legend-helper$/);
    expect(group.props['aria-invalid']).toBe(true);
    expect(screen.getByText('Select at least one store.').props.nativeID).toBe(
      group.props['aria-describedby'],
    );
  });

  it('omits aria-invalid and keeps aria-describedby unset when the group has no error/description', () => {
    Platform.OS = 'web';
    const screen = render(
      <FormGroup legend="Assign to stores" testID="stores-group">
        <Checkbox checked={false} label="Store A" onCheckedChange={() => {}} testID="store-a" />
      </FormGroup>,
    );

    const group = screen.getByTestId('stores-group');
    expect(group.props['aria-invalid']).toBeUndefined();
    expect(group.props['aria-describedby']).toBeUndefined();
  });
});
