import * as React from 'react';

export type WindowOrderMeasurableNode = {
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

export type WindowOrderItem = {
  id: string;
  node: () => WindowOrderMeasurableNode | null;
};

type WindowPositions = Record<string, number>;

function samePositions(
  current: WindowPositions,
  next: WindowPositions,
  itemIds: readonly string[],
) {
  if (Object.keys(current).length !== Object.keys(next).length) return false;
  return itemIds.every((id) => current[id] === next[id]);
}

/**
 * Orders a small interactive collection by its committed host geometry instead
 * of assigning sequence numbers while React is rendering. Every item already
 * exposes a native/Web host ref for focus, so `measureInWindow` gives one
 * coordinate space even when items are nested in groups.
 *
 * The measurement is refreshed after every committed render. That matters for
 * keyed reorders: React can move existing children without unmounting them, so
 * registration/insertion order is no longer evidence of visual order. A
 * generation guard drops callbacks from an older committed tree. Missing or
 * equal measurements fall back to the registry's stable order until the next
 * measurement lands.
 */
export function useWindowOrderedItems<T extends WindowOrderItem>(items: readonly T[]) {
  const [positions, setPositions] = React.useState<WindowPositions>({});
  const generationRef = React.useRef(0);

  const remeasureOrder = React.useCallback(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const itemIds = items.map((item) => item.id);

    if (items.length === 0) {
      setPositions((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }

    const next: WindowPositions = {};
    let remaining = items.length;

    const completeOne = () => {
      remaining -= 1;
      if (remaining !== 0 || generationRef.current !== generation) return;
      setPositions((current) => (samePositions(current, next, itemIds) ? current : next));
    };

    for (const item of items) {
      const node = item.node();
      if (!node || typeof node.measureInWindow !== 'function') {
        completeOne();
        continue;
      }

      node.measureInWindow((_x, y) => {
        if (generationRef.current !== generation) return;
        if (Number.isFinite(y)) next[item.id] = y;
        completeOne();
      });
    }
  }, [items]);

  // No dependency list on purpose: a keyed reorder can preserve the registry
  // array identity/content while changing only where those existing hosts sit
  // in the committed tree. Re-measure every commit; `samePositions` prevents a
  // settled measurement from causing another render.
  React.useEffect(() => {
    remeasureOrder();
  });

  React.useEffect(
    () => () => {
      generationRef.current += 1;
    },
    [],
  );

  const orderedItems = React.useMemo(() => {
    const registryIndex = new Map(items.map((item, index) => [item.id, index]));
    return [...items].sort((left, right) => {
      const leftY = positions[left.id];
      const rightY = positions[right.id];
      if (leftY !== undefined && rightY !== undefined && leftY !== rightY) {
        return leftY - rightY;
      }
      return (registryIndex.get(left.id) ?? 0) - (registryIndex.get(right.id) ?? 0);
    });
  }, [items, positions]);

  return { orderedItems, remeasureOrder };
}
