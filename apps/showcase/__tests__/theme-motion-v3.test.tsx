import { fireEvent, render } from '@testing-library/react-native';
import {
  motion,
  motionDuration,
  motionEasing,
  motionIntents,
  resolveMotion,
  type MotionIntent,
  type MotionReducedMotionPolicy,
} from '@beemvp/beeui-tokens';
import { resolveNativeMotion } from '@beemvp/beeui-tokens/motion-runtime';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as React from 'react';
import { Animated } from 'react-native';

import { MotionBehaviorFixture, MotionPreview } from '../theme-inspector/motion-preview';

const canonicalTokens = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../packages/tokens/tokens.json'), 'utf8'),
);
const semanticMotion = canonicalTokens.$extensions['com.beeui'].semanticMotion;

const supportedPolicies: readonly MotionReducedMotionPolicy[] = [
  'immediate',
  'opacity-or-state',
  'shorten',
  'remove-spatial',
];

function mockAnimationExecution() {
  const implementation = () => ({
    start: (callback?: (result: { finished: boolean }) => void) => callback?.({ finished: true }),
    stop: jest.fn(),
    reset: jest.fn(),
  }) as any;
  return {
    spring: jest.spyOn(Animated, 'spring').mockImplementation(implementation as any),
    timing: jest.spyOn(Animated, 'timing').mockImplementation(implementation as any),
  };
}

describe('semantic motion token surface', () => {
  it('exposes exactly the approved recurring-transition vocabulary', () => {
    expect(motionIntents).toEqual(['overlay-enter', 'overlay-exit', 'sheet-enter', 'sheet-exit', 'disclosure']);
    expect(Object.keys(motion)).toEqual([...motionIntents]);
    expect(Object.keys(semanticMotion)).toEqual([...motionIntents]);
  });

  it('keeps legacy motion duration and easing exports compatible', () => {
    expect(motionDuration).toEqual({ fast: 120, normal: 200, slow: 320 });
    expect(motionEasing).toEqual({
      standard: 'cubic-bezier(0.2, 0, 0, 1)',
      emphasized: 'cubic-bezier(0.2, 0, 0, 1.2)',
    });
  });

  it('derives web timing and native spring/timing representations from the shared tokens', () => {
    expect(motion['overlay-enter'].web).toEqual({
      durationMs: 200,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
      properties: ['opacity', 'transform'],
    });
    expect(motion['overlay-enter'].native).toEqual({
      type: 'spring',
      stiffness: 260,
      damping: 26,
      mass: 1,
    });
    expect(motion['overlay-exit'].native).toEqual({
      type: 'timing',
      durationMs: 120,
      easing: [0.2, 0, 0, 1],
    });
    expect(motion.disclosure.web.properties).toContain('height');
  });

  it('gives every intent a reduced-motion policy from the supported set', () => {
    for (const intent of motionIntents) {
      expect(supportedPolicies).toContain(motion[intent].reducedMotion);
    }
  });
});

