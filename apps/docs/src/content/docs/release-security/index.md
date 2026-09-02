---
title: Release & security
description: BeeUI's release status, verification model, and vulnerability-reporting policy.
---

## Current release state

BeeUI's GitHub repository is **public** and the current repository release candidate is
**`20260902.0.0`**. The `@beemvp/beeui-ui` manifest is release-shaped, but public npm
publication is still owner-gated by [#254](https://github.com/beobungbu/BeeUI/issues/254).

Until that publication gate closes, release-ready is not the same as publicly installable:

- do not present `npm install @beemvp/beeui-ui` as an available consumer contract;
- use the repository, packed-package verification, and Showcase as executable evidence;
- treat [`docs/release.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/release.md) as the canonical release procedure;
- use [`CHANGELOG.md`](https://github.com/beobungbu/BeeUI/blob/main/CHANGELOG.md) for recorded changes and [`docs/roadmap.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/roadmap.md) for remaining release work.

## Evidence before claims

BeeUI separates deterministic tests, package/bundle verification, native compilation,
browser/runtime evidence, and live-device evidence. A weaker class of evidence is never
reported as proof of a stronger runtime behavior. Release decisions should therefore be
made from the exact candidate SHA and the evidence classes recorded for that SHA, not from
a prior green run or an inferred platform result.

The repository's release verification entry point is:

```bash
pnpm release:verify
```

The normal engineering gate is:

```bash
pnpm check
```

See the canonical release and native-verification documents for the full gate matrix and
known experimental boundaries.

## Security reporting

Report suspected vulnerabilities **privately** according to
[`SECURITY.md`](https://github.com/beobungbu/BeeUI/blob/main/SECURITY.md). Do not open a
public GitHub issue containing vulnerability details.

For normal bugs, documentation problems, or feature requests, use the public GitHub issue
tracker and include the relevant BeeUI version/SHA, platform, and a minimal reproduction
where possible.

## Maintainer references

- [`CONTRIBUTING.md`](https://github.com/beobungbu/BeeUI/blob/main/CONTRIBUTING.md) — local setup, required gates, architecture invariants, and review discipline.
- [`docs/release.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/release.md) — canonical release procedure and evidence requirements.
- [`docs/native-verification.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/native-verification.md) — native compile/runtime evidence boundaries.
- [`docs/roadmap.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/roadmap.md) — production-readiness roadmap.
