import {
  motion,
  motionDuration,
  type MotionIntent,
  type MotionReducedMotionPolicy,
} from './index';

export type NativeSpringMotionPlan = {
  type: 'spring';
  stiffness: number;
  damping: number;
  mass: number;
};

export type NativeTimingMotionPlan = {
  type: 'timing';
  durationMs: number;
  easing: readonly [number, number, number, number];
};

export type NativeImmediateMotionPlan = {
  type: 'immediate';
};

export type NativeMotionPlan = NativeSpringMotionPlan | NativeTimingMotionPlan | NativeImmediateMotionPlan;

function cssCubicBezierToArray(value: string): readonly [number, number, number, number] {
  const match = /^cubic-bezier\(([^)]+)\)$/.exec(value.trim());
  if (!match) throw new Error(`Unsupported BeeUI motion easing: ${value}`);
  const values = match[1].split(',').map((part) => Number(part.trim()));
  if (values.length !== 4 || values.some((point) => !Number.isFinite(point))) {
    throw new Error(`Invalid BeeUI cubic-bezier motion easing: ${value}`);
  }
  return values as [number, number, number, number];
}

function baseNativePlan(intent: MotionIntent): NativeSpringMotionPlan | NativeTimingMotionPlan {
  const native = motion[intent].native;
  if (native.type === 'spring') {
    return {
      type: 'spring',
      stiffness: native.stiffness,
      damping: native.damping,
      mass: native.mass,
    };
  }
  return {
    type: 'timing',
    durationMs: native.durationMs,
    easing: [...native.easing] as [number, number, number, number],
  };
}

/**
 * Resolves the native animation configuration for a semantic intent.
 *
 * The generated `motion` object remains the canonical data source. This helper
 * only turns its reduced-motion policy into an executable native plan; it adds
 * no preference store and accepts the platform/app reduced-motion signal from
 * the caller.
 *
 * Spatial-removal policies replace a spring with timing because once transform/
 * size motion is removed there is no spatial spring left to execute. The timing
 * fallback reuses the intent's canonical web duration/easing values, represented
 * as the four-number cubic-bezier array React Native consumers can map to
 * `Easing.bezier`.
 */
export function resolveNativeMotion(
  intent: MotionIntent,
  options: { reducedMotion?: boolean } = {},
): NativeMotionPlan {
  const spec = motion[intent];
  if (!options.reducedMotion) return baseNativePlan(intent);

  // The current vocabulary uses only a subset of the supported policies. Widen
  // the generated literal union here so future intents can adopt the already
  // public policy vocabulary without making this resolver unreachable at type level.
  const policy = spec.reducedMotion as MotionReducedMotionPolicy;
  switch (policy) {
    case 'immediate':
      return { type: 'immediate' };
    case 'shorten':
      return {
        type: 'timing',
        durationMs: Math.min(spec.web.durationMs, motionDuration.fast),
        easing: cssCubicBezierToArray(spec.web.easing),
      };
    case 'opacity-or-state':
    case 'remove-spatial':
      return {
        type: 'timing',
        durationMs: spec.web.durationMs,
        easing: cssCubicBezierToArray(spec.web.easing),
      };
  }
}
