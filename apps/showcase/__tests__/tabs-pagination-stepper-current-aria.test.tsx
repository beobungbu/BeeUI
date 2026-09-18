import { render } from '@testing-library/react-native';
import * as React from 'react';
import {
  Pagination,
  PaginationItem,
  Stepper,
  StepperItem,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@beemvp/beeui-ui';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

// React Native's own `Pressable` normalizes `aria-selected` into
// `accessibilityState.selected` before it ever reaches a host node (`selected` is
// one of the compound `AccessibilityState` keys — same normalization already
// documented for `aria-checked` in selection-control-aria.test.tsx), and
// `@testing-library/react-native`'s query helpers only resolve *host* elements,
// which filters `Pressable` itself (and therefore the raw prop) out of the tree.
// Asserting the literal `aria-selected` prop TabsTrigger hands to `Pressable`
// therefore needs raw `react-test-renderer`, matching that file's convention —
// this is the actual contract boundary react-native-web's own, differently
// implemented `Pressable` reads to build the DOM `aria-selected` attribute.
function isPressableInstance(node: ReactTestInstance): boolean {
  if (typeof node.type === 'string') return false;
  const type = node.type as { displayName?: string; name?: string };
  return (type.displayName ?? type.name) === 'Pressable';
}

function renderComposite(element: React.ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function findAllPressables(renderer: ReactTestRenderer): ReactTestInstance[] {
  return renderer.root.findAll(isPressableInstance);
}

describe('BeeUI Tabs Web aria-selected', () => {
  it('exposes aria-selected on the active and inactive TabsTrigger', () => {
    const renderer = renderComposite(
      <Tabs onValueChange={() => {}} value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const [overview, details] = findAllPressables(renderer);

    expect(overview.props['aria-selected']).toBe(true);
    expect(details.props['aria-selected']).toBe(false);
  });

  it('updates aria-selected after a controlled value change', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <Tabs onValueChange={() => {}} value="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
        </Tabs>,
      );
    });

    act(() => {
      renderer.update(
        <Tabs onValueChange={() => {}} value="details">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
        </Tabs>,
      );
    });

    const [overview, details] = findAllPressables(renderer);
    expect(overview.props['aria-selected']).toBe(false);
    expect(details.props['aria-selected']).toBe(true);
  });
});

// `aria-current` is not one of React Native's compound `AccessibilityState` keys,
// so it is not normalized away — Pagination/Stepper's rendered host node keeps it
// intact for a direct `@testing-library/react-native` query.
describe('BeeUI Pagination/Stepper Web aria-current', () => {
  it('exposes aria-current="page" only on the current PaginationItem', () => {
    const screen = render(
      <Pagination onPageChange={() => {}} page={1} pageCount={2}>
        <PaginationItem page={1} testID="page-1" />
        <PaginationItem page={2} testID="page-2" />
      </Pagination>,
    );

    expect(screen.getByTestId('page-1').props['aria-current']).toBe('page');
    expect(screen.getByTestId('page-2').props['aria-current']).toBeUndefined();
  });

  it('moves aria-current="page" after a page change', () => {
    function ControlledPagination({ page }: { page: number }) {
      return (
        <Pagination onPageChange={() => {}} page={page} pageCount={2}>
          <PaginationItem page={1} testID="page-1" />
          <PaginationItem page={2} testID="page-2" />
        </Pagination>
      );
    }

    const screen = render(<ControlledPagination page={1} />);
    screen.rerender(<ControlledPagination page={2} />);

    expect(screen.getByTestId('page-1').props['aria-current']).toBeUndefined();
    expect(screen.getByTestId('page-2').props['aria-current']).toBe('page');
  });

  it('exposes aria-current="step" only on the current StepperItem', () => {
    const screen = render(
      <Stepper currentStep={1}>
        <StepperItem step={1} testID="step-1" title="Foundation" />
        <StepperItem step={2} testID="step-2" title="Application" />
      </Stepper>,
    );

    expect(screen.getByTestId('step-1').props['aria-current']).toBe('step');
    expect(screen.getByTestId('step-2').props['aria-current']).toBeUndefined();
  });
});
