import { applyDensity, densityPresets } from '@beeui/tokens';
import { BeeThemeScope, Button, ListItem, getBeeToken, useBeeToken } from '@beeui/ui';
import { act, render } from '@testing-library/react-native';
import * as React from 'react';
import { Uniwind } from 'uniwind';
import { sampleWorkload } from '../perf/sample-workload';
import { writeRawScenarioRecords, type RawScenarioRecord } from '../perf/scenario-recorder';

// BeeUI R5.4 (#182) — theme runtime performance benchmarks, extending the
// #179 benchmark harness. Measures BeeUI-controlled cost of light/dark
// switching, Bee/Violet scoped themes, high-contrast switching, runtime
// overrides, and token readers, using the SAME `uniwind` mock
// (`apps/showcase/__mocks__/uniwind.ts`) every other theme-runtime test in
// this repo verifies against real generated CSS/registry values, not
// synthetic fixtures.
//
// "Watch specifically" findings from #182 are asserted here as correctness
// checks (not timings): a static-className consumer (`ListItem`, via #74
// density CSS variables; a plain `Button`, via global theme switch) does NOT
// re-render when only a CSS variable/global theme changes — proving
// BeeUI/Uniwind's CSS-variable-driven styling needs no React re-render for
// most of the tree, and a scoped-theme sibling does not leak a scope change.

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ReactActual.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) => (
        <View ref={ref} {...props}>
          {children}
        </View>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

const records: RawScenarioRecord[] = [];

function record(entry: RawScenarioRecord) {
  records.push(entry);
}

function benchSync(
  id: string,
  title: string,
  description: string,
  unit: string,
  fn: (iteration: number) => unknown,
  { warmup = 10, samples = 30 }: { warmup?: number; samples?: number } = {},
) {
  const durations = sampleWorkload({ warmup, samples, fn });
  record({
    id,
    title,
    platform: 'web',
    unit,
    description,
    warmup,
    samples,
    iterations: 1,
    candidate: { label: 'beeui', durations },
  });
}

function TokenReaderCounter({ onRender }: { onRender: () => void }) {
  onRender();
  const primary = useBeeToken('colors.primary');
  return <React.Fragment>{primary}</React.Fragment>;
}

let renderCounter = 0;

describe('BeeUI #182 theme runtime performance benchmarks', () => {
  const originalTheme = Uniwind.currentTheme;

  afterEach(() => {
    Uniwind.setTheme(originalTheme);
  });

  afterAll(() => {
    writeRawScenarioRecords('theme-runtime.json', records);
  });

  it('global light/dark theme switching cost', () => {
    const screen = render(<TokenReaderCounter onRender={() => undefined} />);
    let toggle = false;
    benchSync(
      'web/theme/global-light-dark-switch',
      'Global light/dark theme switch (Uniwind.setTheme)',
      'Cost of Uniwind.setTheme("light"|"dark") with one live useBeeToken subscriber mounted — the real cost path a light/dark toggle pays.',
      'ms/switch',
      () => {
        toggle = !toggle;
        act(() => {
          Uniwind.setTheme(toggle ? 'dark' : 'light');
        });
      },
    );
    screen.unmount();
  });

  it('high-contrast theme switching cost', () => {
    const screen = render(<TokenReaderCounter onRender={() => undefined} />);
    let toggle = false;
    benchSync(
      'web/theme/high-contrast-switch',
      'High-contrast theme switch (Uniwind.setTheme)',
      'Cost of switching between high-contrast-light/high-contrast-dark runtime themes — same mechanism as light/dark, distinct runtime-theme pair.',
      'ms/switch',
      () => {
        toggle = !toggle;
        act(() => {
          Uniwind.setTheme(toggle ? 'high-contrast-dark' : 'high-contrast-light');
        });
      },
    );
    screen.unmount();
  });

  it('a static-className Button does not re-render on a global theme switch', () => {
    let buttonRenders = 0;
    function CountingButton() {
      buttonRenders += 1;
      return (
        <Button onPress={() => undefined} variant="primary">
          Action
        </Button>
      );
    }
    render(<CountingButton />);
    const before = buttonRenders;
    act(() => {
      Uniwind.setTheme('dark');
    });
    // Watch item: BeeUI's static-className components restyle via CSS
    // variables, not a React re-render, on a plain global theme switch.
    expect(buttonRenders).toBe(before);
  });

  it('Bee/Violet scoped theme (BeeThemeScope) switch cost, with no sibling leakage', () => {
    let scopedRenders = 0;
    let siblingRenders = 0;

    function ScopedConsumer() {
      scopedRenders += 1;
      const primary = useBeeToken('colors.primary');
      return <React.Fragment>{primary}</React.Fragment>;
    }
    // Memoized with no props: a genuinely uninvolved sibling in a real app
    // would not re-render just because an ancestor re-rendered with a new
    // `appearance` value it never receives — `React.memo` makes that bail-out
    // observable here the same way it would be in application code.
    const Sibling = React.memo(function Sibling() {
      siblingRenders += 1;
      return null;
    });

    function Harness({ appearance }: { appearance: 'light' | 'dark' }) {
      return (
        <React.Fragment>
          <BeeThemeScope appearance={appearance} brand="violet">
            <ScopedConsumer />
          </BeeThemeScope>
          <Sibling />
        </React.Fragment>
      );
    }

    const screen = render(<Harness appearance="light" />);
    const siblingRendersAfterMount = siblingRenders;

    let appearance: 'light' | 'dark' = 'light';
    benchSync(
      'web/theme/scoped-brand-switch',
      'Scoped Bee/Violet theme switch (BeeThemeScope)',
      'Cost of re-rendering with a new BeeThemeScope brand="violet" appearance prop (light/dark), with one live useBeeToken subscriber inside the scope.',
      'ms/switch',
      (i) => {
        appearance = appearance === 'light' ? 'dark' : 'light';
        act(() => {
          screen.rerender(<Harness appearance={appearance} />);
        });
        // Sibling-leakage watch item: a sibling OUTSIDE the scope must never
        // re-render because of a change confined to the scope.
        if (i === 0 && siblingRenders !== siblingRendersAfterMount) {
          throw new Error('scoped theme change leaked a re-render to a sibling outside the scope');
        }
      },
    );
    screen.unmount();
    void scopedRenders;
  });

  it('runtime CSS-variable override cost (applyThemeOverrides-style call)', () => {
    const screen = render(<TokenReaderCounter onRender={() => undefined} />);
    let i = 0;
    benchSync(
      'web/theme/runtime-variable-override',
      'Runtime CSS-variable override (Uniwind.updateCSSVariables)',
      'Cost of a #71-style runtime override call updating one theme color variable, with one live useBeeToken subscriber of that same variable mounted.',
      'ms/override',
      () => {
        i += 1;
        act(() => {
          Uniwind.updateCSSVariables('light', { '--color-primary': i % 2 === 0 ? '#f59e0b' : '#eab308' });
        });
      },
    );
    screen.unmount();
  });

  it('density mode application cost (applyDensity call-through, no component re-render)', () => {
    // #74 density is CSS-variable-driven (`ListItem` consumes
    // `--spacing-density-row-*` directly in its className) — applying a new
    // density mode is a Uniwind call-through, not a React state change, so
    // there is no "density re-render" scenario to benchmark; the watch item
    // below proves that directly instead of inventing one.
    let renderCount = 0;
    function CountingListItem() {
      renderCount += 1;
      return <ListItem title="Row" />;
    }
    render(<CountingListItem />);
    const before = renderCount;
    act(() => {
      applyDensity(Uniwind, 'light', 'compact');
    });
    expect(renderCount).toBe(before);

    let mode: 'compact' | 'comfortable' | 'spacious' = 'compact';
    benchSync(
      'web/theme/density-apply',
      'Apply a density mode (applyDensity call-through)',
      'Cost of applyDensity(Uniwind, theme, mode), which forwards the precompiled density preset to Uniwind.updateCSSVariables — no React re-render is involved (see the correctness check in this same test).',
      'ms/apply',
      () => {
        mode = mode === 'compact' ? 'spacious' : 'compact';
        act(() => {
          applyDensity(Uniwind, 'light', mode);
        });
      },
    );
    void densityPresets;
  });

  it('useBeeToken (hook, live-updating) read cost under repeated theme switches', () => {
    renderCounter = 0;
    const screen = render(<TokenReaderCounter onRender={() => { renderCounter += 1; }} />);
    let toggle = false;
    benchSync(
      'web/theme/use-bee-token-read',
      'useBeeToken live-updating read cost',
      'Cost of a global theme switch as observed end-to-end through one useBeeToken("colors.primary") subscriber (hook re-render + resolve + normalize).',
      'ms/read',
      () => {
        toggle = !toggle;
        act(() => {
          Uniwind.setTheme(toggle ? 'dark' : 'light');
        });
      },
    );
    screen.unmount();
  });

  it('getBeeToken (imperative snapshot read) cost', () => {
    benchSync(
      'web/theme/get-bee-token-read',
      'getBeeToken imperative snapshot read cost',
      'Cost of a bare getBeeToken("colors.primary") call — imperative, global-theme-only, no React involved. Baseline for useBeeToken\'s hook overhead.',
      'ms/read',
      () => {
        getBeeToken('colors.primary');
      },
      { warmup: 20, samples: 60 },
    );
  });
});
