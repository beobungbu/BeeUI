import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { Table, TableBody, TableCell, TableRow } from '../../../packages/ui/src/components/table.web';

// #618 (Astra review, item 2), Web: `TableRow` used to wire `onClick: onPress` straight onto
// the `<tr>` with no exclusion, so a click that bubbled up from an embedded interactive
// descendant (a cell action `Button`, a selection `Checkbox`, a link) also activated the row.
// This file imports `table.web` directly (mirrors `table-web-structure-and-accessibility`) and
// fabricates minimal `closest`/`contains`-capable stand-ins for `event.target`/
// `event.currentTarget` — `@testing-library/react-native`'s `fireEvent` calls the handler with
// exactly the event object passed to it, it does not run a real DOM or simulate bubbling, so a
// production click/keydown here is proven by handing the handler the same shape a browser
// would give it.
type FakeNode = {
  tag: string;
  role?: string;
  href?: string;
  parent: FakeNode | null;
  closest(selector: string): FakeNode | null;
  contains(node: unknown): boolean;
};

function fakeNode(tag: string, options: { role?: string; href?: string } = {}, parent: FakeNode | null = null): FakeNode {
  const node: FakeNode = {
    tag,
    role: options.role,
    href: options.href,
    parent,
    closest(selector: string) {
      const clauses = selector.split(',').map((clause) => clause.trim());
      let current: FakeNode | null = node;
      while (current) {
        const matches = clauses.some((clause) => {
          if (clause === `${current!.tag}[href]`) return current!.href !== undefined;
          if (clause === current!.tag) return true;
          const roleMatch = /^\[role="([a-z]+)"\]$/.exec(clause);
          return roleMatch !== null && current!.role === roleMatch[1];
        });
        if (matches) return current;
        current = current.parent;
      }
      return null;
    },
    contains(candidate: unknown) {
      let current: FakeNode | null = candidate as FakeNode | null;
      while (current) {
        if (current === node) return true;
        current = current.parent;
      }
      return false;
    },
  };
  return node;
}

function renderPressableRow(onPress: () => void) {
  return render(
    <Table>
      <TableBody>
        <TableRow onPress={onPress}>
          <TableCell>Ada</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );
}

describe('TableRow onPress excludes embedded interactive descendants (Web)', () => {
  it('does not call onPress when the click target is a nested button', () => {
    const onPress = jest.fn();
    const screen = renderPressableRow(onPress);
    const row = screen.UNSAFE_getByType('tr');

    const rowNode = fakeNode('tr');
    const buttonNode = fakeNode('button', {}, rowNode);

    fireEvent(row, 'click', { currentTarget: rowNode, target: buttonNode });

    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not call onPress when the click target is a nested role="checkbox" element', () => {
    const onPress = jest.fn();
    const screen = renderPressableRow(onPress);
    const row = screen.UNSAFE_getByType('tr');

    const rowNode = fakeNode('tr');
    const checkboxNode = fakeNode('div', { role: 'checkbox' }, rowNode);

    fireEvent(row, 'click', { currentTarget: rowNode, target: checkboxNode });

    expect(onPress).not.toHaveBeenCalled();
  });

  it('calls onPress when the click target is a plain cell (no interactive ancestor)', () => {
    const onPress = jest.fn();
    const screen = renderPressableRow(onPress);
    const row = screen.UNSAFE_getByType('tr');

    const rowNode = fakeNode('tr');
    const cellNode = fakeNode('td', {}, rowNode);

    fireEvent(row, 'click', { currentTarget: rowNode, target: cellNode });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress on Enter when the keydown target is a nested button', () => {
    const onPress = jest.fn();
    const screen = renderPressableRow(onPress);
    const row = screen.UNSAFE_getByType('tr');

    const rowNode = fakeNode('tr');
    const buttonNode = fakeNode('button', {}, rowNode);

    fireEvent(row, 'keyDown', {
      key: 'Enter',
      preventDefault: jest.fn(),
      currentTarget: rowNode,
      target: buttonNode,
    });

    expect(onPress).not.toHaveBeenCalled();
  });

  it('still calls onPress on Enter when the keydown target is the row itself', () => {
    const onPress = jest.fn();
    const screen = renderPressableRow(onPress);
    const row = screen.UNSAFE_getByType('tr');

    const rowNode = fakeNode('tr');

    fireEvent(row, 'keyDown', {
      key: 'Enter',
      preventDefault: jest.fn(),
      currentTarget: rowNode,
      target: rowNode,
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
