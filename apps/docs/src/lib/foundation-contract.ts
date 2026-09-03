export type PublicationStatus = 'unpublished' | 'prerelease' | 'stable';
export type DocumentationStatus = 'stable' | 'experimental' | 'deprecated' | 'internal';
export type PlatformId = 'expo' | 'bare-react-native' | 'web' | 'ios' | 'android';
export type PlatformSupport = 'supported' | 'partial' | 'unsupported' | 'unknown';
export type ShowcaseSurface = 'component' | 'pattern' | 'tokens' | 'fixture';

export interface SourceRef {
  path: string;
  anchor?: string;
}

export interface PlatformStatus {
  platform: PlatformId;
  support: PlatformSupport;
  evidence?: SourceRef[];
  note?: string;
}

interface PublicDocMeta {
  id: string;
  title: string;
  description: string;
  status: DocumentationStatus;
  sources: SourceRef[];
  platforms?: PlatformStatus[];
}

export interface ComponentDocMeta extends PublicDocMeta {
  kind: 'component';
  family: string;
  publicSymbols: string[];
  examples?: string[];
}

export interface PatternDocMeta extends PublicDocMeta {
  kind: 'pattern';
  components: string[];
  examples?: string[];
}

export interface ExampleDocMeta extends PublicDocMeta {
  kind: 'example';
  owner: string;
  prerequisites: string[];
  expectedResult: string;
  showcase?: ShowcaseLinkIntent;
}

export interface ReleaseState {
  schemaVersion: 1;
  generatedFrom: readonly string[];
  published: boolean;
  status: PublicationStatus;
  currentVersion: string;
  workspaceVersion: string;
  ownerGate: '#254';
  publicInstallCommandsAvailable: boolean;
}

export interface RedirectRule {
  fromPrefix: string;
  toPrefix: string;
  status: 301 | 302 | 307 | 308;
  preserveSuffix: boolean;
  preserveQuery: boolean;
}

export interface ShowcaseLinkIntent {
  surface: ShowcaseSurface;
  id: string;
  example?: string;
  state?: string;
  theme?: string;
  density?: string;
}

export interface SiteIndexPolicy {
  production: 'index,follow';
  nonProduction: 'noindex,nofollow';
}

export const PUBLIC_SITE_ORIGIN = 'https://beeui.beemvp.com' as const;

function normalizeAbsolutePath(pathname: string): string {
  const value = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return value.replace(/\/{2,}/g, '/');
}

export function buildCanonicalUrl(pathname: string, origin = PUBLIC_SITE_ORIGIN): string {
  return new URL(normalizeAbsolutePath(pathname), origin).toString();
}

/**
 * Foundation-owned URL builder seam for #472.
 *
 * #472 owns the final target inventory/parser/runtime behavior. Docs code should call this
 * helper instead of constructing Showcase query strings by hand so the final contract can
 * evolve in one place.
 */
export function buildShowcaseHref(target: ShowcaseLinkIntent): string {
  if (!target.id.trim()) throw new Error('Showcase target id must be non-empty.');

  const params = new URLSearchParams();
  params.set('surface', target.surface);
  params.set('id', target.id);
  if (target.example) params.set('example', target.example);
  if (target.state) params.set('state', target.state);
  if (target.theme) params.set('theme', target.theme);
  if (target.density) params.set('density', target.density);

  return `/showcase/?${params.toString()}`;
}
