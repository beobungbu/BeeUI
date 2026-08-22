import type { OverlayDismissReason } from '@beeui/core';

export type OverlayPlatformDismissHandler = (reason: OverlayDismissReason) => boolean;

type KeyboardEventLike = {
  key?: string;
  preventDefault?: () => void;
  stopPropagation?: () => void;
};

type GlobalEventTargetLike = {
  addEventListener?: (type: string, listener: (event: KeyboardEventLike) => void) => void;
  removeEventListener?: (type: string, listener: (event: KeyboardEventLike) => void) => void;
};

export function subscribeOverlayPlatformDismiss(handler: OverlayPlatformDismissHandler) {
  const target = globalThis as typeof globalThis & GlobalEventTargetLike;
  if (!target.addEventListener || !target.removeEventListener) return () => undefined;

  const listener = (event: KeyboardEventLike) => {
    if (event.key !== 'Escape') return;
    if (!handler('escape')) return;
    event.preventDefault?.();
    event.stopPropagation?.();
  };

  target.addEventListener('keydown', listener);
  return () => target.removeEventListener?.('keydown', listener);
}
