import * as React from 'react';
import type { MockOutcome } from '../services';

/**
 * App-owned "demo data scenario" context (#263 cross-flow integration glue).
 * Every data screen (#259-262) reads the active scenario and maps it onto its
 * own `mockFetch` `outcome` parameter, so the loading/empty/error states each
 * screen's DoD requires are *reachable through real interaction* — a reviewer
 * flips this control from Settings and watches every screen's live state
 * change, rather than the states only existing as code paths a test happens
 * to exercise. This is not a second data-fetching framework: it holds one
 * enum value and nothing else; every screen still owns its own fetch call
 * and `useAsync` lifecycle (ADR-013 D4).
 */
export type DemoScenario = 'normal' | 'empty' | 'error';

export const DEMO_SCENARIOS: readonly DemoScenario[] = ['normal', 'empty', 'error'];

/** Maps the active scenario onto the `mockFetch`/`MockFetchConfig` outcome it should produce. */
export function demoScenarioToMockOutcome(scenario: DemoScenario): MockOutcome {
  if (scenario === 'empty') return 'empty';
  if (scenario === 'error') return 'error';
  return 'success';
}

export type DemoScenarioContextValue = {
  scenario: DemoScenario;
  setScenario: (scenario: DemoScenario) => void;
};

const DemoScenarioContext = React.createContext<DemoScenarioContextValue | null>(null);

export type DemoScenarioProviderProps = {
  children?: React.ReactNode;
  /** Overrides the starting scenario. Defaults to `'normal'`. Mainly useful for tests. */
  initialScenario?: DemoScenario;
};

export function DemoScenarioProvider({ children, initialScenario = 'normal' }: DemoScenarioProviderProps) {
  const [scenario, setScenario] = React.useState<DemoScenario>(initialScenario);
  const value = React.useMemo<DemoScenarioContextValue>(
    () => ({ scenario, setScenario }),
    [scenario],
  );

  return <DemoScenarioContext.Provider value={value}>{children}</DemoScenarioContext.Provider>;
}

export function useDemoScenario(): DemoScenarioContextValue {
  const context = React.useContext(DemoScenarioContext);
  if (!context) {
    throw new Error('useDemoScenario must be used within a DemoScenarioProvider');
  }
  return context;
}
