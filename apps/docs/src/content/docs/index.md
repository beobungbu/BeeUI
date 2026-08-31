---
title: BeeUI
description: >-
  BeeUI is a production-oriented, accessibility-first React Native UI system
  for Expo, bare React Native, and Web.
---

BeeUI is a production-oriented React Native UI system written in TypeScript. It is
mobile-first, framework-light, and designed for long-lived client applications.
Stable behavior, semantic, and variant APIs do not require callers to know the
underlying styling engine.

:::caution[Site status]
This site is being filled in incrementally. Per-component API reference, executable
examples, the production pattern library, and the Web Showcase/native preview workflow are
in place (see [Showcase & preview](/showcase/)); some pages remain stubs pending their
follow-up content and say so explicitly.
:::

## Where to start

- **[Getting started](/getting-started/)** — install BeeUI and choose your platform: Expo, bare React Native, or Web.
- **[Showcase & preview](/showcase/)** — run the real component and pattern surface on Web, and preview it natively on iOS and Android.
- **[Theming](/theming/)** — tokens, branding, and density.
- **[Components](/components/)** — the component catalog, including Table and Calendar/date-time.
- **[Patterns](/patterns/)** — production screen patterns built from BeeUI primitives.
- **[Accessibility](/accessibility/)** — RTL, large text, and assistive-technology behavior.
- **[CLI & source ownership](/cli/)** — the BeeUI registry CLI for source-owned components.
- **[Compatibility](/compatibility/)** — supported React Native/React/Node/Expo/Web versions.
- **[Migration & versioning](/migration/)** — upgrade paths and semver policy.
- **[Troubleshooting](/troubleshooting/)** — common setup and runtime problems.
- **[Performance](/performance/)** — benchmarks, budgets, and footprint.
- **[Release & security](/release-security/)** — release process and how to report vulnerabilities.

## Current foundation

BeeUI currently includes React Native + TypeScript packages (`@beeui/core`, `@beeui/tokens`,
`@beeui/ui`), Uniwind + Tailwind CSS v4 styling, semantic light/dark design tokens, explicit
safe-area ownership, broad layout/typography/form/selection/navigation/disclosure/overlay/feedback
coverage, and a repository-local Registry + source-ownership CLI.

Source of truth for the exact current component inventory and the BeeUI 1.0 release plan lives
in the repository's `docs/components.md` and `docs/roadmap.md`.
