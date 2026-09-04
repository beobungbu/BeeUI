---
title: Cross-platform model
description: What shared source guarantees across Web, iOS and Android — and the four classes of evidence that decide what BeeUI actually claims.
---

Shared source means **one component API and one behavior contract across Web, iOS and Android** — it does not mean one implementation, and it never means that evidence gathered on one target transfers to another.

## Why the concept exists

"Write once, run anywhere" quietly turns into "test once, ship anywhere", and that is where cross-platform projects lose weeks. A `Select` that opens correctly in Chromium tells you nothing about whether the Android back button dismisses it. A green iOS compile tells you nothing about whether the sheet swipes closed.

BeeUI therefore separates *what is shared* from *what is proved*, and grades every claim by the class of evidence behind it.

## What shared source actually is

```
                    your code (one import, one API)
                                 │
                 ┌───────────────┼───────────────┐
                 ▼               ▼               ▼
               Web             iOS           Android
                 │               └───────┬───────┘
                 │                       │
        react-native-web           React Native
                 │                       │
      DOM portal transport      teleport transport
```

Most components have exactly one implementation. Where a platform genuinely differs, BeeUI splits the module at the file level and the bundler picks the right one — `.web.tsx` for Web, `.native.tsx` for iOS and Android. Today that split exists for `Sheet`, `Tooltip`, `DatePicker`, `DateTimePicker`, `Table`'s Web surface, and the overlay portal transport.

The important part is what the split does *not* change: the exported name, the props, the types and the documented behavior stay identical. That is the promise. The rendering primitive underneath is not.

## The four evidence classes

| Class | What runs | What it proves | What it never proves |
| --- | --- | --- | --- |
| **1. Type & contract** | TypeScript across the workspace plus deterministic component tests | The public API shape, and the documented behavior under a test renderer | Anything about a real device, a real browser, or a real bundle |
| **2. Bundle & native compile** | Metro bundling, an Android debug build, an `xcodebuild` iOS Simulator compile, and installs through a real packed-tarball package boundary | The candidate source resolves and *builds* for each target | Any runtime interaction at all |
| **3. Browser interaction** | Playwright against a production Web build in a pinned **Chromium**, including automated axe-core scans | Real interaction and keyboard operation on that engine | Firefox, Safari/WebKit, SSR, other bundlers, or any native behavior |
| **4. Simulator & device runtime** | Real iOS Simulator / Android device runs of the interaction smoke cases | Native runtime behavior: insets, keyboard avoidance, dismissal, hardware back, assistive technology | Nothing beyond the cases actually executed |

The classes are ordered by cost and by strength, and **the one rule that matters is that they do not substitute for each other**. Class 2 is not class 4. Class 3 is not class 4. Class 1 is not any of the others.

## Rules and invariants

1. **Never infer a stronger class from a weaker one.** A compile is not a runtime. A passing contract test is not a device proof. When this documentation says a behavior is proved, it means at the class named, not above it.
2. **Web is Chromium-only evidence.** Firefox and Safari/WebKit are not exercised anywhere in this repository, so BeeUI makes no claim about them. Plan your own coverage if you ship to them.
3. **A Web preview cannot validate native interaction semantics.** Browsers report no system insets, hardware back does not exist, and the portal transport is a different primitive. A shell that looks perfect in the browser can be wrong on the first device run.
4. **Peer ranges are narrower than semver would allow.** BeeUI declares support only where evidence exists, so an untested adjacent version is excluded rather than assumed. [Compatibility](/docs/compatibility/) is the machine-checked table.
5. **Experimental means evidence is still owed.** A surface can pass classes 1 and 2 and still be labelled experimental because class 4 has not been collected. The label is a statement about evidence, not about code quality.
6. **Platform splits are internal.** You import from `@beemvp/beeui-ui` and the bundler resolves the variant. Importing a `.web` or `.native` file directly is not a supported API.

## Consequences for application code

- **Write one component, verify on three targets.** Your product code does not branch by platform for BeeUI behavior. It may still branch for genuinely platform-specific product decisions — that is your call, not the library's.
- **Budget device time.** Safe-area edge ownership, keyboard avoidance, sheet dismissal and assistive-technology behavior are class-4 questions. They cannot be closed in a browser.
- **Read the label before you commit.** When a page marks a presentation mode experimental, treat it as a scheduling risk, not a rendering detail.
- **Pin from the matrix.** Take React, React Native, Expo, `react-native-web`, Tailwind and Uniwind versions from [Compatibility](/docs/compatibility/) rather than from semver ranges.

## Common misconception

> "It works on Web, so it works everywhere — the source is shared."

The source being shared is exactly why this is tempting and exactly why it is wrong. Shared source guarantees the *contract*, not the *substrate*: the Web build has no notch, no Android back button, no native modal presentation and no VoiceOver. The anti-pattern that follows is reviewing an entire release from the Web export, then discovering on the first device build that three shell surfaces double-inset and one overlay dismisses the wrong layer.

The mirror-image anti-pattern is over-branching — writing `Platform.OS` checks around BeeUI components to "fix" a difference the component contract already handles. Check the component reference before you branch.

## Where to go next

- [Compatibility](/docs/compatibility/) — the tested version contract, plus the [native](/docs/compatibility/native/) and [Web](/docs/compatibility/web/) evidence boundaries in detail.
- [Accessibility model](/docs/learn/accessibility-model/) — the same evidence grading applied to accessibility claims.
- [Overlays & runtime ownership](/docs/learn/overlays-and-runtime/) — where the transport difference becomes visible.
- [Responsive model](/docs/learn/responsive-model/) — adapting across form factors rather than across platforms.
- [Start](/docs/start/) — Expo, bare React Native and Web paths.
- [Release & security](/docs/release-security/) — what a release gate certifies.

## Source authority

- [`docs/compatibility-matrix.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/compatibility-matrix.md) — the canonical version contract.
- [`docs/native-verification.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/native-verification.md) — what native CI proves.
- [`docs/web-support-contract.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/web-support-contract.md) — the Web support boundary.
- [`docs/native-runtime-smoke.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/native-runtime-smoke.md) — the device/simulator runtime cases.
