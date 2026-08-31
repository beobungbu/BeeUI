import { resolveAnchoredOverlayPosition } from '@beemvp/beeui-core';

describe('BeeUI issue #17 anchored overlay geometry', () => {
  it('keeps a preferred bottom placement when it fits', () => {
    const result = resolveAnchoredOverlayPosition({
      anchorRect: { x: 100, y: 100, width: 40, height: 20 },
      overlaySize: { width: 80, height: 40 },
      viewportRect: { x: 0, y: 0, width: 400, height: 800 },
      placement: 'bottom',
      sideOffset: 8,
    });

    expect(result).toMatchObject({
      x: 80,
      y: 128,
      placement: 'bottom',
      align: 'center',
      flipped: false,
      shifted: false,
    });
    expect(result.overflow.total).toBe(0);
  });

  it('flips to the opposite side when the preferred side overflows and the opposite fits better', () => {
    const result = resolveAnchoredOverlayPosition({
      anchorRect: { x: 120, y: 740, width: 40, height: 20 },
      overlaySize: { width: 100, height: 60 },
      viewportRect: { x: 0, y: 0, width: 400, height: 800 },
      placement: 'bottom',
      sideOffset: 8,
      collisionPadding: 16,
    });

    expect(result.placement).toBe('top');
    expect(result.flipped).toBe(true);
    expect(result.y).toBe(672);
    expect(result.placementOverflow.total).toBe(0);
  });

  it('does not flip when the opposite side would overflow more', () => {
    const result = resolveAnchoredOverlayPosition({
      anchorRect: { x: 100, y: 100, width: 40, height: 20 },
      overlaySize: { width: 80, height: 900 },
      viewportRect: { x: 0, y: 0, width: 400, height: 800 },
      placement: 'bottom',
      shift: false,
    });

    expect(result.placement).toBe('bottom');
    expect(result.flipped).toBe(false);
    expect(result.placementOverflow.bottom).toBe(220);
  });

  it('shifts inside per-edge collision bounds with a non-zero viewport origin', () => {
    const result = resolveAnchoredOverlayPosition({
      anchorRect: { x: 70, y: 200, width: 20, height: 20 },
      overlaySize: { width: 120, height: 50 },
      viewportRect: { x: 50, y: 100, width: 300, height: 400 },
      placement: 'bottom',
      collisionPadding: { top: 30, right: 20, bottom: 40, left: 10 },
    });

    expect(result.x).toBe(60);
    expect(result.y).toBe(220);
    expect(result.shifted).toBe(true);
    expect(result.overflow.total).toBe(0);
  });

  it('returns available space using collision padding and side offset', () => {
    const result = resolveAnchoredOverlayPosition({
      anchorRect: { x: 100, y: 100, width: 20, height: 20 },
      overlaySize: { width: 40, height: 40 },
      viewportRect: { x: 0, y: 0, width: 300, height: 300 },
      collisionPadding: 10,
      sideOffset: 5,
    });

    expect(result.availableSpace).toEqual({
      top: 85,
      right: 165,
      bottom: 165,
      left: 85,
    });
  });

  it('resolves horizontal start and end alignment according to LTR and RTL direction', () => {
    const base = {
      anchorRect: { x: 100, y: 100, width: 40, height: 20 },
      overlaySize: { width: 100, height: 40 },
      viewportRect: { x: 0, y: 0, width: 400, height: 400 },
      placement: 'bottom' as const,
      shift: false,
      flip: false,
    };

    expect(resolveAnchoredOverlayPosition({ ...base, align: 'start', direction: 'ltr' }).x).toBe(100);
    expect(resolveAnchoredOverlayPosition({ ...base, align: 'end', direction: 'ltr' }).x).toBe(40);
    expect(resolveAnchoredOverlayPosition({ ...base, align: 'start', direction: 'rtl' }).x).toBe(40);
    expect(resolveAnchoredOverlayPosition({ ...base, align: 'end', direction: 'rtl' }).x).toBe(100);
  });

  it('applies side and alignment offsets on horizontal placements', () => {
    const result = resolveAnchoredOverlayPosition({
      anchorRect: { x: 100, y: 200, width: 40, height: 30 },
      overlaySize: { width: 50, height: 20 },
      viewportRect: { x: 0, y: 0, width: 400, height: 500 },
      placement: 'right',
      sideOffset: 12,
      alignOffset: 5,
    });

    expect(result.x).toBe(152);
    expect(result.y).toBe(210);
    expect(result.placement).toBe('right');
  });

  it('can disable flip and shift independently', () => {
    const result = resolveAnchoredOverlayPosition({
      anchorRect: { x: 180, y: 180, width: 20, height: 20 },
      overlaySize: { width: 100, height: 80 },
      viewportRect: { x: 0, y: 0, width: 200, height: 200 },
      placement: 'bottom',
      flip: false,
      shift: false,
    });

    expect(result.placement).toBe('bottom');
    expect(result.flipped).toBe(false);
    expect(result.shifted).toBe(false);
    expect(result.overflow.total).toBeGreaterThan(0);
  });

  it('normalizes non-finite geometry to finite output', () => {
    const result = resolveAnchoredOverlayPosition({
      anchorRect: { x: Number.NaN, y: Number.POSITIVE_INFINITY, width: -20, height: 10 },
      overlaySize: { width: Number.POSITIVE_INFINITY, height: Number.NaN },
      viewportRect: { x: Number.NaN, y: 0, width: Number.POSITIVE_INFINITY, height: 200 },
      sideOffset: Number.NaN,
      alignOffset: Number.NEGATIVE_INFINITY,
      collisionPadding: Number.POSITIVE_INFINITY,
    });

    expect([
      result.x,
      result.y,
      result.placementOverflow.total,
      result.overflow.total,
      result.availableSpace.top,
      result.availableSpace.right,
      result.availableSpace.bottom,
      result.availableSpace.left,
    ].every(Number.isFinite)).toBe(true);
  });
});
