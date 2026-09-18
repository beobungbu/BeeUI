import { Chip, ChipGroup } from '@beemvp/beeui-ui';
import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';

// Two small `Chip`/`ChipGroup` gaps found in the BeePOS feature phases:
//   1. `Chip`/`ChipGroup` always carried `button`/`checkbox`/`radio` roles, so
//      a read-only tag list (e.g. the stores a staff member belongs to) had
//      the wrong semantics. `interactive={false}` renders a plain, roleless
//      static tag instead.
//   2. `ChipGroup` single mode had no way to reach "none selected" again —
//      pressing the already-selected Chip did nothing. `allowDeselect`
//      clears the selection back to the group's own empty-string sentinel.

describe('Chip interactive={false}', () => {
  it('renders no interactive role and ignores presses when standalone', () => {
    const onPress = jest.fn();
    const screen = render(
      <Chip interactive={false} onPress={onPress} testID="tag">
        Downtown
      </Chip>,
    );

    const tag = screen.getByTestId('tag');
    expect(tag.props.accessibilityRole).toBeUndefined();
    fireEvent.press(tag);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('stays interactive (button/radio/checkbox) as a ChipGroup member even when interactive={false} is passed', () => {
    const screen = render(
      <ChipGroup>
        <Chip interactive={false} testID="chip" value="a">
          All
        </Chip>
      </ChipGroup>,
    );

    expect(screen.getByTestId('chip').props.accessibilityRole).toBe('radio');
  });

  it('defaults to interactive (button role) when the prop is omitted', () => {
    const screen = render(<Chip testID="chip">Tag</Chip>);

    expect(screen.getByTestId('chip').props.accessibilityRole).toBe('button');
  });
});

describe('ChipGroup allowDeselect', () => {
  it('clears the selection to the empty-string sentinel when the selected chip is pressed again', () => {
    const onValueChange = jest.fn();
    const screen = render(
      <ChipGroup allowDeselect onValueChange={onValueChange} value="active">
        <Chip testID="active-chip" value="active">
          Active
        </Chip>
        <Chip testID="archived-chip" value="archived">
          Archived
        </Chip>
      </ChipGroup>,
    );

    fireEvent.press(screen.getByTestId('active-chip'));
    expect(onValueChange).toHaveBeenCalledWith('');
  });

  it('keeps the existing selection on re-press when allowDeselect is not set', () => {
    const onValueChange = jest.fn();
    const screen = render(
      <ChipGroup onValueChange={onValueChange} value="active">
        <Chip testID="active-chip" value="active">
          Active
        </Chip>
      </ChipGroup>,
    );

    fireEvent.press(screen.getByTestId('active-chip'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('still allows switching directly to a different chip when allowDeselect is set', () => {
    const onValueChange = jest.fn();
    const screen = render(
      <ChipGroup allowDeselect onValueChange={onValueChange} value="active">
        <Chip testID="active-chip" value="active">
          Active
        </Chip>
        <Chip testID="archived-chip" value="archived">
          Archived
        </Chip>
      </ChipGroup>,
    );

    fireEvent.press(screen.getByTestId('archived-chip'));
    expect(onValueChange).toHaveBeenCalledWith('archived');
  });
});