describe('resolveMotion reduced-motion contract', () => {
  it('animates with spatial motion by default', () => {
    expect(resolveMotion('overlay-enter')).toEqual({
      animate: true,
      durationMs: 200,
      spatial: true,
      reducedMotionApplied: false,
    });
  });

  it('drops spatial motion but keeps the opacity fade for opacity-or-state intents', () => {
    expect(resolveMotion('overlay-enter', { reducedMotion: true })).toEqual({
      animate: true,
      durationMs: 200,
      spatial: false,
      reducedMotionApplied: true,
    });
  });

  it('collapses to an immediate transition for immediate intents', () => {
    for (const intent of ['overlay-exit', 'disclosure'] as const satisfies readonly MotionIntent[]) {
      expect(resolveMotion(intent, { reducedMotion: true })).toEqual({
        animate: false,
        durationMs: 0,
        spatial: false,
        reducedMotionApplied: true,
      });
    }
  });

  it('never leaves an intent without a resolution in either mode', () => {
    for (const intent of motionIntents) {
      for (const reducedMotion of [false, true]) {
        const resolved = resolveMotion(intent, { reducedMotion });
        expect(typeof resolved.animate).toBe('boolean');
        expect(Number.isFinite(resolved.durationMs)).toBe(true);
        expect(resolved.durationMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('keeps the generated CSS spatial flag in lockstep with the JS resolveMotion spatial value', () => {
    const themeCss = fs.readFileSync(
      path.resolve(__dirname, '../../../packages/tokens/src/theme.css'),
      'utf8',
    );
    const reducedIndex = themeCss.indexOf('@media (prefers-reduced-motion: reduce)');
    const baseBlock = themeCss.slice(0, reducedIndex);
    const reducedBlock = themeCss.slice(reducedIndex);

    const flagIn = (block: string, intent: MotionIntent) => {
      const match = block.match(new RegExp(`--motion-${intent}-spatial:\\s*([01]);`));
      return match ? match[1] === '1' : undefined;
    };

    for (const intent of motionIntents) {
      const baseFlag = flagIn(baseBlock, intent);
      const reducedFlag = flagIn(reducedBlock, intent) ?? baseFlag;
      expect(baseFlag).toBe(resolveMotion(intent, { reducedMotion: false }).spatial);
      expect(reducedFlag).toBe(resolveMotion(intent, { reducedMotion: true }).spatial);
    }
  });

  it('keeps every immediate intent collapsed in generated CSS under reduced motion', () => {
    const themeCss = fs.readFileSync(
      path.resolve(__dirname, '../../../packages/tokens/src/theme.css'),
      'utf8',
    );
    const reducedBlock = themeCss.slice(themeCss.indexOf('@media (prefers-reduced-motion: reduce)'));

    for (const intent of motionIntents) {
      if (motion[intent].reducedMotion === 'immediate') {
        expect(reducedBlock).toContain(`--motion-${intent}-duration: 0.01ms;`);
      }
    }
  });
});

describe('native reduced-motion runtime plan', () => {
  it('keeps the canonical spring when reduced motion is off', () => {
    expect(resolveNativeMotion('overlay-enter')).toEqual({
      type: 'spring',
      stiffness: 260,
      damping: 26,
      mass: 1,
    });
  });

  it('replaces spatial spring motion with a deterministic timing fade under opacity-or-state', () => {
    expect(resolveNativeMotion('overlay-enter', { reducedMotion: true })).toEqual({
      type: 'timing',
      durationMs: 200,
      easing: [0.2, 0, 0, 1],
    });
  });

  it('returns an explicit immediate native plan for immediate intents', () => {
    expect(resolveNativeMotion('overlay-exit', { reducedMotion: true })).toEqual({ type: 'immediate' });
    expect(resolveNativeMotion('disclosure', { reducedMotion: true })).toEqual({ type: 'immediate' });
  });
});

describe('MotionPreview policy inspector', () => {
  it('shows every intent and its final state with motion enabled', () => {
    const screen = render(<MotionPreview reducedMotion={false} />);
    expect(screen.getAllByText('Final state is always shown here.')).toHaveLength(motionIntents.length);
    expect(screen.getByText('Off')).toBeTruthy();
    const plan = screen.getByTestId('motion-plan-overlay-enter');
    expect(plan.props.children.join('')).toContain('animate 200ms');
    expect(plan.props.children.join('')).toContain('spatial');
  });

  it('preserves the same final state and reports the reduced plan with reduced motion', () => {
    const screen = render(<MotionPreview reducedMotion />);
    expect(screen.getAllByText('Final state is always shown here.')).toHaveLength(motionIntents.length);
    expect(screen.getByText('On')).toBeTruthy();

    const exitPlan = screen.getByTestId('motion-plan-overlay-exit');
    expect(exitPlan.props.children.join('')).toContain('no animation (immediate)');
    expect(exitPlan.props.children.join('')).toContain('no spatial motion');

    const enterPlan = screen.getByTestId('motion-plan-overlay-enter');
    expect(enterPlan.props.children.join('')).toContain('no spatial motion');
  });
});

describe('representative interaction-driven animation behavior', () => {
  it('does not animate merely because motion tokens/fixture are rendered, then executes spring on request', () => {
    const animation = mockAnimationExecution();
    try {
      const screen = render(<MotionBehaviorFixture reducedMotion={false} />);
      expect(animation.spring).not.toHaveBeenCalled();
      expect(animation.timing).not.toHaveBeenCalled();
      expect(screen.getByTestId('motion-behavior-phase-overlay-enter').props.children).toBe('final');

      fireEvent.press(screen.getByTestId('motion-behavior-play-overlay-enter'));

      expect(animation.spring).toHaveBeenCalledTimes(1);
      expect(animation.timing).not.toHaveBeenCalled();
      expect(screen.getByTestId('motion-behavior-final-overlay-enter').props.children).toBe('Representative final state');
      expect(screen.getByTestId('motion-behavior-phase-overlay-enter').props.children).toBe('final');
    } finally {
      animation.spring.mockRestore();
      animation.timing.mockRestore();
    }
  });

  it('executes the reduced-motion timing fallback and reaches the identical final state', () => {
    const animation = mockAnimationExecution();
    try {
      const screen = render(<MotionBehaviorFixture reducedMotion />);
      fireEvent.press(screen.getByTestId('motion-behavior-play-overlay-enter'));

      expect(animation.spring).not.toHaveBeenCalled();
      expect(animation.timing).toHaveBeenCalledTimes(1);
      expect(animation.timing.mock.calls[0]?.[1]).toMatchObject({ duration: 200, useNativeDriver: true });
      expect(screen.getByTestId('motion-behavior-final-overlay-enter').props.children).toBe('Representative final state');
      expect(screen.getByTestId('motion-behavior-phase-overlay-enter').props.children).toBe('final');
    } finally {
      animation.spring.mockRestore();
      animation.timing.mockRestore();
    }
  });

  it('jumps directly to final state for reduced immediate intent without invoking an animation runtime', () => {
    const animation = mockAnimationExecution();
    try {
      const screen = render(<MotionBehaviorFixture intent="overlay-exit" reducedMotion />);
      fireEvent.press(screen.getByTestId('motion-behavior-play-overlay-exit'));

      expect(animation.spring).not.toHaveBeenCalled();
      expect(animation.timing).not.toHaveBeenCalled();
      expect(screen.getByTestId('motion-behavior-final-overlay-exit').props.children).toBe('Representative final state');
      expect(screen.getByTestId('motion-behavior-phase-overlay-exit').props.children).toBe('final');
    } finally {
      animation.spring.mockRestore();
      animation.timing.mockRestore();
    }
  });
});
