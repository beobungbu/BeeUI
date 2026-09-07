---
title: Accessibility model
description: What BeeUI's accessibility contract covers, what it hands to the platform, and what your screen composition still owes.
---

Accessibility in BeeUI is a **behavior contract at the component level plus a deliberate hand-off to the platform** — it is not a certification, and it never covers the composition decisions you make on top.

## Why the concept exists

"Is this library accessible?" is unanswerable as asked. A component can expose a perfect role, label and state and still land in a screen with three `<h1>`-equivalent headings, an unlabelled icon button and a modal that returns focus to nowhere. Conversely, a great deal of accessibility is not the library's to implement at all: text scaling belongs to the OS, and layout direction belongs to the host application.

Splitting the question into three parts — what BeeUI owns, what the platform owns, what you own — makes it answerable, and makes it testable.

## The three-way split

```
┌── you own ────────────────────────────────────────────────────────────┐
│  heading/reading order · modal boundaries in your flows               │
│  labels for your icon-only actions · error copy · focus after routing │
│  setting the app's direction · your own animations                    │
└───────────────────────────────┬───────────────────────────────────────┘
┌── BeeUI owns ─────────────────▼───────────────────────────────────────┐
│  roles · labels/descriptions/state wiring · focus order within a       │
│  component · overlay dismissal + focus restoration per contract        │
│  live-region announcements where the contract requires them            │
│  reading the ambient direction · not blocking font scaling             │
└───────────────────────────────┬───────────────────────────────────────┘
┌── the platform owns ──────────▼───────────────────────────────────────┐
│  Dynamic Type / OS text size · browser zoom · reduced-motion signal    │
│  RTL authority (I18nManager.isRTL, document dir) · the screen reader   │
└───────────────────────────────────────────────────────────────────────┘
```

## Rules and invariants

1. **Use the semantic control, do not wrap it.** Putting a second pressable surface around a BeeUI trigger duplicates the role and breaks keyboard and screen-reader behavior. Put your content *inside* the trigger.
2. **Keep label, control and error associated.** `Field` establishes that association for you; splitting a label away from its control breaks it silently. See [Forms model](/docs/learn/forms-model/).
3. **Text scaling is the platform's, and BeeUI does not fight it.** No BeeUI component disables font scaling on native, and Web typography resolves through `rem`-based custom properties rather than pixel literals — so OS text size and real browser zoom both work by construction. Your fixed heights are what break it.
4. **Direction is read, never forced.** BeeUI resolves an explicit `direction` prop first, then the platform's own authority, then falls back to left-to-right. Setting the application's direction stays yours.
5. **Motion may clarify state; it may never carry it.** Under a reduced-motion preference, decorative animation reduces while state, focus, loading and success/error feedback stay available. Replacing an animation with an invisible state change is a regression, not a fix.
6. **Touch targets are a floor, not a style.** The minimum interactive target holds at every width and in every density mode.
7. **Evidence classes do not substitute for each other.** This is the same rule as the [cross-platform model](/docs/learn/cross-platform-model/), and it matters most here.

## The evidence boundary

| Evidence | Proves | Does not prove |
| --- | --- | --- |
| Deterministic component tests | The documented roles, labels, states and focus contracts | Any live assistive-technology behavior |
| Automated axe-core scans in a pinned Chromium | No automatable violation in the scanned, interacted-with state | Full WCAG conformance, or any non-Chromium engine |
| Native compilation | The code builds for iOS and Android | Nothing about VoiceOver or TalkBack |
| Simulator / device runs of recorded flows | Native assistive-technology behavior for the cases actually executed | Anything outside those cases |

BeeUI never presents an automated scan as certification, and never presents a compile as screen-reader proof. Read a claim as scoped to the class behind it.

## Consequences for application code

- **Your composition is where most real failures live.** Heading and reading order, modal boundaries across a multi-step flow, focus after a route change and the wording of error announcements are all yours — each primitive can be correct while the screen is not.
- **Label every icon-only action.** `IconButton` will expose what you give it and nothing more.
- **Do not hard-code heights around text.** Large text, long localized strings and RTL all change intrinsic size; a fixed row height is an exception that needs a reason.
- **Test with the keyboard, not the pointer.** Real Tab, Shift+Tab and Escape find problems clicks never will.
- **Budget device time for assistive technology.** It is a class-4 question, and it cannot be closed in a browser.

## Common misconception

> "BeeUI is accessible, so my app is accessible."

Component-level correctness is necessary and nowhere near sufficient. The anti-pattern that follows this belief is shipping on a green automated scan: axe-core catches automatable rule violations in one engine, in one rendered state, and a screen can pass it while being unusable with a screen reader.

The second misconception is the opposite reflex — adding `accessibilityRole` and `accessibilityLabel` on top of BeeUI components "to be safe". That usually *overrides* a correct contract with a less correct one. Check the component reference first; add semantics only for content BeeUI cannot see.

## Where to go next

- [Accessibility](/docs/accessibility/) — the task guides that make each rule executable.
- [Keyboard & focus](/docs/accessibility/keyboard-focus/) · [Large text & zoom](/docs/accessibility/large-text/) · [RTL & localization](/docs/accessibility/rtl/) · [Reduced motion](/docs/accessibility/reduced-motion/) · [VoiceOver & TalkBack](/docs/accessibility/native-assistive-tech/)
- [Forms model](/docs/learn/forms-model/) — label, error and announcement wiring.
- [Overlays & runtime ownership](/docs/learn/overlays-and-runtime/) — modal boundaries and focus restoration.
- [Components](/docs/components/) — per-component semantics.

## Source authority

- [`docs/accessibility-contract.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/accessibility-contract.md) — the component-level contract.
- [`docs/keyboard-focus-acceptance-matrix.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/keyboard-focus-acceptance-matrix.md) — keyboard and focus acceptance.
- [`docs/dynamic-type.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/dynamic-type.md) — text scaling.
- [`docs/decisions/004-direction-architecture.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/004-direction-architecture.md) — direction resolution.
- [`docs/voiceover-release-matrix.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/voiceover-release-matrix.md) and [`docs/talkback-release-matrix.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/talkback-release-matrix.md) — native assistive-technology evidence.
