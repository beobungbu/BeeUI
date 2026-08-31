export type AnchoredOverlayPlacement = 'top' | 'right' | 'bottom' | 'left';
export type AnchoredOverlayAlign = 'start' | 'center' | 'end';
export type AnchoredOverlayDirection = 'ltr' | 'rtl';

export type AnchoredOverlayRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AnchoredOverlaySize = {
  width: number;
  height: number;
};

export type AnchoredOverlayInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type AnchoredOverlayCollisionPadding = number | Partial<AnchoredOverlayInsets>;

export type AnchoredOverlayOverflow = AnchoredOverlayInsets & {
  total: number;
};

export type AnchoredOverlayAvailableSpace = AnchoredOverlayInsets;

export type ResolveAnchoredOverlayPositionOptions = {
  anchorRect: AnchoredOverlayRect;
  overlaySize: AnchoredOverlaySize;
  viewportRect: AnchoredOverlayRect;
  placement?: AnchoredOverlayPlacement;
  align?: AnchoredOverlayAlign;
  direction?: AnchoredOverlayDirection;
  sideOffset?: number;
  alignOffset?: number;
  collisionPadding?: AnchoredOverlayCollisionPadding;
  flip?: boolean;
  shift?: boolean;
};

export type AnchoredOverlayPosition = {
  x: number;
  y: number;
  placement: AnchoredOverlayPlacement;
  align: AnchoredOverlayAlign;
  flipped: boolean;
  shifted: boolean;
  placementOverflow: AnchoredOverlayOverflow;
  overflow: AnchoredOverlayOverflow;
  availableSpace: AnchoredOverlayAvailableSpace;
};

type Bounds = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type Point = {
  x: number;
  y: number;
};

function finite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function nonNegative(value: number) {
  return Math.max(0, finite(value));
}

function normalizeRect(rect: AnchoredOverlayRect): AnchoredOverlayRect {
  return {
    x: finite(rect.x),
    y: finite(rect.y),
    width: nonNegative(rect.width),
    height: nonNegative(rect.height),
  };
}

function normalizeSize(size: AnchoredOverlaySize): AnchoredOverlaySize {
  return {
    width: nonNegative(size.width),
    height: nonNegative(size.height),
  };
}

function normalizePadding(
  padding: AnchoredOverlayCollisionPadding | undefined,
): AnchoredOverlayInsets {
  if (typeof padding === 'number') {
    const value = nonNegative(padding);
    return { top: value, right: value, bottom: value, left: value };
  }

  return {
    top: nonNegative(padding?.top ?? 0),
    right: nonNegative(padding?.right ?? 0),
    bottom: nonNegative(padding?.bottom ?? 0),
    left: nonNegative(padding?.left ?? 0),
  };
}

function createBounds(viewport: AnchoredOverlayRect, padding: AnchoredOverlayInsets): Bounds {
  const rawLeft = viewport.x + padding.left;
  const rawRight = viewport.x + viewport.width - padding.right;
  const rawTop = viewport.y + padding.top;
  const rawBottom = viewport.y + viewport.height - padding.bottom;

  const horizontalMidpoint = (rawLeft + rawRight) / 2;
  const verticalMidpoint = (rawTop + rawBottom) / 2;

  return {
    left: rawLeft <= rawRight ? rawLeft : horizontalMidpoint,
    right: rawLeft <= rawRight ? rawRight : horizontalMidpoint,
    top: rawTop <= rawBottom ? rawTop : verticalMidpoint,
    bottom: rawTop <= rawBottom ? rawBottom : verticalMidpoint,
  };
}

function oppositePlacement(placement: AnchoredOverlayPlacement): AnchoredOverlayPlacement {
  switch (placement) {
    case 'top':
      return 'bottom';
    case 'right':
      return 'left';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
  }
}

function alignedCoordinate(
  anchorStart: number,
  anchorSize: number,
  overlaySize: number,
  align: AnchoredOverlayAlign,
  alignOffset: number,
  reverseStartEnd: boolean,
) {
  const resolvedAlign =
    reverseStartEnd && align !== 'center'
      ? align === 'start'
        ? 'end'
        : 'start'
      : align;

  if (resolvedAlign === 'start') return anchorStart + alignOffset;
  if (resolvedAlign === 'end') return anchorStart + anchorSize - overlaySize + alignOffset;
  return anchorStart + (anchorSize - overlaySize) / 2 + alignOffset;
}

