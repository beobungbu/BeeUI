---
title: BeeUI Docs
description: Build mobile-first React Native interfaces for Expo, bare React Native and Web with BeeUI.
---

BeeUI is a production-oriented React Native UI system with one public behavior contract across
Expo, bare React Native and Web.

The first public release candidate, **`0.86.2-rc.1`**, is published on npm under the opt-in
**`next`** dist-tag. Stable `latest` currently resolves to the same RC too — npm's automatic
first-publish default, not a deliberate promotion (see
[`docs/dist-tag-policy.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/dist-tag-policy.md)).
Use `@next` or the exact RC version in install commands; that stays correct once the stable
`0.86.2` promotion moves `latest` off the prerelease.

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
npx @beemvp/beeui-cli@next --help
```

Use the search box at the top of any page to jump straight to a component, token, CLI command or
error message.

**Prerequisites:** none — this is the entry point. New to BeeUI? Go to [Start](/docs/start/) next.

## What do you want to do?

| I want to… | Go to |
| --- | --- |
| Get BeeUI rendering in my app for the first time | [Start](/docs/start/) — Expo, bare React Native or Web |
| Look up a component's props, types or behavior | [Components](/docs/components/) |
| Copy a whole screen composition | [Production patterns](/docs/patterns/) |
| Achieve a specific outcome — theming, density, tables, dates | [Guides](/docs/guides/) |
| Understand why BeeUI works the way it does | [Learn](/docs/learn/) |
| Find an exact token, symbol, command or Registry item | [Reference](/docs/reference/) |
| Fix an error I am seeing right now | [Troubleshooting](/docs/guides/troubleshooting/) |
| See it running before I commit to anything | [Showcase](/showcase/) · [Demo app](/demo/) |
| Own the source instead of depending on a package | [CLI & source ownership](/docs/guides/cli-source-ownership/) |
| Build against BeeUI with an AI agent | [AI & LLM surfaces](/docs/ai/) |

## The four documentation modes

BeeUI splits documentation by what you need in the moment, so the same subject can appear in more
than one place without contradicting itself.

| Section | Answers | Shape |
| --- | --- | --- |
| [Start](/docs/start/) | "How do I get a first result?" | one verified path per platform |
| [Guides](/docs/guides/) | "How do I achieve X?" | task, action, verification |
| [Learn](/docs/learn/) | "Why does it work this way?" | concept, invariants, consequences |
| [Reference](/docs/reference/) | "What exactly is it called?" | derived from source, never prose-first |

Where a guide and a reference page disagree, the generated reference wins — it is derived from the
package exports themselves.

## Platform and release truth

- **Current RC:** `0.86.2-rc.1` on npm tag `next`.
- **Stable channel:** `latest` currently resolves to the same RC too, by npm's first-publish
  default — not a deliberate promotion. It moves to a real stable version, and never returns
  to a prerelease, at the first `0.86.2` release. See
  [`docs/dist-tag-policy.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/dist-tag-policy.md).
- [Current compatibility](/docs/compatibility/current/) — the tested and pinned versions, machine-checked.
- [Migration & versioning](/docs/guides/migration-versioning/) — channel, version authority and upgrade rules.
- [Release & security](/docs/release-security/) — reporting path and source-ownership implications.
- [Accessibility](/docs/accessibility/) · [Responsive](/docs/responsive/) · [Performance](/docs/performance/) · [Architecture](/docs/architecture/)

BeeUI distinguishes evidence classes and never infers a stronger one from a weaker one: type and
contract checks, bundle and native compile, browser interaction, and simulator or device runtime.
Each page states which class backs its claims.

For maintainer contracts, source history and exact evidence records, the public repository remains
the authority: [`docs/`](https://github.com/beobungbu/BeeUI/tree/main/docs).
