export type PublicShowcaseRoute = {
  component?: string;
  embed: boolean;
  pattern?: string;
  section?: 'components' | 'patterns' | 'tokens';
};

export function normalizePatternRoute(value: string | null | undefined) {
  if (!value) return undefined;
  const [domain, rawScreen, ...rest] = value.split('/');
  if (!domain || !rawScreen || rest.length) return undefined;
  const screen = rawScreen.replace(/-screen$/, '');
  return `${domain}/${screen}`;
}

export function parsePublicShowcaseSearch(search: string): PublicShowcaseRoute {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const component = params.get('component')?.trim() || undefined;
  const pattern = normalizePatternRoute(params.get('pattern'));
  const rawSection = params.get('section');
  const section = rawSection === 'components' || rawSection === 'patterns' || rawSection === 'tokens'
    ? rawSection
    : undefined;
  return {
    component,
    embed: params.get('embed') === '1',
    pattern,
    section,
  };
}
