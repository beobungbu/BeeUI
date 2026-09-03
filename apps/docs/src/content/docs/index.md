---
title: BeeUI
description: >-
  BeeUI is a production-oriented React Native UI system for Expo, bare React Native,
  and Web, with source-grounded accessibility and responsive contracts.
---

BeeUI is a mobile-first React Native UI system written in TypeScript for Expo, bare React Native, and Web. Stable behavior, semantic, and variant APIs are designed so consumers do not need to couple application code to the underlying styling engine.

:::caution[Distribution status]
BeeUI is currently **unpublished**. The repository is public, but no `@beemvp/beeui-*` package or BeeUI CLI should be assumed to resolve from the public npm registry. Evaluate the project through the repository, Showcase, demo, and verified local/packed consumer workflows until the owner opens the publication gate.
:::

## Where to start

- **[Getting started](/getting-started/)** — choose the supported Expo, bare React Native, or Web evaluation/onboarding path.
- **[Showcase & preview](/showcase/)** — inspect the real component and pattern surface on Web and follow the native preview workflow.
- **[Theming](/theming/)** — semantic tokens, branding, light/dark behavior, and density.
- **[Components](/components/)** — public component families, API contracts, and source links.
- **[Patterns](/patterns/)** — production screen patterns composed from BeeUI primitives.
- **[Accessibility](/accessibility/)** — semantics, keyboard/focus, RTL, large text, and evidence limits.
- **[CLI & source ownership](/cli/)** — repository-local Registry/source-ownership workflow while public CLI publication is closed.
- **[Compatibility](/compatibility/)** — tested React Native/React/Node/Expo/Web compatibility.
- **[Migration & versioning](/migration/)** — versioning and migration contracts.
- **[Troubleshooting](/troubleshooting/)** — common setup and runtime failures.
- **[Performance](/performance/)** — benchmark methodology, budgets, and footprint.
- **[Release & security](/release-security/)** — current release state and public security reporting guidance.

## What exists today

The repository contains React Native + TypeScript packages (`@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui`), semantic light/dark tokens, explicit safe-area ownership, responsive primitives, forms and selection controls, navigation/disclosure/overlay/feedback components, data/date-time surfaces, a production Pattern Gallery, a routed reference demo, and a repository-local Registry/source-ownership CLI.

Exact inventory and support claims remain source-driven. The canonical engineering authorities live in `docs/components.md`, `docs/compatibility-matrix.md`, `docs/dist-tag-policy.md`, and the generated component/pattern contracts; public pages summarize those contracts rather than inventing a second truth source.
