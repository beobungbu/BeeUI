import { Pagination, PaginationItem, Stepper, StepperItem, Tabs, TabsTrigger } from '@beemvp/beeui-ui';
import * as React from 'react';
import { Platform } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

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

describe('BeeUI navigation Web current/selected semantics (#553)', () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  });

  it('passes controlled tab selection through aria-selected', () => {
    const renderer = renderComposite(
      <Tabs value="catalog" onValueChange={() => {}}>
        <TabsTrigger value="catalog">Catalog</TabsTrigger>
        <TabsTrigger value="checkout">Checkout</TabsTrigger>
      </Tabs>,
    );
    const [catalog, checkout] = findAllPressables(renderer);

    expect(catalog.props.accessibilityState.selected).toBe(true);
    expect(catalog.props['aria-selected']).toBe(true);
    expect(checkout.props['aria-selected']).toBe(false);
  });

  it('marks exactly the current pagination page with aria-current="page" on Web', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const renderer = renderComposite(
      <Pagination page={2} pageCount={3} onPageChange={() => {}}>
        <PaginationItem page={1} />
        <PaginationItem page={2} />
        <PaginationItem page={3} />
      </Pagination>,
    );
    const [page1, page2, page3] = findAllPressables(renderer);

    expect(page1.props['aria-current']).toBeUndefined();
    expect(page2.props['aria-current']).toBe('page');
    expect(page3.props['aria-current']).toBeUndefined();
    expect(page2.props.accessibilityState.selected).toBe(true);
  });

  it('marks exactly the current step with aria-current="step" on Web', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const renderer = renderComposite(
      <Stepper currentStep={2} onStepChange={() => {}}>
        <StepperItem step={1} title="Cart" />
        <StepperItem step={2} title="Delivery" />
        <StepperItem step={3} title="Review" />
      </Stepper>,
    );
    const [cart, delivery, review] = findAllPressables(renderer);

    expect(cart.props['aria-current']).toBeUndefined();
    expect(delivery.props['aria-current']).toBe('step');
    expect(review.props['aria-current']).toBeUndefined();
    expect(delivery.props.accessibilityState.selected).toBe(true);
  });
});
