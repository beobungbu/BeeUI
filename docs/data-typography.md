# Data typography (code, numeric, and reference semantics)

BeeUI keeps **six semantic text roles** — `caption`, `label`, `body`, `heading`,
`title`, `display` — as the entire size hierarchy. Data typography adds a small
set of **orthogonal, composable features** for technical and numeric content. It
does **not** add a numeric typography scale, and it does **not** force a global
custom font.

Everything here is authored in the canonical source
(`packages/tokens/tokens.json`) and emitted by `scripts/generate-tokens.mjs`. The
generated, typed values live in `@beeui/tokens` (`numericVariants`,
`monoFontFamily`, `fontFamily.mono`) and the CSS utilities in
`@beeui/tokens/theme.css`. Nothing here is hand-edited.

## The two axes

| Need | Express it as | API |
| --- | --- | --- |
| Bigger/smaller/heavier text | one of the six size roles | `<Text variant="…">` |
| Equal-width figures (alignment) | size role **+ tabular feature** | `<Text numeric="tabular">` |
| Reference codes / IDs / technical values | size role **+ mono family** | `<Text family="mono">` |

Features compose with each other and with `tone`, weight, alignment, and color.
They are never size roles themselves.

`family` is deliberately an **opt-in mono feature**, not a two-state family
selector. There is no `family="sans"` prop: omit `family` to preserve/inherit the
normal system/sans typography contract. Exposing a `sans` enum value would imply
that BeeUI can reliably reset an inherited/custom font family across web and
native composition boundaries, which it cannot do without adding a separate
font-reset contract.

## When to use the six roles vs. compose a feature

- **Use a size role** for every piece of text. The role owns font size and line
  height. That decision is unchanged by this document.
- **Add `numeric="tabular"`** only when digits must line up or stay stable:
  aligned amount columns, invoice/transaction tables, KPI tiles, countdown
  timers, OTP/reference digits. Tabular numerals give every figure the same
  advance width, so `1`, `11`, and `111` align and a live counter does not
  shift horizontally as digits change.
- **Add `family="mono"`** only for fixed, machine-style strings where character
  disambiguation helps: reference IDs (`BEE-2026-08-22-0202`), invoice numbers,
  masked account digits, API keys, hashes.
- **Do not** reach for tabular or mono as decoration on ordinary prose.

Prefer composition over new role names. There is intentionally **no `1`–`9`
numeric type scale**: adding one would fragment the six-role contract, multiply
the tokens every component must reason about, and re-introduce the
"pick-a-number" typography that the semantic roles replaced. A recurring
size/weight/line-height intent would justify a *named* role, not an arbitrary
scale — and the finance/table/KPI evidence in the Showcase is satisfied by
`role + feature`, so no new role was added.

## Tabular numerals

```tsx
// Right-aligned amount column — every row lines up on the decimal.
<Text className="text-right" numeric="tabular" variant="label">
  {'-$8,920.00'}
</Text>

// KPI / timer — size role stays `display`, digits stay stable.
<Text numeric="tabular" variant="display">{'$18,420'}</Text>
<Text numeric="tabular" variant="display">{'00:09:42'}</Text>
```

## Mono family (reference codes / IDs)

```tsx
<Text family="mono" variant="body">BEE-2026-08-22-0202</Text>
```

## Web vs. native (documented honestly, not faked parity)

The feature is applied through **two channels** so it renders on every platform:

- **Web** resolves it through generated utility classes:
  - `numeric="tabular"` → `bee-tabular-nums` → `font-variant-numeric: tabular-nums`.
  - `family="mono"` → `font-mono` → `font-family: var(--font-mono)`.
- **Native (iOS/Android)** resolves it through React Native style props, because
  `font-variant-numeric` and font-family utilities are not RN Text style
  properties:
  - `numeric="tabular"` → `style={{ fontVariant: ['tabular-nums'] }}`.
  - `family="mono"` → `style={{ fontFamily: <platform monospace> }}`.

Honest platform differences:

- **Tabular numerals depend on the active font.** iOS system fonts (San Francisco)
  honor `fontVariant: ['tabular-nums']`. On Android, the default system font
  supports tabular figures on modern OS versions; on older devices or a
  substituted font the feature may be a no-op. Headless Chromium can likewise
  accept `font-variant-numeric: tabular-nums` while its substituted font lacks
  usable `tnum` glyphs. The visual regression test therefore measures the
  **tabular cells themselves** and asserts equal-width geometry when the active
  font supports it; otherwise it records an explicit font-capability annotation.
  The mono geometry test is separate evidence for the mono feature and is never
  used as a substitute for tabular behavior.
- **Mono is a fallback stack, not a shipped font.** Web uses
  `ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`.
  Native maps to `Menlo` (iOS) and `monospace` (Android). These are
  platform-provided families. Regression tests assert the keyed iOS and Android
  mappings individually so swapped platform values cannot silently pass.

## Font-loading responsibility

BeeUI **bundles no font binary and forces no global custom font.** `fontFamily.sans`
stays the canonical platform-system token; `fontFamily.mono` is a system fallback
stack. The `Text` component's `family` prop remains mono-only as described above.
If a product wants a specific licensed monospace (or brand) font, the **consuming
app** loads it and maps these families to it (`--font-mono` on web; a font mapping
/ RN `fontFamily` on native). This keeps reusable components brand-blind and keeps
the package free of proprietary font assets.

## Accessibility / font scaling

These features do not touch font size or line height and do not disable Dynamic
Type / OS font scaling. Tabular numerals and the mono family scale with the user's
font-size preference exactly like the underlying size role. Regression tests
also pass explicit `allowFontScaling` / `maxFontSizeMultiplier` props through the
feature combination to guard against future data-typography code mutating those
accessibility controls.

## Runtime-reader note (deferred integration)

The numeric/mono semantics are emitted as ordinary typed exports
(`numericVariants`, `monoFontFamily`) in `@beeui/tokens`. Non-`className`
consumers read the web utility class, the CSS property/value, and the native
`fontVariant`/`fontFamily` values directly from that canonical metadata. This is
the same readable-metadata surface a runtime reader consumes, so it is picked up
without adding a second typography reader.
