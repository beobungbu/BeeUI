---
title: Guides
description: Task-oriented BeeUI recipes — start with the outcome you want and end with a result you can verify.
---

Use **Guides** when you already know the outcome you want and need the shortest correct path
to it: brand the tokens, choose a density, own the source, upgrade safely, fix a specific
error, or build a table or a date picker properly the first time.

Every guide leads with the answer and puts the evidence underneath it.

## Make it yours

| Guide | Use it when |
| --- | --- |
| [Branding](/docs/guides/branding/) | You need your own palette behind BeeUI's semantic tokens, without forking component source. |
| [Density](/docs/guides/density/) | You need compact, comfortable or spacious layout metrics, and need to know how density composes with theme and responsive behavior. |

## Own and evolve the code

| Guide | Use it when |
| --- | --- |
| [CLI & source ownership](/docs/guides/cli-source-ownership/) | You want the component source inside your repository, and need the exact `init` / `add` / `doctor` / `diff` / `update` contract. |
| [Migration & versioning](/docs/guides/migration-versioning/) | You need to know which channel you are on, what the version number means, and what a future upgrade will and will not do to your code. |
| [Current release](/docs/guides/current-release/) | You need the exact version, channel and distribution state this documentation was generated from. Generated, not hand-written. |

## Build specific surfaces

| Guide | Use it when |
| --- | --- |
| [Table](/docs/guides/table/) | You are building a sortable, selectable, responsive data table and need the state-ownership and performance envelope up front. |
| [Date & time](/docs/guides/date-time/) | You are picking or storing dates and want the timezone, locale, week-start and DST rules before you write the first value. |

## When something is wrong

| Guide | Use it when |
| --- | --- |
| [Troubleshooting](/docs/guides/troubleshooting/) | You have an exact error string, a build that fails, or a screen that renders unstyled. Search the page for your literal console output. |

## Guides, Learn, and Reference

BeeUI splits documentation by the question you are asking:

| Section | Question it answers | Shape |
| --- | --- | --- |
| [Start](/docs/start/) | "How do I get BeeUI running at all?" | A first-success path per platform. |
| **Guides** | "How do I accomplish this task correctly?" | Goal → action → behavior matrix → limitation → evidence. |
| [Learn](/docs/learn/) | "Why is it built this way, and what does that mean for my architecture?" | Concepts and boundaries, not procedures. |
| [Reference](/docs/reference/) | "What is the exact fact?" | Generated or mechanically-checked contracts — props, types, tokens, tested versions. |

If a guide and a generated reference page disagree, the generated page wins: it is derived
from source, and this section is not. Report the guide as the defect.

## Related

- [Theming](/docs/theming/) — the semantic token contract that Branding and Density build on.
- [Components](/docs/components/) — the per-component reference surface.
- [Patterns](/docs/patterns/) — production screen compositions.
- [Compatibility](/docs/compatibility/) — tested versions versus promised peer ranges.
- [Accessibility](/docs/accessibility/) — the behavior contract every guide assumes.

## Canonical sources

- [BeeUI repository](https://github.com/beobungbu/BeeUI)
- [Architecture decision records](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions)
- [Component behavior catalog](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md)
