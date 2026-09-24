---
title: Release & security
description: BeeUI publication state, release channels, security reporting and license.
---

BeeUI `0.86.2-rc.2` is publicly published on npm under the opt-in **`next`** dist-tag, and `0.86.2-rc.3` is the current release candidate, published only once the owner approves its staged packages. The live registry was last observed (2026-09-23) resolving **`next`** to `0.86.2-rc.2` and **`latest`** to `0.86.2-rc.1`; dist-tags are re-verified after every publish. During the `0.86.2` prerelease line `latest` follows the newest complete, verified RC only after the owner moves it for all four packages, and it moves to the stable version at the `0.86.2` stable promotion (see [`docs/dist-tag-policy.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/dist-tag-policy.md)).

Use `@next` or pin `@0.86.2-rc.3` while evaluating this release candidate — see [Start](/docs/start/) for the full install command per platform (Expo, bare React Native, Web).

A green verification matrix, package publication, and a `latest` move are separate release events. The current RC candidate is published only after owner approval, `latest` moves only after the owner verifies the complete four-package set, and stable `0.86.2` still requires its own release and promotion gates.

The machine-checked channel authority is [`docs/dist-tag-policy.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/dist-tag-policy.md), and the evidence/process authority is [`docs/release.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/release.md).

**Prerequisites:** none — this page states current publication/security facts, it is not a setup step.

## Report a security issue

Do not open a public issue containing vulnerability details. Follow the repository's public
[`SECURITY.md`](https://github.com/beobungbu/BeeUI/blob/main/SECURITY.md) reporting path.
Only the intended public reporting instructions are reproduced here; maintainer/private
response workflows stay out of the website.

BeeUI is MIT licensed; see [`LICENSE`](https://github.com/beobungbu/BeeUI/blob/main/LICENSE).
