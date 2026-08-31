import type {
  AnchoredOverlayCollisionPadding,
  AnchoredOverlayInsets,
  AnchoredOverlayRect,
} from './anchored-overlay';

export type OverlayDismissReason =
  | 'back'
  | 'escape'
  | 'outside-press'
  | 'anchor-unmount';

export type OverlayDismissHandler = (reason: OverlayDismissReason) => void;

export type OverlayDismissStack = {
  register: (id: string, handler: OverlayDismissHandler) => void;
  unregister: (id: string) => void;
  isTopmost: (id: string) => boolean;
  dismissTop: (reason: OverlayDismissReason) => boolean;
  dismissIfTopmost: (id: string, reason: OverlayDismissReason) => boolean;
  ids: () => readonly string[];
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

function normalizeInsets(insets: Partial<AnchoredOverlayInsets> | undefined): AnchoredOverlayInsets {
  return {
    top: nonNegative(insets?.top ?? 0),
    right: nonNegative(insets?.right ?? 0),
    bottom: nonNegative(insets?.bottom ?? 0),
    left: nonNegative(insets?.left ?? 0),
  };
}

function normalizeCollisionPadding(
  padding: AnchoredOverlayCollisionPadding | undefined,
): AnchoredOverlayInsets {
  if (typeof padding === 'number') {
    const value = nonNegative(padding);
    return { top: value, right: value, bottom: value, left: value };
  }

  return normalizeInsets(padding);
}

export function createOverlayDismissStack(): OverlayDismissStack {
  const entries: Array<{ id: string; handler: OverlayDismissHandler }> = [];

  const register = (id: string, handler: OverlayDismissHandler) => {
    const existing = entries.find((entry) => entry.id === id);
    if (existing) {
      existing.handler = handler;
      return;
    }
    entries.push({ id, handler });
  };

  const unregister = (id: string) => {
    const index = entries.findIndex((entry) => entry.id === id);
    if (index >= 0) entries.splice(index, 1);
  };

  const isTopmost = (id: string) => entries.at(-1)?.id === id;

  const dismissTop = (reason: OverlayDismissReason) => {
    const top = entries.at(-1);
    if (!top) return false;
    top.handler(reason);
    return true;
  };

  const dismissIfTopmost = (id: string, reason: OverlayDismissReason) => {
    if (!isTopmost(id)) return false;
    return dismissTop(reason);
  };

  return {
    register,
    unregister,
    isTopmost,
    dismissTop,
    dismissIfTopmost,
    ids: () => entries.map((entry) => entry.id),
  };
}

export function windowRectToHostRect(
  rect: AnchoredOverlayRect,
  hostRect: AnchoredOverlayRect,
): AnchoredOverlayRect {
  const normalizedRect = normalizeRect(rect);
  const normalizedHost = normalizeRect(hostRect);

  return {
    x: finite(normalizedRect.x - normalizedHost.x),
    y: finite(normalizedRect.y - normalizedHost.y),
    width: normalizedRect.width,
    height: normalizedRect.height,
  };
}

export function constrainOverlayViewportToKeyboard(
  viewportRect: AnchoredOverlayRect,
  keyboardRect?: AnchoredOverlayRect | null,
): AnchoredOverlayRect {
  const viewport = normalizeRect(viewportRect);
  if (!keyboardRect) return viewport;

  const keyboard = normalizeRect(keyboardRect);
  if (keyboard.width === 0 || keyboard.height === 0) return viewport;

  const viewportRight = viewport.x + viewport.width;
  const viewportBottom = viewport.y + viewport.height;
  const keyboardRight = keyboard.x + keyboard.width;
  const keyboardBottom = keyboard.y + keyboard.height;
  const horizontallyOverlaps = keyboard.x < viewportRight && keyboardRight > viewport.x;
  const verticallyOverlaps = keyboard.y < viewportBottom && keyboardBottom > viewport.y;

  if (!horizontallyOverlaps || !verticallyOverlaps) return viewport;

  const constrainedBottom = Math.min(viewportBottom, Math.max(viewport.y, keyboard.y));
  return {
    ...viewport,
    height: Math.max(0, constrainedBottom - viewport.y),
  };
}

export function getSafeAreaCollisionPadding(
  hostRect: AnchoredOverlayRect,
  windowRect: AnchoredOverlayRect,
  safeAreaInsets: Partial<AnchoredOverlayInsets>,
): AnchoredOverlayInsets {
  const host = normalizeRect(hostRect);
  const window = normalizeRect(windowRect);
  const insets = normalizeInsets(safeAreaInsets);

  const hostRight = host.x + host.width;
  const hostBottom = host.y + host.height;
  const safeLeft = window.x + insets.left;
  const safeTop = window.y + insets.top;
  const safeRight = window.x + window.width - insets.right;
  const safeBottom = window.y + window.height - insets.bottom;

  return {
    top: Math.max(0, safeTop - host.y),
    right: Math.max(0, hostRight - safeRight),
    bottom: Math.max(0, hostBottom - safeBottom),
    left: Math.max(0, safeLeft - host.x),
  };
}

export function mergeOverlayCollisionPadding(
  first: AnchoredOverlayCollisionPadding | undefined,
  second: AnchoredOverlayCollisionPadding | undefined,
): AnchoredOverlayInsets {
  const a = normalizeCollisionPadding(first);
  const b = normalizeCollisionPadding(second);
  return {
    top: a.top + b.top,
    right: a.right + b.right,
    bottom: a.bottom + b.bottom,
    left: a.left + b.left,
  };
}
