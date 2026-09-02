---
title: Use BeeUI with coding agents
description: Give coding agents the canonical BeeUI context and verification boundaries without hidden maintainer knowledge.
---

# Use BeeUI with coding agents

BeeUI publishes a small family of generated text files for coding-agent context. They are model-agnostic and generated from the same public package, Registry, compatibility, component and pattern authorities used by human docs.

## Pick the smallest useful context

| Task | Context |
| --- | --- |
| Understand BeeUI, setup and key invariants | [`/llms.txt`](/llms.txt) |
| Bootstrap or troubleshoot a complete supported consumer | [`/llms-full.txt`](/llms-full.txt) |
| Select/use components and inspect platform/a11y contracts | [`/llms-components.txt`](/llms-components.txt) |
| Compose production-oriented screens from accepted patterns | [`/llms-patterns.txt`](/llms-patterns.txt) |

Start small and add the larger file only when the task needs it. The files are public static assets; the Worker must serve them as plain text without rewriting them to HTML.

## Rules an agent must preserve

- BeeUI is UI infrastructure; routing, data fetching, backend, auth, payments and business rules remain application-owned.
- Public npm packages and the CLI are still unpublished. Do not invent live `npm install` or public `npx` availability.
- Prefer public exports and semantic tokens; do not import private workspace internals.
- Mobile-first responsive behavior, keyboard/focus, RTL, large text and reduced motion are correctness constraints, not optional polish.
- Web preview evidence is Web evidence. Native compile/bundle evidence is not native interaction proof.
- For source ownership, use Registry dependency closure and review `diff`/`update` plans rather than hand-copying arbitrary internals.

## Verification after generation

After an agent changes BeeUI consumer code, run the consumer's typecheck/build/tests and exercise the relevant runtime path. Inside this repository, the canonical regression surfaces include `pnpm llms:check`, `pnpm ai-contract:check`, Registry verification, docs/example checks, and the platform-specific Showcase/consumer gates appropriate to the change.

When setup fails, diagnose the actual boundary first: package/publication state, provider/safe area, Web theme/source scanning, native peer/rebuild, overlay scope, or Registry dependency compatibility. Do not work around failures by reaching into private imports.

## Canonical sources

- [AI-agent development contract](https://github.com/beobungbu/BeeUI/blob/main/docs/ai-agent-cookbook.md)
- [llms generator](https://github.com/beobungbu/BeeUI/blob/main/scripts/generate-llms-txt.mjs)
- [Registry/CLI contract](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md)
- [Architecture](/docs/architecture/)
- [Accessibility](/docs/accessibility/)
- [Responsive guide](/docs/responsive/)
