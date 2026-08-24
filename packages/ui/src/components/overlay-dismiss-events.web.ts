import type { OverlayDismissReason } from '@beeui/core';

export type OverlayPlatformDismissHandler = (reason: OverlayDismissReason) => boolean;

type KeyboardEventLike = {
  key?: string;
  preventDefault?: () => void;
  stopPropagation?: () => void;
  stopImmediatePropagation?: () => void;
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
    // BeeUI's supported application contract has one root overlay runtime; nested
    // BeeUIProviders reuse it. Runtime state is isolated if independent roots are
    // mounted for tests/embedded surfaces, but arbitration of one physical Escape
    // across multiple unrelated application roots is intentionally not guaranteed.
    // Once this runtime handles Escape, stop same-target listeners from also acting
    // on that physical event.
    if (!handler('escape')) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
  };

  target.addEventListener('keydown', listener);
  return () => target.removeEventListener?.('keydown', listener);
}