function candidatePoint(
  anchor: AnchoredOverlayRect,
  overlay: AnchoredOverlaySize,
  placement: AnchoredOverlayPlacement,
  align: AnchoredOverlayAlign,
  direction: AnchoredOverlayDirection,
  sideOffset: number,
  alignOffset: number,
): Point {
  if (placement === 'top' || placement === 'bottom') {
    return {
      x: alignedCoordinate(
        anchor.x,
        anchor.width,
        overlay.width,
        align,
        alignOffset,
        direction === 'rtl',
      ),
      y:
        placement === 'top'
          ? anchor.y - overlay.height - sideOffset
          : anchor.y + anchor.height + sideOffset,
    };
  }

  return {
    x:
      placement === 'left'
        ? anchor.x - overlay.width - sideOffset
        : anchor.x + anchor.width + sideOffset,
    y: alignedCoordinate(anchor.y, anchor.height, overlay.height, align, alignOffset, false),
  };
}

function getOverflow(point: Point, overlay: AnchoredOverlaySize, bounds: Bounds): AnchoredOverlayOverflow {
  const top = Math.max(0, bounds.top - point.y);
  const right = Math.max(0, point.x + overlay.width - bounds.right);
  const bottom = Math.max(0, point.y + overlay.height - bounds.bottom);
  const left = Math.max(0, bounds.left - point.x);

  return {
    top,
    right,
    bottom,
    left,
    total: top + right + bottom + left,
  };
}

function clampAxis(value: number, size: number, min: number, max: number) {
  const span = Math.max(0, max - min);
  if (size >= span) return min;
  return Math.min(Math.max(value, min), max - size);
}

function shiftPoint(point: Point, overlay: AnchoredOverlaySize, bounds: Bounds): Point {
  return {
    x: clampAxis(point.x, overlay.width, bounds.left, bounds.right),
    y: clampAxis(point.y, overlay.height, bounds.top, bounds.bottom),
  };
}

function availableSpace(
  anchor: AnchoredOverlayRect,
  bounds: Bounds,
  sideOffset: number,
): AnchoredOverlayAvailableSpace {
  return {
    top: Math.max(0, anchor.y - sideOffset - bounds.top),
    right: Math.max(0, bounds.right - (anchor.x + anchor.width + sideOffset)),
    bottom: Math.max(0, bounds.bottom - (anchor.y + anchor.height + sideOffset)),
    left: Math.max(0, anchor.x - sideOffset - bounds.left),
  };
}

export function resolveAnchoredOverlayPosition(
  options: ResolveAnchoredOverlayPositionOptions,
): AnchoredOverlayPosition {
  const anchor = normalizeRect(options.anchorRect);
  const overlay = normalizeSize(options.overlaySize);
  const viewport = normalizeRect(options.viewportRect);
  const placement = options.placement ?? 'bottom';
  const align = options.align ?? 'center';
  const direction = options.direction ?? 'ltr';
  const sideOffset = finite(options.sideOffset ?? 0);
  const alignOffset = finite(options.alignOffset ?? 0);
  const padding = normalizePadding(options.collisionPadding);
  const bounds = createBounds(viewport, padding);

  const preferredPoint = candidatePoint(
    anchor,
    overlay,
    placement,
    align,
    direction,
    sideOffset,
    alignOffset,
  );
  const preferredOverflow = getOverflow(preferredPoint, overlay, bounds);

  let resolvedPlacement = placement;
  let resolvedPoint = preferredPoint;
  let placementOverflow = preferredOverflow;
  let flipped = false;

  if ((options.flip ?? true) && preferredOverflow.total > 0) {
    const opposite = oppositePlacement(placement);
    const oppositePoint = candidatePoint(
      anchor,
      overlay,
      opposite,
      align,
      direction,
      sideOffset,
      alignOffset,
    );
    const oppositeOverflow = getOverflow(oppositePoint, overlay, bounds);

    if (oppositeOverflow.total < preferredOverflow.total) {
      resolvedPlacement = opposite;
      resolvedPoint = oppositePoint;
      placementOverflow = oppositeOverflow;
      flipped = true;
    }
  }

  const shiftedPoint = options.shift ?? true ? shiftPoint(resolvedPoint, overlay, bounds) : resolvedPoint;
  const shifted = shiftedPoint.x !== resolvedPoint.x || shiftedPoint.y !== resolvedPoint.y;
  const overflow = getOverflow(shiftedPoint, overlay, bounds);

  return {
    x: finite(shiftedPoint.x),
    y: finite(shiftedPoint.y),
    placement: resolvedPlacement,
    align,
    flipped,
    shifted,
    placementOverflow,
    overflow,
    availableSpace: availableSpace(anchor, bounds, sideOffset),
  };
}
