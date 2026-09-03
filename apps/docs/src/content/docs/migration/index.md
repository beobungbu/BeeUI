---
title: Migration & versioning
description: Upgrade BeeUI packages, tokens and source-owned components without relying on historical RC state.
---

# Migration & versioning

Read [Current release status](/docs/migration/current-release.generated/) first. It is
generated from the workspace manifest and canonical dist-tag policy.

## Package consumption

BeeUI uses a date-version candidate label in the current repository. Stable/prerelease
dist-tags are controlled by the release policy; packages/CLI remain unpublished until the
owner release gate executes. Do not treat historical RC tarballs as the current candidate.

## Token/API evolution

Deprecations are announced before removal and token removals are guarded by the token
lifecycle/removal checks. Prefer semantic tokens and stable typed component contracts to
engine-specific escape hatches so upgrades remain reviewable.

## Source ownership

A source-owned component is your code after it is added. Upgrading therefore means inspect
upstream changes/diff, decide which changes your fork wants, and run your local tests rather
than blindly overwriting customization.

Sources: [migration guide](https://github.com/beobungbu/BeeUI/blob/main/docs/migration-guide.md), [semver audit](https://github.com/beobungbu/BeeUI/blob/main/docs/semver-audit.md), [token lifecycle](https://github.com/beobungbu/BeeUI/blob/main/docs/token-lifecycle.md), and [dist-tag policy](https://github.com/beobungbu/BeeUI/blob/main/docs/dist-tag-policy.md).
