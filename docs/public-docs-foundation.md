# BeeUI public docs Foundation contract

Issue: #455  
Execution base: `origin/development`  
Downstream owners: #457, #458, #459, #460, #462, #463, #472, #473

## Purpose

This document freezes the Foundation boundary for the BeeUI developer portal. It does not replace existing component, pattern, Registry, token, CLI, compatibility, release, or AI/machine-readable authorities. It defines how those authorities become website routes and user-facing metadata without parsing generated Markdown as the only upstream model.

## Route and IA ownership

`web/public-site.config.json` remains the public-site authority for environment origins, route mounts, top-level public owners, legacy redirect families, navigation, source classes, build outputs, SEO/index policy, and the target docs sections.

`apps/docs/src/content/docs/**` remains the human-authored/static-route owner for Starlight content. `scripts/generate-docs-foundation.mjs` scans that source tree deterministically and generates `apps/docs/public/route-manifest.json` during docs dev/build/typecheck preparation. The generated manifest is build output and must not be hand-edited.

The Foundation creates only the top-level target IA shells required to prove:

- `/docs/start/**` — #457;
- `/docs/learn/**` — #462;
- `/docs/components/**` — #459;
- `/docs/patterns/**` — #460;
- `/docs/guides/**` — #458;
- `/docs/reference/**` — #463.

Existing legacy content remains in place until a later redirect/cutover owner deliberately moves it.

## Typed metadata contract

`apps/docs/src/lib/foundation-contract.ts` owns the common website-facing types for:

- component, pattern, and example metadata;
- canonical owner IDs and source references;
- platform/status badges;
- exact Showcase link intent;
- release state;
- redirect rules;
- canonical/index/OG page metadata.

Human-authored docs own explanation, rationale, limitations, recipes, and learning flow. Machine-derived facts continue to come from their canonical structured source.

## Release state

The machine-readable `json dist-tag-policy` block in `docs/dist-tag-policy.md` is the publication authority. Package names come from that policy; CLI identity comes from `packages/cli/package.json`; route/CTA targets come from `web/public-site.config.json`.

`scripts/generate-docs-foundation.mjs` combines those sources into `apps/docs/public/release-state.json`. `apps/docs/src/lib/release-state.ts` is the typed UI access point. UI code must not maintain a second `published` boolean or advertise npm/CLI availability independently.

While publication remains unauthorized by owner gate #254:

- `published = false`;
- public install commands are unavailable;
- CLI public availability is false;
- install CTA is hidden;
- source/repository evaluation remains available.

## Component source-to-page pipeline

Canonical inputs:

1. `packages/ui/src/index.ts` — public value/type export surface;
2. `registry/registry.json` — Registry identity and source ownership;
3. `docs/component-reference.content.json` — human-owned component reference content contract;
4. `scripts/generate-component-reference.mjs` — canonical component docs generator.

Website pages may project those structured inputs into visual page metadata, but must not invent a second component inventory. Existing `docs:contract:*` checks remain authoritative for generated component reference drift.

## Pattern source-to-page pipeline

Canonical inputs:

1. executable pattern source under `apps/showcase/patterns`;
2. `docs/pattern-library.content.json` — structured human content contract;
3. `scripts/generate-pattern-library.mjs` — canonical pattern docs generator.

Website pages may add presentation/learning prose but must not fork the pattern inventory. Existing `docs:patterns:*` checks remain authoritative.

## Examples and exact Showcase targets

#472 owns the canonical Example Registry, target resolver, direct-entry lifecycle, Back/Forward behavior, invalid-target recovery, and screenshot/evidence identity.

Foundation only owns the typed seam:

```ts
{
  surface,
  id,
  ownerId?,
  example?,
  state?,
  theme?,
  density?
}
```

and the central `buildShowcaseHref()` helper. Docs/components/patterns must not scatter hand-built Showcase query strings. #472 may evolve the encoding behind that helper without requiring every docs page to change.

## Redirect contract

Legacy docs prefix families are defined once in `web/public-site.config.json`. The Foundation generator materializes deterministic rules and validates:

- unique source prefixes;
- unique destinations;
- no self-loop;
- no redirect cycle.

Cloudflare delivery is intentionally not changed in #455. A later delivery owner consumes this manifest rather than copying mappings to a second list.

## SEO, environment origin and index policy

`web/public-site.config.json` owns the environment-to-origin mapping. Current deployable origins are:

- development: `https://beeui-dev.beemvp.com`;
- staging: `https://beeui-stg.beemvp.com`;
- production: `https://beeui.beemvp.com`.

`scripts/public-site-contract-lib.mjs` resolves the active environment and exposes the corresponding origin to Astro, landing/SEO generation, Foundation manifests and metadata callers. The config is also validated against `.github/deployment/wrangler-*.jsonc`, so a domain change in either place cannot silently drift.

Index policy is environment-owned in the same config:

- production: `index,follow`;
- development/staging and preview/candidate aliases: `noindex,nofollow`;
- non-production robots: disallow `/`;
- production runtime paths such as `/api/` stay non-indexable.

`foundation-contract.ts` provides canonical URL, index-policy, and shared page metadata helpers. `PageMetadataInput.origin` and `PageMetadataInput.environment` are required for typed callers; the helper does not contain a second hard-coded production origin. Only explicit `production` indexing is allowed; missing/unknown environment policy resolves fail-closed to `noindex,nofollow`.

The composed Worker artifact also enforces the environment policy: non-production builds emit a global `X-Robots-Tag: noindex, nofollow`, while generated `robots.txt`, canonical URLs, OG URLs and sitemap URLs use the environment origin resolved from the same contract.

## Generated output discipline

Run:

```bash
pnpm docs:foundation:generate
pnpm docs:foundation:check
pnpm docs:foundation:test
```

Docs `dev`, `build`, and `typecheck` preparation regenerate the public route/release manifests after existing component/pattern/guide generators run. Do not hand-edit generated public manifests to satisfy CI.
