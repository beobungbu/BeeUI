---
title: Large text & zoom
description: Dynamic Type, large text, and 200% zoom behavior.
---

BeeUI does not implement an in-app font-scale override, slider, or preference store. Text
scaling is entirely owned by the platform — iOS/Android Dynamic Type on native, browser
zoom and OS/browser text-size preferences on Web. This is `docs/dynamic-type.md` in the
source repository (BeeUI issue #143).

## The model

- **Native.** React Native's `Text`/`TextInput` scale automatically against the OS
  accessibility text-size setting as long as `allowFontScaling` stays at its default
  (`true`). No BeeUI component sets `allowFontScaling={false}` or reads
  `PixelRatio.getFontScale()` to fork rendering — a repo-wide guard test fails if either
  ever reappears.
- **Web.** Every semantic typography role resolves through a generated, `rem`-based CSS
  custom property, never a literal pixel value. This is what makes BeeUI text respond to
  both the browser's/OS's default text-size preference and to real browser page zoom
  (Cmd/Ctrl `+`/`-`, pinch-zoom) — two separately verified scaling paths that a
  `rem`-based, non-pixel-hardcoded surface passes through by construction, without a
  BeeUI-specific zoom mechanism.

BeeUI's audited stress range is `1x` (system default) through `2x` — a representative iOS
accessibility step and Android's practical font-scale ceiling on most OEM skins. BeeUI
does not claim coverage above `2x`.

## Wrapping vs. truncation

Text wraps by default everywhere. Every intentional exception — a single-line combobox
value, a bounded multiline textarea viewport — is documented with an exact expected
occurrence count in `docs/dynamic-type.md`'s truncation-points table, and a regression
test fails if a new, undocumented truncation point is introduced anywhere in
`packages/ui/src/components`.

Fixed-height rows on text-bearing controls are treated the same way: every fixed (non-
growable) height class in the component set is either a decorative/glyph-only control that
carries no caller text, or an explicit, occurrence-tracked allow-list entry with a stated
rationale — never a silent clipping risk.

## Minimum hit targets

The 44px native touch-target guard on compact controls, list rows, and Table's sort
trigger is a static class, not a scale-dependent computation, so it does not regress under
font scaling at any audited level.

## Evidence

BeeUI's Dynamic Type contract has three separately obtained evidence classes, kept
honestly distinct: a deterministic Jest/RNTL contract (policy/guard proof — no opt-outs,
every truncation/fixed-height exception documented and occurrence-tracked), real Chromium
Playwright measurements against the live Showcase Web build (root font-size and CSS
`zoom`, measured separately), and real Android emulator evidence (the OS `font_scale`
setting is actually changed, the app cold-relaunches, and real rendered accessibility-node
bounds are captured at each scale). The full evidence breakdown, including what each class
does and does not prove, lives in `docs/dynamic-type.md`.

## Known gaps

Localized/long-content stress testing beyond BeeUI's existing stress-length Latin-script
fixtures (CJK text, long translated strings, complex-script line breaking) is tracked
separately and remains open (BeeUI issue #144).
