export type ShowcaseSurface = 'component' | 'pattern' | 'tokens' | 'fixture';

export type ShowcaseTarget = {
  surface: ShowcaseSurface;
  id: string;
  example?: string;
  state?: string;
  theme?: string;
  density?: string;
};

const SURFACES = new Set<ShowcaseSurface>(['component', 'pattern', 'tokens', 'fixture']);

function clean(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function parseShowcaseTarget(search: string): ShowcaseTarget | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  // Temporary compatibility with the pre-#472 generated component links. The
  // canonical serializer never emits this form; keeping it readable lets old
  // copied links recover to the new stable target instead of silently opening Home.
  const legacyComponent = clean(params.get('component'));
  if (legacyComponent && !params.get('surface')) {
    return { surface: 'component', id: legacyComponent, example: clean(params.get('example')) ?? 'basic' };
  }

  const rawSurface = clean(params.get('surface'));
  const id = clean(params.get('id'));
  if (!rawSurface || !SURFACES.has(rawSurface as ShowcaseSurface) || !id) return null;

  return {
    surface: rawSurface as ShowcaseSurface,
    id,
    ...(clean(params.get('example')) ? { example: clean(params.get('example')) } : {}),
    ...(clean(params.get('state')) ? { state: clean(params.get('state')) } : {}),
    ...(clean(params.get('theme')) ? { theme: clean(params.get('theme')) } : {}),
    ...(clean(params.get('density')) ? { density: clean(params.get('density')) } : {}),
  };
}

export function serializeShowcaseTarget(target: ShowcaseTarget) {
  const params = new URLSearchParams();
  params.set('surface', target.surface);
  params.set('id', target.id);
  if (target.example) params.set('example', target.example);
  if (target.state) params.set('state', target.state);
  if (target.theme) params.set('theme', target.theme);
  if (target.density) params.set('density', target.density);
  return `?${params.toString()}`;
}

export function showcaseHref(target: ShowcaseTarget, basePath = '/showcase/') {
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return `${normalizedBase}${serializeShowcaseTarget(target)}`;
}

export function sameShowcaseTarget(a: ShowcaseTarget | null | undefined, b: ShowcaseTarget | null | undefined) {
  if (!a || !b) return a === b;
  return serializeShowcaseTarget(a) === serializeShowcaseTarget(b);
}
