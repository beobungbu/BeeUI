import { showcaseHref } from '../../../showcase/showcase-target.ts';

export type PublicationStatus = 'unpublished' | 'prerelease' | 'stable';
export type DocumentationStatus = 'stable' | 'experimental' | 'deprecated' | 'internal';
export type PlatformId = 'expo' | 'bare-react-native' | 'web' | 'ios' | 'android';
export type PlatformSupport = 'supported' | 'partial' | 'unsupported' | 'unknown';
export type ShowcaseSurface = 'component' | 'pattern' | 'tokens' | 'fixture';
export type DeploymentEnvironment = 'production' | 'development' | 'staging' | 'preview';

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

export interface ShowcaseLinkIntent {
  surface: ShowcaseSurface;
  id: string;
  ownerId?: string;
  example?: string;
  state?: string;
  theme?: string;
  density?: string;
}

export interface PublicSurfaceLinks {
  source?: SourceRef;
  showcase?: ShowcaseLinkIntent;
  demoHref?: string;
}

interface PublicDocMeta {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  status: DocumentationStatus;
  sources: SourceRef[];
  links?: PublicSurfaceLinks;
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
  prerequisites: string[];
  expectedResult: string;
  exampleId: string;
  stateIds?: string[];
}

export interface ReleaseState {
  schemaVersion: 1;
  generatedFrom: readonly string[];
  published: boolean;
  status: PublicationStatus;
  channel: 'closed' | 'next' | 'latest';
  currentVersion: string;
  workspaceVersion: string;
  packageNames: readonly string[];
  cliPackageName: string | null;
  cliAvailable: boolean;
  publicInstallCommandsAvailable: boolean;
  installCta: 'hidden' | 'prerelease' | 'stable';
  sourceEvaluationCta: 'enabled';
  ownerGate: '#254';
  changelogHref: string;
  migrationHref: string;
  sourceEvaluationHref: string;
}

export interface RedirectRule {
  fromPrefix: string;
  toPrefix: string;
  status: 301 | 302 | 307 | 308;
  preserveSuffix: boolean;
  preserveQuery: boolean;
}

export interface SiteIndexPolicy {
  production: 'index,follow';
  nonProduction: 'noindex,nofollow';
}

export interface PageMetadataInput {
  title: string;
  description: string;
  pathname: string;
  origin: string;
  imagePath?: string;
  environment: DeploymentEnvironment;
}

export interface PageMetadata {
  title: string;
  description: string;
  canonical: string;
  robots: 'index,follow' | 'noindex,nofollow';
  openGraph: {
    title: string;
    description: string;
    url: string;
    image?: string;
  };
}

function normalizeAbsolutePath(pathname: string): string {
  const value = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return value.replace(/\/{2,}/g, '/');
}

export function buildCanonicalUrl(pathname: string, origin: string): string {
  if (!origin.trim()) throw new Error('Canonical origin must be non-empty.');
  return new URL(normalizeAbsolutePath(pathname), origin).toString();
}

export function indexPolicyForEnvironment(
  environment: DeploymentEnvironment | undefined,
): 'index,follow' | 'noindex,nofollow' {
  return environment === 'production' ? 'index,follow' : 'noindex,nofollow';
}

export function buildPageMetadata(input: PageMetadataInput): PageMetadata {
  const canonical = buildCanonicalUrl(input.pathname, input.origin);
  return {
    title: input.title,
    description: input.description,
    canonical,
    robots: indexPolicyForEnvironment(input.environment),
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonical,
      ...(input.imagePath ? { image: buildCanonicalUrl(input.imagePath, input.origin) } : {}),
    },
  };
}

/**
 * Foundation-owned URL-builder seam for #472.
 *
 * #472 owns the final target inventory/parser/runtime behavior. Docs code must call this
 * helper instead of constructing Showcase query strings by hand so target identity can
 * evolve in one place. ownerId remains documentation metadata; it is deliberately not
 * serialized into the runtime target identity.
 */
export function buildShowcaseHref(target: ShowcaseLinkIntent): string {
  if (!target.id.trim()) throw new Error('Showcase target id must be non-empty.');

  // Serialization itself belongs to the runtime target contract, so this seam validates
  // documentation intent and then delegates. A second serializer here would be a second
  // definition of target identity that could drift from what Showcase actually parses.
  return showcaseHref({
    surface: target.surface,
    id: target.id,
    ...(target.example ? { example: target.example } : {}),
    ...(target.state ? { state: target.state } : {}),
    ...(target.theme ? { theme: target.theme } : {}),
    ...(target.density ? { density: target.density } : {}),
  });
}
