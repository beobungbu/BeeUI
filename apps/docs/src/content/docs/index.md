---
title: BeeUI Docs
description: Build mobile-first React Native interfaces for Expo, bare React Native and Web with BeeUI.
---

BeeUI is a production-oriented React Native UI system with one public behavior contract across
Expo, bare React Native and Web. Packages and the CLI are **not published**; these docs always
separate the stable target API from the distribution actions actually available today.

Use the search box at the top of any page to jump straight to a component, token, CLI command or
error message.

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

- [Current compatibility](/docs/compatibility/current/) — the tested and pinned versions, machine-checked.
- [Migration & versioning](/docs/guides/migration-versioning/) — channel, version authority and what changes at publication.
- [Release & security](/docs/release-security/) — reporting path and source-ownership implications.
- [Accessibility](/docs/accessibility/) · [Responsive](/docs/responsive/) · [Performance](/docs/performance/) · [Architecture](/docs/architecture/)

BeeUI distinguishes evidence classes and never infers a stronger one from a weaker one: type and
contract checks, bundle and native compile, browser interaction, and simulator or device runtime.
Each page states which class backs its claims.

For maintainer contracts, source history and exact evidence records, the public repository remains
the authority: [`docs/`](https://github.com/beobungbu/BeeUI/tree/main/docs).
