import { accountSettingsPatternDomain } from './domains/account-settings-gallery';
import { authPatternDomain } from './domains/auth-gallery';
import { commerceSocialPatternDomain } from './domains/commerce-social-gallery';
import { dashboardFinancePatternDomain } from './domains/dashboard-finance-gallery';
import type { PatternDomain, PatternScreenDefinition } from './types';

export const patternCatalog: readonly PatternDomain[] = [
  authPatternDomain,
  dashboardFinancePatternDomain,
  commerceSocialPatternDomain,
  accountSettingsPatternDomain,
];

export const patternScreens: readonly PatternScreenDefinition[] = patternCatalog.flatMap((domain) => domain.screens);

export function findPatternDomain(domainId: string | null | undefined) {
  return patternCatalog.find((domain) => domain.id === domainId);
}

export function findPatternScreen(domain: PatternDomain | undefined, screenId: string | null | undefined) {
  return domain?.screens.find((screen) => screen.id === screenId);
}

export function defaultPatternState(screen: PatternScreenDefinition) {
  return screen.defaultState ?? screen.states?.[0]?.id ?? 'default';
}
