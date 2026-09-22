import * as React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@beemvp/beeui-ui';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

// `expanded` is one of React Native's compound `AccessibilityState` keys, so
// `Pressable` normalizes an `accessibilityState.expanded` value before it reaches
// a host node and strips the raw `aria-expanded` prop along the way (same
// normalization already documented for `aria-checked`/`aria-selected` in
// selection-control-aria.test.tsx). Asserting the literal prop a disclosure
// trigger hands to `Pressable` therefore needs raw `react-test-renderer`, not
// `@testing-library/react-native`'s host-only query helpers.
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

function findPressable(renderer: ReactTestRenderer): ReactTestInstance {
  const matches = renderer.root.findAll(isPressableInstance);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one Pressable, found ${matches.length}`);
  }
  return matches[0];
}

describe('BeeUI Accordion/Collapsible aria-expanded', () => {
  it('exposes aria-expanded="true" on an initially open AccordionTrigger', () => {
    const renderer = renderComposite(
      <Accordion value="order-summary">
        <AccordionItem value="order-summary">
          <AccordionTrigger>Order summary</AccordionTrigger>
          <AccordionContent />
        </AccordionItem>
      </Accordion>,
    );

    expect(findPressable(renderer).props['aria-expanded']).toBe(true);
  });

  it('flips aria-expanded to false after closing an AccordionTrigger', () => {
    const renderer = renderComposite(
      <Accordion defaultValue="order-summary">
        <AccordionItem value="order-summary">
          <AccordionTrigger>Order summary</AccordionTrigger>
        </AccordionItem>
      </Accordion>,
    );

    act(() => {
      findPressable(renderer).props.onPress({});
    });

    expect(findPressable(renderer).props['aria-expanded']).toBe(false);
  });

  it('exposes aria-expanded="false" on an initially closed CollapsibleTrigger', () => {
    const renderer = renderComposite(
      <Collapsible>
        <CollapsibleTrigger>Order lines</CollapsibleTrigger>
        <CollapsibleContent />
      </Collapsible>,
    );

    expect(findPressable(renderer).props['aria-expanded']).toBe(false);
  });

  it('flips aria-expanded to true after opening a CollapsibleTrigger', () => {
    const renderer = renderComposite(
      <Collapsible>
        <CollapsibleTrigger>Order lines</CollapsibleTrigger>
      </Collapsible>,
    );

    act(() => {
      findPressable(renderer).props.onPress({});
    });

    expect(findPressable(renderer).props['aria-expanded']).toBe(true);
  });
});
