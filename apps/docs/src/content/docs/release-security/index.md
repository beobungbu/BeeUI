---
title: Release & security
description: BeeUI publication state, release channels, security reporting and license.
---

BeeUI `0.86.2-rc.2` is publicly published on npm under the opt-in **`next`** dist-tag. The live registry was last observed (at `0.86.2-rc.1`) resolving **`latest`** to the RC as well; that observation is re-verified after every publish and is not an npm rule. BeeUI's bootstrap publish used `--tag next`, and the mechanism that also produced `latest` has not been established (see [`docs/dist-tag-policy.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/dist-tag-policy.md)). `latest` moves to a real stable version at the first `0.86.2` release.

Use `@next` or pin `@0.86.2-rc.2` while evaluating this release candidate:

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
npx @beemvp/beeui-cli@next --help
```

A green verification matrix, package publication, and stable `latest` promotion are separate release events. The current RC has completed publication; stable `0.86.2` still requires its own release and promotion gates.

The machine-checked channel authority is [`docs/dist-tag-policy.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/dist-tag-policy.md), and the evidence/process authority is [`docs/release.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/release.md).

**Prerequisites:** none — this page states current publication/security facts, it is not a setup step.

## Report a security issue

Do not open a public issue containing vulnerability details. Follow the repository's public
[`SECURITY.md`](https://github.com/beobungbu/BeeUI/blob/main/SECURITY.md) reporting path.
Only the intended public reporting instructions are reproduced here; maintainer/private
response workflows stay out of the website.

BeeUI is MIT licensed; see [`LICENSE`](https://github.com/beobungbu/BeeUI/blob/main/LICENSE).
