# ADR-008: Date/time architecture (Calendar / DatePicker / DateTimePicker)

Status: Accepted

## Context

Issue #171 (R4F.1, parent #114) requires locking the architecture for `Calendar`,
`DatePicker`, and `DateTimePicker` before any of #172–#178 implement them. None of the
three components exist in the source tree yet (`packages/ui/src/components` has no
`calendar.tsx`/`date-picker.tsx`/`date-time-picker.tsx`), and no date/time library is a
dependency anywhere in the repo (`packages/*/package.json`, `apps/showcase/package.json`
declare no `date-fns`/`dayjs`/`luxon`/similar). This is a greenfield decision, not a
refactor of existing behavior.

The child issues already fix most of the *shape* of the contract:

- #172 (Calendar): controlled selected date, visible month/navigation, min/max, disabled
  dates, today state, locale labels + configurable/locale-derived week start,
  single-date selection only for 1.0 ("range/multiple selection is out unless explicitly
  promoted"), RTL/large-text, semantic theming, "no timezone-induced date-only drift".
- #173 (DatePicker): controlled selected value, controlled/uncontrolled open state "if
  BeeUI owns presentation", placeholder/formatted display, clear policy, `Field`
  integration, Web keyboard Calendar navigation, native presentation policy, focus
  restoration and Escape/Back dismissal.
- #174 (DateTimePicker): "date part + time part with one coherent controlled value
  model", locale/config-driven 12/24h display, native platform picker integration
  "where appropriate", Web accessible time-selection policy, Field integration,
  timezone boundary assumptions must be explicit.
- #175 (i18n/timezone matrix): Vietnamese/English/Arabic-RTL/CJK locales, Sunday/Monday
  week starts, 12/24h, DST boundaries for time values, "date-only values that must not
  shift day through timezone conversion"; "do not bundle a huge locale database without
  evidence"; timezone storage/business rules stay application-owned.
- #176/#177/#178: component-local a11y/keyboard, visual/native runtime acceptance, and
  registry/docs/AI metadata — all downstream of this ADR.

BeeUI already has two directly reusable, accepted precedents this ADR must not
duplicate rather than reinvent:

- **Anchored-overlay geometry/runtime** (`docs/anchored-overlays.md`,
  `docs/architecture.md:134-217`): `@beeui/core`'s pure `resolveAnchoredOverlayPosition()`
  plus `@beeui/ui`'s `Popover`/`DropdownMenu`/`overlay-runtime.tsx` already solve
  trigger-anchored measurement, flip/shift, safe-area/keyboard collision, dismiss-stack
  ordering, and portal transport. A picker calendar surface is exactly this problem
  shape.
- **Stateless ambient resolver, no second state engine** (ADR-004,
  `docs/decisions/004-direction-architecture.md`; `packages/ui/src/components/
  use-direction.ts`): `resolveDirection(explicit?)` — explicit prop wins, else a
  documented platform ambient authority, else a static fallback, re-read on every call,
  no `React.createContext`/store/observer. This is the shape any locale/week-start
  resolver in this ADR must follow.

`Field` (`packages/ui/src/components/field.tsx`, `field-context.ts`) and `Input`
(`packages/ui/src/components/input.tsx:52-84`) already establish the accepted
Field-integration contract: a form control reads `useFieldContext()` for
`disabled`/`invalid`/`error`/`description`/`label`/`required`/`labelNativeID`, ORs its
own `disabled`/`invalid` props with the field's, and does not own a second validation
engine. There is no third-party date library, no native system date/time picker
dependency, and no `Intl`-based locale helper anywhere in the source tree today — all
three are new decisions this ADR must make, not existing behavior to preserve.

## Constraints

- **Platform**: iOS, Android (bare RN + Expo), and Web (Expo Web / `react-native-web`)
  must all present a coherent public value contract; native and Web have no shared
  native-system-picker primitive.
- **No backend timezone/business-calendar ownership** (hard, from #171/#175): BeeUI must
  not store, infer, or apply a timezone, and must not implement business-calendar rules
  (holidays, fiscal calendars, working-day rules). BeeUI owns UI/interaction/value
  contracts only.
- **No date-only day-shift** (hard, from #171/#175): a date-only value must never change
  calendar day because of an implicit UTC/local timezone conversion. This is the single
  most common real-world bug class for date pickers (`new Date('2026-01-15')` parses as
  UTC midnight and can print as `2026-01-14` in a negative-UTC-offset timezone) and this
  ADR treats eliminating it structurally, not by convention, as non-negotiable.
- **No second global state engine** (carried over from ADR-004/#139): any ambient
  locale/week-start/direction read must be a stateless resolver — explicit prop, then a
  documented ambient authority, then a static fallback — never a new context/store/
  subscription.
- **No huge locale database** (#175): month/weekday/12-24h label formatting must use the
  JS engine's built-in `Intl` rather than bundling CLDR data.
- **Reuse, don't duplicate, existing overlay/direction/Field authorities**: geometry,
  dismissal, portal transport, RTL resolution, and Field/validation wiring are already
  solved; this ADR must route through them, not reimplement them.
- **Package boundary** (`docs/architecture.md:41-47`): `@beeui/core` has zero React/
  React Native dependency and must stay that way; any RN-specific or `Intl`-ambient-
  platform-read code belongs in `@beeui/ui`.
- **Dependency discipline** (`docs/compatibility-matrix.md`): any new runtime dependency
  must be bounded, justified, and later given its own tested-version row — this ADR may
  decide *that* a dependency is introduced, but the exact tested version/compatibility
  row is implementation's job (#172/#173), not this ADR's.
- **1.0 scope**: single-date selection only (#172); no range/multiple selection; no
  Slider-style time wheel (#163 already rejected a partial Slider).
- **Non-goal**: this ADR does not design Table (#164, separate ADR) and does not decide
  Sheet's own gesture/dependency contract (#156/#157, authored in parallel, out of
  scope here — referenced only as a possible future presentation).

## Options considered

### A. Public value representation

#### A1 — Native `Date` for every value (date-only and date-time alike)

- **Design summary**: `Calendar`/`DatePicker` use `value: Date | null`; `DateTimePicker`
  also uses a single `Date`.
- **Benefits**: zero new types; every JS developer already knows `Date`; trivially
  interoperable with most existing form/backend code that already expects `Date`.
- **Risks/tradeoffs**: this is the exact defect class the issue calls out. A date-only
  `Date` has no honest "no time zone" representation — it is always a specific instant,
  so serializing/deserializing it (JSON has no `Date` type; `toISOString()` is always
  UTC) or constructing it from a naive `YYYY-MM-DD` string (`new Date(str)` parses as
  UTC midnight, not local midnight) reintroduces the exact day-shift bug across any
  negative-UTC-offset timezone. The type system cannot distinguish "this `Date` means a
  calendar day" from "this `Date` means an instant" — every consumer must remember a
  convention by hand.
- **Web/iOS/Android implications**: identical risk on all three; `Date` behaves the same
  everywhere, which is precisely the problem — there is no platform-specific mitigation.
- **Dependency/package/registry impact**: none additional.
- **Accessibility/RTL/large-text/reduced-motion impact**: neutral — value representation
  does not affect a11y directly.
- **Migration/semver impact**: none (greenfield), but locking this in for 1.0 would make
  the day-shift bug a permanent, uncorrectable-without-a-breaking-change public contract.
- **Testing/runtime evidence required**: would need exhaustive timezone-offset fixtures
  per #175 to prove the bug is *avoided by convention* everywhere it is used, which is
  strictly weaker evidence than a type that cannot express the bug.
- **Rejected**: fails the hard "no date-only day-shift" constraint by construction.

#### A2 — ISO date-only string primary representation (`"YYYY-MM-DD"`), `Date` for time

- **Design summary**: `Calendar`/`DatePicker` value is a plain ISO date-only string.
  `DateTimePicker` composes that string with a separate `"HH:mm"` string, or promotes to
  `Date` only at the point a full instant is genuinely needed.
- **Benefits**: directly serializable/comparable/sortable as a string; trivial backend
  interop (most REST/JSON date-only fields already use this format); no new object
  shape to learn.
- **Risks/tradeoffs**: still string-typed, so nothing stops a consumer (or an internal
  BeeUI helper written incorrectly later) from round-tripping it through
  `new Date(isoString)` and reintroducing the exact UTC-midnight bug this ADR must
  prevent — the safety is a documented convention ("never parse this with the `Date`
  constructor"), not a type-level guarantee. Arithmetic (add/subtract a day, compare,
  clamp to min/max, generate a month grid) requires parsing the string on every
  operation. Composing a date string with a time string into "one coherent controlled
  value model" (#174's explicit requirement) is more awkward than a single object.
- **Web/iOS/Android implications**: symmetric; no platform divergence.
- **Dependency/package/registry impact**: none additional.
- **Accessibility/RTL/large-text/reduced-motion impact**: neutral.
- **Migration/semver impact**: none (greenfield).
- **Testing/runtime evidence required**: parser/formatter round-trip tests, plus tests
  proving no internal helper ever uses `new Date(isoString)`/`Date.parse`.
- **Not selected as the primary type, adopted as the serialization adapter** (see
  Decision) — its interop benefit is real but does not require it to be the primary
  in-memory prop type.

#### A3 — Typed plain-object value contract (`CalendarDate` / `ClockTime`), selected

- **Design summary**: BeeUI defines its own small, timezone-free structural types:
  `CalendarDate = { year: number; month: number /* 1–12 */; day: number /* 1–31 */ }`
  and `ClockTime = { hour: number /* 0–23 */; minute: number /* 0–59 */ }`.
  `Calendar`/`DatePicker` use `CalendarDate | null`. `DateTimePicker` uses
  `{ date: CalendarDate; time: ClockTime } | null`. Conversion to/from ISO strings and
  to/from `Date` are explicit, documented adapter functions in `@beeui/core`, never
  implicit.
- **Benefits**: the "no time zone" property is structural — the type itself has no field
  that could carry an offset, so it is impossible to accidentally serialize/deserialize
  through a timezone-sensitive path without going through an explicit, named,
  independently testable adapter. Arithmetic/comparison/clamping is direct field
  comparison, not repeated string/Date parsing. Composing date + time into one value for
  DateTimePicker (#174's requirement) is a plain nested object, not string
  concatenation. Mirrors BeeUI's own precedent of small explicit types over
  ambient-JS-built-in footguns (the same posture ADR-004 takes toward `I18nManager`/DOM
  `dir` — read narrowly, forward explicitly, never lean on an ambiguous built-in for
  correctness).
- **Risks/tradeoffs**: one new pair of types for consumers to learn instead of reusing
  `Date`; requires explicit adapters at every real interop boundary (backend payloads,
  existing `Date`-based app state) — treated as a benefit here (forces the timezone
  decision to be visible), but it is more code than "just use `Date`".
- **Web/iOS/Android implications**: symmetric; the type has no platform dependency
  (lives in `@beeui/core`, zero React/RN dependency, consistent with
  `docs/architecture.md:41-47`).
- **Dependency/package/registry impact**: none — no new runtime dependency for the type
  itself; pure data + pure functions.
- **Accessibility/RTL/large-text/reduced-motion impact**: neutral directly; indirectly
  positive because deterministic values make deterministic a11y-state tests (#176)
  straightforward (no ambient-timezone flakiness in "today"/"disabled" computation).
- **Migration/semver impact**: none (greenfield); this becomes the frozen 1.0 public
  value contract, so getting it right now is exactly this ADR's job.
- **Testing/runtime evidence required**: deterministic unit tests for month-grid
  generation, comparison, clamping, leap-year/month-length edge cases, ISO adapter
  round-trips, and explicit `Date` adapter tests proving local-wall-clock construction
  (never `Date.UTC`/ISO-`Z`-parsing) for date-only values.
- **Selected.**

### B. Locale / week-start ownership

#### B1 — Ambient device-locale auto-detection (mirror ADR-004's direction resolver exactly)

- **Design summary**: read a device/browser locale identifier ambiently (Web:
  `navigator.language`; native: undocumented `NativeModules.SettingsManager.settings.
  AppleLocale`/`AppleLanguages` on iOS, `NativeModules.I18nManager.localeIdentifier` on
  Android) as the default `locale`, with an explicit prop as override, mirroring
  `resolveDirection()`'s precedence exactly.
- **Benefits**: "just works" without the host app passing a `locale` prop; maximal
  symmetry with the accepted ADR-004 shape.
- **Risks/tradeoffs**: unlike `I18nManager.isRTL` (a stable, documented, purpose-built RN
  core API), there is no equivalently stable, documented, cross-platform-symmetric
  native locale-identifier primitive in bare React Native core — the `NativeModules.
  SettingsManager`/`I18nManager.localeIdentifier` pattern is a widely-used but
  undocumented internal-API convention (this is precisely why `expo-localization`
  exists as a separate package). Depending on it would mean BeeUI's locale defaults rest
  on unstable ground, contradicting #175's "BeeUI behavior must be deterministic".
  It also duplicates i18n ownership the host application already has: any app
  integrating Calendar/DatePicker already resolves its own UI locale for its own
  strings (react-intl/i18next/etc.), so re-detecting it ambiently inside BeeUI is
  redundant work, not a missing capability.
- **Web/iOS/Android implications**: asymmetric evidence quality — Web's
  `navigator.language` is a stable documented API, native's equivalent is not.
- **Dependency/package/registry impact**: none additional, but the undocumented
  `NativeModules` reads are a latent compatibility risk not covered by any existing
  compatibility-matrix row.
- **Accessibility/RTL/large-text/reduced-motion impact**: neutral.
- **Migration/semver impact**: none (greenfield).
- **Testing/runtime evidence required**: would need native runtime evidence per RN
  version/OS that the undocumented locale reads remain stable — an open-ended
  maintenance burden with no corresponding documented contract to test against.
- **Rejected**: the ambient-read primitive it depends on is not equivalently
  trustworthy to `I18nManager.isRTL`, so mirroring ADR-004's shape here would import its
  benefits without its evidentiary basis.

#### B2 — Explicit-only `locale` prop, `Intl`-derived week-start when locale is given, static fallback otherwise — selected

- **Design summary**: `locale?: string` (BCP-47 tag) is an explicit prop only, with a
  static `'en-US'` fallback when omitted — no ambient device/browser locale
  auto-detection. `weekStartsOn?: 1 | 2 | 3 | 4 | 5 | 6 | 7` (ISO 8601 / `Intl`
  `weekInfo` convention: `1` = Monday … `7` = Sunday) follows the same precedence used
  throughout BeeUI: explicit prop wins; else derived from the explicit `locale` prop via
  `Intl.Locale(locale).getWeekInfo?.().firstDay` when the runtime supports it (feature-
  detected, not assumed); else a static Monday (`1`) fallback. Month/weekday/AM-PM
  display labels use `Intl.DateTimeFormat(locale, {...})`, never a bundled locale table.
- **Benefits**: fully deterministic and host-controlled (#175's explicit requirement);
  zero new ambient-read surface, zero new dependency, zero bundled locale database;
  reuses a capability the host app already owns (its own resolved UI locale) instead of
  re-deriving it; `Intl` feature-detection means graceful, testable degradation instead
  of relying on an unverified engine capability.
- **Risks/tradeoffs**: a host app that passes no `locale` gets `en-US`/Monday-start
  defaults even if the device is, say, Vietnamese or Arabic — the app must pass `locale`
  itself for locale-correct rendering. This is treated as correct, not a gap: the app
  already owns this decision for every other piece of UI text.
- **Web/iOS/Android implications**: symmetric — the resolver logic is pure JS/`Intl`
  with no platform branch at all (unlike direction, which genuinely differs by
  platform).
- **Dependency/package/registry impact**: none.
- **Accessibility/RTL/large-text/reduced-motion impact**: neutral; determinism makes
  #175's locale/week-start fixture matrix reproducible.
- **Migration/semver impact**: none (greenfield).
- **Testing/runtime evidence required**: unit tests for the `weekStartsOn` precedence
  (explicit / `Intl`-derived / fallback) with `Intl.Locale.prototype.getWeekInfo`
  feature-detection mocked both present and absent; `Intl.DateTimeFormat` label
  round-trip tests for the #175 locale set (Vietnamese, English, Arabic, one CJK
  locale); a compatibility-matrix follow-up (owned by #175) confirming
  `Intl.Locale.prototype.getWeekInfo` availability on the tested Hermes/JSC/V8 rows
  rather than assuming it.
- **Selected.**

### C. Native system picker vs. custom `Calendar` responsibility

#### C1 — `Calendar` always custom, `DatePicker`/`DateTimePicker` always render `Calendar` in a BeeUI overlay on every platform

- **Design summary**: no native system picker dependency at all; native platforms get
  the same custom grid as Web, presented in a BeeUI overlay everywhere.
- **Benefits**: one visual/interaction implementation to test and theme; no new native
  dependency; perfectly consistent cross-platform look.
- **Risks/tradeoffs**: throws away free, OS-maintained accessibility (VoiceOver/
  TalkBack semantics, correct locale calendar system, correct DST-aware time entry),
  and diverges from the platform-native selection UX users expect on iOS/Android —
  exactly the "native presentation policy" #173/#174 ask for, and the "VoiceOver/
  TalkBack traversal on native" bar #176 sets is materially harder to clear with a
  hand-rolled grid than with the OS's own picker.
- **Web/iOS/Android implications**: no platform divergence, but at the cost of
  reinventing already-solved native a11y/locale/DST behavior.
- **Dependency/package/registry impact**: smallest possible (none), but forfeits the
  "native system picker" half of the decision #171 explicitly asks this ADR to make.
- **Accessibility/RTL/large-text/reduced-motion impact**: negative relative to C2 — a
  custom grid must independently reimplement everything the OS picker gives for free.
- **Migration/semver impact**: none (greenfield).
- **Rejected**: does not satisfy #171's explicit "native system picker vs. custom
  Calendar responsibilities" decision requirement — it answers by declining to use a
  native picker anywhere, forfeiting real, already-solved a11y/locale/DST correctness
  for no corresponding benefit.

#### C2 — `Calendar` always custom (standalone use); `DatePicker`/`DateTimePicker` present the custom `Calendar` inside `Popover` on Web, and the platform's native system picker on iOS/Android — selected

- **Design summary**: `Calendar` is one cross-platform custom grid implementation (no
  platform file split) used directly whenever an application composes it standalone
  (e.g., an inline calendar in a dashboard). `DatePicker`/`DateTimePicker` add a
  presentation layer on top: on Web, they open BeeUI's own `Calendar` inside `Popover`
  (reusing the accepted anchored-overlay/dismiss/focus contract, `docs/
  anchored-overlays.md`); on iOS/Android, they delegate the actual date/time selection
  UI to the platform's native system picker component
  (`@react-native-community/datetimepicker`), converting its native output back into
  BeeUI's `CalendarDate`/`ClockTime` value contract at the boundary.
- **Benefits**: `Calendar` — the component #172 actually specifies as a full custom grid
  with its own keyboard/a11y/theming contract — gets exactly that, once, reused
  identically for standalone use and for the Web picker surface (DRY: the Web picker
  does not invent a second grid). `DatePicker`/`DateTimePicker` on native get the OS's
  own accessibility semantics, locale-correct calendar rendering, and DST-aware time
  entry for free, matching #173/#174's "native presentation policy"/"native platform
  picker integration where appropriate" language directly. The public value contract
  (`CalendarDate`/`ClockTime`) stays identical across platforms even though the
  rendered picker UI differs — the explicit, agent-execution-contract-sanctioned kind of
  platform divergence ("Web/iOS/Android behavior may differ when platform-honest, but
  public contracts must remain coherent").
- **Risks/tradeoffs**: `DatePicker`/`DateTimePicker`'s on-screen appearance genuinely
  differs between Web and native — this must be documented, not treated as a bug;
  `@react-native-community/datetimepicker` becomes a new dependency requiring its own
  compatibility-matrix row and native compile/runtime evidence.
- **Web/iOS/Android implications**: intentional, documented divergence at the
  `DatePicker`/`DateTimePicker` presentation layer only; `Calendar` itself has zero
  platform divergence.
- **Dependency/package/registry impact**: one new peer dependency
  (`@react-native-community/datetimepicker`) in `@beeui/ui`, following the exact
  existing pattern for `react-native-safe-area-context`/`react-native-teleport`
  (`packages/ui/package.json`): exact-pinned `devDependency`, ranged `peerDependency`,
  new compatibility-matrix row owned by the implementing issue (#172/#173), not this
  ADR. The native-only import must not leak into the Web bundle (see Decision,
  "Platform-file split").
- **Accessibility/RTL/large-text/reduced-motion impact**: positive on native (OS-owned
  a11y semantics); Web keeps BeeUI's own tested RTL/large-text/keyboard `Calendar`
  contract inside `Popover`.
- **Migration/semver impact**: none (greenfield).
- **Testing/runtime evidence required**: deterministic tests for the `CalendarDate`/
  `ClockTime` ⇄ native-`Date` boundary adapter (local-wall-clock construction only);
  native iOS/Android runtime evidence that the native picker opens, returns a value, and
  round-trips without day/time shift (#177); Web deterministic + browser-interaction
  evidence for the `Calendar`-in-`Popover` path (#175/#176/#177).
- **Selected.**

### D. Web presentation surface: `Popover` vs. `Dialog` vs. deferred `Sheet`

#### D1 — Automatic viewport-based switching between `Popover` and `Dialog`

- **Design summary**: `DatePicker`/`DateTimePicker` pick `Popover` on wide viewports and
  automatically fall back to `Dialog` below a breakpoint.
- **Benefits**: could give a more "native app" feel on narrow Web viewports.
- **Risks/tradeoffs**: introduces untested branching complexity and a new implicit
  responsive contract with no existing BeeUI precedent (`Select`/`DropdownMenu` do not
  do this today); doubles the dismiss/focus/keyboard test matrix (#176/#177) for a
  behavior no child issue actually requires.
- **Web/iOS/Android implications**: Web-only complexity with no native equivalent
  decision to mirror.
- **Dependency/package/registry impact**: none additional.
- **Accessibility/RTL/large-text/reduced-motion impact**: neutral if done correctly, but
  raises the a11y/keyboard/focus-restoration surface to verify at two breakpoints
  instead of one.
- **Migration/semver impact**: none (greenfield), but harder to simplify later once
  shipped as a public default.
- **Rejected**: violates YAGNI/KISS — no child issue asks for viewport-based
  presentation switching, and it multiplies the runtime/a11y evidence surface (#176/
  #177) without a stated requirement driving it.

#### D2 — `Popover` as the sole default Web presentation for the picker surface; `Sheet` referenced as a future non-default option — selected

- **Design summary**: `DatePicker`/`DateTimePicker` open their `Calendar` content inside
  `Popover` on Web at every viewport width, reusing the same anchored-overlay/dismiss/
  focus contract `Select`/`DropdownMenu` already use for trigger-anchored form controls.
  `Dialog` remains available as a general BeeUI primitive an application can compose
  around `Calendar` itself for a fully custom flow (e.g., a "jump to date" wizard), but
  `DatePicker`/`DateTimePicker`'s own public API does not switch to it automatically. If
  #156/#157 land an accepted `Sheet` before #172–#174 implement, the native-parity
  question of "should the *Web* picker prefer a bottom-sheet-style presentation on
  narrow viewports" becomes a legitimate follow-up decision for whichever issue
  implements it — this ADR does not block on, or assume the outcome of, #156/#157, and
  does not mandate `Sheet` adoption.
- **Benefits**: one well-tested, already-accepted presentation contract (no new dismiss/
  focus/keyboard behavior to invent); matches the existing `Select`/`DropdownMenu` UX
  precedent for compact form-control overlays; keeps the #171 decision surface small
  (YAGNI) while leaving an explicit, named door open for `Sheet` later instead of
  silently ignoring it.
- **Risks/tradeoffs**: a very narrow Web viewport gets a `Popover`, not a full-screen
  sheet-like experience — acceptable for 1.0 given no child issue requires otherwise.
- **Web/iOS/Android implications**: Web-only decision; native already uses the system
  picker (Decision C2), so this section governs Web exclusively.
- **Dependency/package/registry impact**: none beyond the already-accepted `Popover`.
- **Accessibility/RTL/large-text/reduced-motion impact**: inherits `Popover`'s existing,
  already-tested topmost-dismissal/Escape/outside-press/RTL contract.
- **Migration/semver impact**: none (greenfield).
- **Testing/runtime evidence required**: reuses `Popover`'s existing deterministic +
  browser-interaction test contract; #177 supplies representative narrow/large/tablet/
  desktop Web fixtures without requiring new presentation-switching logic.
- **Selected.**

## Decision

BeeUI 1.0 adopts, for `Calendar`, `DatePicker`, and `DateTimePicker`:

### Primitive split and shared internals

- **`@beeui/core`** (new module, e.g. `packages/core/src/utils/calendar-date.ts`, zero
  React/RN/DOM dependency, mirroring `anchored-overlay.ts`'s existing purity) owns:
  - the `CalendarDate`/`ClockTime` types (see below);
  - pure Gregorian calendar arithmetic: month-grid generation (given a month/year and a
    `weekStartsOn`), day-of-week, leap-year/month-length handling, comparison, clamping
    to `min`/`max`, and disabled-predicate evaluation;
  - the explicit ISO-string and `Date` adapter functions (see below).
  - **Implementation guardrail**: if any internal arithmetic is implemented via `Date`
    (e.g. epoch-day counting), it must exclusively use UTC-anchored construction
    (`Date.UTC(y, m - 1, d)`) for that internal math and must never construct via the
    local-timezone `Date` constructor or parse an ISO string for calendar arithmetic —
    the one adapter function documented below is the sole place a date-only value may
    become a local-timezone-bearing `Date`.
- **`@beeui/ui`** owns:
  - `Calendar` — one cross-platform (no platform-file split) custom grid: rendering,
    keyboard/a11y, RTL, theming, month navigation, today/disabled/selected states.
  - Stateless `locale`/`weekStartsOn` resolvers (e.g. co-located with `Calendar`,
    mirroring `use-direction.ts`'s shape: explicit-input, pure-function, unit-testable,
    no context/store).
  - `DatePicker` — `Field`-integrated trigger + platform-split presentation layer
    (`date-picker.web.tsx` / `date-picker.native.tsx`, mirroring the existing
    `overlay-transport.web.tsx`/`.native.tsx` platform-file pattern so the native-only
    `@react-native-community/datetimepicker` import never reaches the Web bundle): Web
    renders `Calendar` inside `Popover`; native delegates to the system picker and
    converts its result back into `CalendarDate`.
  - `DateTimePicker` — composes `DatePicker`'s date part with a time part into one
    `{ date: CalendarDate; time: ClockTime }` controlled value; native time entry
    delegates to the same native system picker (`mode="time"`/`"datetime"`); Web time
    entry is a minimal control built from existing accepted primitives (`Input`
    digit-entry for hour/minute plus `SegmentedControl` for AM/PM when the resolved
    locale's `Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12`
    is `true`) — no new bespoke time-wheel component, consistent with #163's rejection
    of a partial `Slider`.

### Public value representation

- `CalendarDate = { year: number; month: number /* 1–12 */; day: number /* 1–31 */ }` —
  a plain, timezone-free calendar-day value. This is the `Calendar`/`DatePicker`
  controlled value type (`value: CalendarDate | null`).
- `ClockTime = { hour: number /* 0–23 */; minute: number /* 0–59 */ }` — a plain,
  timezone-free wall-clock value.
- `DateTimePicker`'s controlled value is `{ date: CalendarDate; time: ClockTime } | null`
  — one coherent object, not two independently-controlled props, satisfying #174's "one
  coherent controlled value model".
- **Serialization adapter** (`@beeui/core`): `toISODateString(date: CalendarDate):
  string` / `parseISODateString(iso: string): CalendarDate | null` for interop with
  backends/forms that expect `"YYYY-MM-DD"`. `parseISODateString` splits the string on
  `-` and constructs the `CalendarDate` fields directly — it never calls `new
  Date(iso)`/`Date.parse`, so it cannot inherit the UTC-midnight parsing bug.
- **`Date` interop adapter** (`@beeui/core`, explicit and opt-in only): `toLocalDate
  (date: CalendarDate, time?: ClockTime): Date` constructs via the local-timezone `Date`
  constructor (`new Date(year, month - 1, day, time?.hour ?? 0, time?.minute ?? 0)`),
  never `Date.UTC`/ISO-`Z` parsing — so a date-only value converted for interop always
  lands on local midnight of that same calendar day, never shifted. `fromLocalDate
  (date: Date): CalendarDate` reads `getFullYear()`/`getMonth()`/`getDate()` (local
  getters), for the reverse direction. Both are named, documented, independently unit
  tested, and are the *only* sanctioned `CalendarDate ⇄ Date` boundary in BeeUI. If a
  host application needs a specific IANA timezone that is not the device's local
  timezone, composing that conversion is the application's responsibility — this is the
  concrete form the "BeeUI must not own backend timezone storage or business-calendar
  rules" constraint takes for this adapter.
- **1.0 non-goal**: no `CalendarDateRange`/multi-select value type — #172 explicitly
  scopes single-date selection only for 1.0.

### Timezone ownership boundary

BeeUI never stores, infers, or writes a timezone. `CalendarDate`/`ClockTime` carry no
timezone field by construction. The only place a timezone-bearing value (`Date`) is
produced is the explicit `toLocalDate`/`fromLocalDate` adapter pair above, always
interpreted as the device's local wall-clock time. Backend storage timezone (e.g. UTC),
business-calendar rules, and any non-local-timezone interpretation are exclusively the
host application's responsibility, consistent with `docs/agent-execution-contract.md`'s
existing "router/data fetching/backend/auth/payment/form-library ownership stays
outside BeeUI" boundary, extended here to timezone/business-calendar ownership.

### Locale / week-start ownership

- `locale?: string` is an **explicit-only** prop on `Calendar`/`DatePicker`/
  `DateTimePicker`; there is no ambient device/browser locale auto-detection (see
  Option B1, rejected). Omitted `locale` falls back to the static constant `'en-US'`.
- `weekStartsOn?: 1 | 2 | 3 | 4 | 5 | 6 | 7` (ISO 8601 / `Intl` `weekInfo` convention —
  `1` = Monday … `7` = Sunday) precedence: explicit prop, then
  `Intl.Locale(locale).getWeekInfo?.().firstDay` when `locale` was explicitly provided
  and the runtime supports `getWeekInfo` (feature-detected), then a static Monday (`1`)
  fallback.
- Month/weekday/AM-PM display labels use `Intl.DateTimeFormat(locale, {...})` exclusively
  — no bundled locale table, satisfying #175's "do not bundle a huge locale database"
  constraint.
- No new React context/store/observer is introduced for locale or week-start, consistent
  with the ADR-004 hard invariant this ADR extends to the date/time domain.

### Native system picker vs. custom `Calendar` responsibilities

- `Calendar` is always BeeUI's own custom grid, on every platform, for every use
  (standalone and inside `DatePicker`'s Web presentation).
- `DatePicker`/`DateTimePicker` on iOS/Android delegate actual selection UI to
  `@react-native-community/datetimepicker` (new peer dependency of `@beeui/ui`,
  following the exact existing `react-native-safe-area-context`/`react-native-teleport`
  pattern: exact-pinned `devDependency`, ranged `peerDependency`; its own
  compatibility-matrix row, Expo-compatibility evidence, and native compile/runtime
  proof are owned by #172/#173's implementation, not this ADR, per `docs/
  compatibility-matrix.md`'s row-level-verification delegation and `docs/
  beeui-1.0-integration-discipline.md`'s shared-authority serialization rule).
- The native-only import is isolated to `date-picker.native.tsx`/
  `date-time-picker.native.tsx` platform files (mirroring `overlay-transport.web.tsx`/
  `.native.tsx`) so it never reaches the Web bundle.
- The `CalendarDate`/`ClockTime` public value contract is identical across platforms;
  only the rendered picker UI differs — an explicit, documented platform divergence
  sanctioned by `docs/agent-execution-contract.md`'s "Web/iOS/Android behavior may
  differ when platform-honest, but public contracts must remain coherent."

### Web presentation

- `DatePicker`/`DateTimePicker` open `Calendar`/the time control inside `Popover` on
  Web at every viewport width, reusing the existing anchored-overlay geometry/
  dismissal/focus/RTL contract (`docs/anchored-overlays.md`) — no new overlay engine.
- `open`/`onOpenChange` follow `Popover`'s existing controlled/uncontrolled pattern
  ("controlled/uncontrolled open state if BeeUI owns presentation", per #173).
- `Dialog` remains available as a general primitive for application-composed custom
  flows around `Calendar`, but is not an automatic `DatePicker`/`DateTimePicker`
  presentation mode.
- `Sheet` is explicitly out of scope pending #156/#157; if `Sheet` is accepted before
  #172–#174 implement, whether the Web picker should prefer it on narrow viewports is a
  named, legitimate follow-up decision for that implementation issue — not assumed or
  precluded here.

### Dependency / date-library policy

- **No third-party pure-JS date-arithmetic library** (`date-fns`/`dayjs`/`luxon`/etc.).
  `@beeui/core` implements the minimal Gregorian arithmetic BeeUI actually needs, kept
  small and dependency-free — consistent with `@beeui/core`'s existing two-dependency
  footprint (`clsx`, `tailwind-merge`) and `docs/architecture.md`'s "must not import
  Expo or application code" boundary.
- **`Intl` (built into the JS engine) for all locale-sensitive display/week-start
  derivation** — no bundled CLDR/locale database, satisfying #175's explicit
  constraint. `Intl.DateTimeFormat`/`Intl.Locale.prototype.getWeekInfo` availability on
  the tested Hermes/JSC/V8 rows is verification evidence owed to #175, not an
  assumption this ADR makes.
- **One new native dependency**, `@react-native-community/datetimepicker`, for the
  native system picker (Decision, "Native system picker"). This is the only new
  runtime dependency this ADR introduces.

### Validation / `Field` integration

`DatePicker`/`DateTimePicker`'s trigger control follows the exact `Input`
(`packages/ui/src/components/input.tsx:52-84`) pattern: call `useFieldContext()`; OR its
own `disabled`/`invalid` props with `field.disabled`/`field.invalid`; derive
`accessibilityHint` from `field.error` (when invalid) or `field.description`; derive
`accessibilityLabel` from `field.label` (+ `field.requiredAccessibilityLabel` when
required); derive `accessibilityLabelledBy` from `field.labelNativeID`. No new
validation engine is introduced — computing `invalid`/`error` from the selected
`CalendarDate`/`ClockTime` plus `min`/`max`/`isDateDisabled` remains the host
application's responsibility, passed into the enclosing `Field`, exactly as for any
other Field-integrated input today. `min`/`max` are `CalendarDate`; disabled dates are a
single `isDateDisabled?: (date: CalendarDate) => boolean` predicate prop (a predicate is
a strict superset of a fixed list — closing over a `Set<string>` of ISO dates is a
one-line predicate — so no separate `disabledDates` array prop is added, avoiding two
ways to express the same constraint).

### RTL / a11y / keyboard strategy

- `Calendar` resolves logical previous/next navigation-glyph direction and grid mirroring
  through the existing `resolveDirection()`/`useDirection()` resolver
  (`use-direction.ts`), exactly like pagination/breadcrumb chevrons
  (`docs/architecture.md:144`) — no new direction code.
- Web keyboard contract follows the WAI-ARIA Date Picker Dialog grid pattern: `ArrowLeft`/
  `ArrowRight` move focus to the physically previous/next day cell; `ArrowUp`/`ArrowDown`
  move by one week; `PageUp`/`PageDown` move by one month; `Shift+PageUp`/`PageDown` move
  by one year; `Home`/`End` move to the first/last day of the focused week; `Enter`/
  `Space` selects the focused day; `Escape` closes the enclosing `Popover` (reusing its
  existing dismissal/focus-restoration contract) rather than a new escape handler.
- Day cells use `grid`/`gridcell`-equivalent roles/states on Web and native
  `accessibilityLabel`s that include the full date plus today/selected/disabled state
  (not color alone) for VoiceOver/TalkBack traversal.
- Day-cell hit targets reuse the existing semantic touch-target token
  (`min-h-touch-target`, the same token `Input`'s `sm` size variant already applies) —
  no new pixel constant.
- Focus restoration to the `DatePicker` trigger on close reuses `Popover`'s existing,
  already-accepted restoration/topmost-dismissal contract.

## Rejected alternatives

- **A1 (native `Date` as the sole value type)**: rejected outright — it cannot express
  "no time zone" and directly reintroduces the exact day-shift defect #171/#175 require
  BeeUI to avoid.
- **A2 (ISO string as the primary, non-adapter type)**: rejected as the *primary* type —
  its serialization convenience is real and is kept as the documented adapter, but a
  string cannot structurally prevent misuse (`new Date(isoString)`) the way a
  timezone-free object type can, and per-operation re-parsing is unnecessary overhead
  for arithmetic BeeUI performs internally on every render.
- **B1 (ambient device-locale auto-detection, mirroring ADR-004)**: rejected — the only
  available "no new dependency" native locale-identifier reads are undocumented
  `NativeModules` internals, not an equivalently stable, documented, purpose-built
  primitive to `I18nManager.isRTL`; mirroring ADR-004's *shape* here would import its
  benefits without its evidentiary basis, and duplicates locale ownership the host
  application already has for its own i18n.
- **C1 (custom `Calendar` everywhere, no native system picker)**: rejected — forfeits
  free, OS-maintained accessibility/locale/DST correctness on native for no
  corresponding benefit, and does not actually answer #171's "native system picker vs.
  custom Calendar responsibilities" decision requirement.
- **D1 (automatic viewport-based `Popover`/`Dialog` switching)**: rejected — no child
  issue requires it; it would add an untested responsive-presentation contract and
  double the dismiss/focus/keyboard evidence surface (#176/#177) without a stated
  requirement driving it (YAGNI).

## Implementation consequences

- **#172 (Calendar API)** must: introduce `CalendarDate`/`ClockTime` and the pure
  arithmetic/adapter functions in `@beeui/core`; build the cross-platform custom grid in
  `@beeui/ui` with the keyboard/RTL/a11y contract above; add the stateless `locale`/
  `weekStartsOn` resolvers; ship deterministic tests for month-grid generation,
  comparison, clamping, and leap-year/month-length edges.
- **#173 (DatePicker API)** must: add `@react-native-community/datetimepicker` as a new
  peer/dev dependency with its own compatibility-matrix row (serialized per `docs/
  beeui-1.0-integration-discipline.md`, since the compatibility matrix is a shared
  authority); implement the `.web.tsx`/`.native.tsx` platform-file split; wire `Field`
  integration per the `Input` pattern; implement `Popover`-hosted Web presentation and
  native-picker delegation with the `toLocalDate`/`fromLocalDate` boundary adapter.
- **#174 (DateTimePicker API)** must: compose the date part per #173's `DatePicker` with
  a `ClockTime` time part into the single `{ date, time }` controlled value; implement
  the Web hour/minute/AM-PM control from existing `Input`/`SegmentedControl` primitives;
  delegate native time entry to the same native system picker in `mode="time"`/
  `"datetime"`.
- **#175 (i18n/timezone matrix)** must supply the regression fixtures this ADR's locale/
  week-start/date-only-adapter decisions require: the five named locales, both week
  starts, 12/24h, DST-boundary time-value cases, and the `Intl.Locale.prototype.
  getWeekInfo` availability evidence flagged above.
- **#176/#177** consume this ADR's keyboard/a11y/presentation contract directly rather
  than re-deciding it; #177's fixture matrix (standalone `Calendar`, form `DatePicker`,
  `DateTimePicker`, invalid/disabled/min-max, viewport range, themes, LTR/RTL, locale,
  reduced motion) is exactly the surface this ADR defines.
- **#178** must add the new `@react-native-community/datetimepicker` dependency to the
  registry/source-ownership dependency closure and document the value/timezone/
  platform-presentation contract from this ADR in the public docs/AI metadata, per its
  own DoD ("no unsafe timezone assumptions").
- If #156/#157 accept a `Sheet` component before #172–#174 implement, that
  implementation issue may propose (as its own follow-up decision, not implied here)
  preferring `Sheet` over `Popover` for narrow-viewport Web presentation; this ADR does
  not require or block that.

## Verification plan

- **Deterministic contract evidence**: unit tests for `CalendarDate`/`ClockTime`
  arithmetic (month-grid generation across `weekStartsOn` values, leap years, month-end
  clamping, comparison), the ISO-string adapter (round-trip, no `Date`-constructor
  usage), the `toLocalDate`/`fromLocalDate` adapter (local-wall-clock construction,
  never UTC/`Z`-parsed, verified across at least one positive- and one negative-UTC-
  offset fixture timezone), and the `locale`/`weekStartsOn` resolver precedence with
  `Intl.Locale.prototype.getWeekInfo` mocked both present and absent.
- **Browser interaction evidence**: Playwright coverage of the WAI-ARIA grid keyboard
  contract (arrow/PageUp/PageDown/Home/End/Enter/Escape) and `Popover`-hosted
  presentation/dismissal/focus-restoration for `DatePicker`/`DateTimePicker` on Web.
- **Native runtime evidence**: iOS Simulator and Android Emulator runs proving the
  native system picker opens, returns a value, and the `CalendarDate`/`ClockTime`
  round-trip does not shift day/time; VoiceOver/TalkBack traversal of `Calendar`'s
  custom grid (standalone and Web picker paths) and of the native system picker path.
  per #176.
  - **#177 resolution (documented deferral)**: the headless iOS Simulator has a
    reproducible Fabric blank-render defect (#349, filed against the unrelated #126
    overlay-runtime smoke) that is not specific to Calendar/date and is not owed to
    this ADR's scope to fix. Real-device cloud runtime testing for BeeUI 1.0 is
    separately deferred pending a cost/tooling decision. #177 therefore substitutes the
    strongest reachable evidence for the interactive picker path per
    `docs/beeui-1.0-evidence-classes.md`'s "always state the strongest evidence class
    actually obtained" rule: **deterministic contract evidence** —
    `issue-173-date-picker-native.test.tsx` / `issue-174-date-time-picker-native.test.tsx`
    (RNTL against a mocked `@react-native-community/datetimepicker` boundary) prove
    BeeUI's own selection/dismiss/Field-integration/CalendarDate-adapter wiring on both
    iOS's inline-`Dialog` and Android's imperative-open presentations — not the OS
    picker's own on-screen rendering or gesture handling, which remains genuinely
    untested until #349 and the real-device decision resolve. This is a scope
    boundary, not a silent gap: revisit this ADR (see "Revisit trigger" below) once
    either is resolved.
- **Locale/timezone matrix evidence**: the #175 fixture set (Vietnamese, English,
  Arabic/RTL, one CJK locale; Sunday/Monday week starts; 12/24h; DST-boundary time
  values; date-only day-shift regression across timezones).
- **Visual evidence**: representative light/dark/high-contrast, LTR/RTL, and large-text
  screenshots for standalone `Calendar`, form `DatePicker`, and `DateTimePicker`, per
  #177 — real-Chromium Playwright screenshots (`date-production.spec.ts`) across the
  canonical theme x viewport matrix, plus RTL/large-text/locale/narrow-phone/tablet
  states. Chromium/Web evidence does not prove native pixel parity (see
  `docs/visual-regression.md`'s "known limitations").
- This ADR itself ships no code; the verification plan above is the acceptance bar for
  #172–#178, not for this document. This PR's own self-test is ADR/docs-only.

## Revisit trigger

Revisit this ADR if any of the following become true with concrete evidence:

- A shipped consumer demonstrates a real, reproducible need for range/multiple-date
  selection or a `CalendarDateRange` value type — that is a scoped follow-up decision
  with its own migration/semver analysis, not an incidental addition to #172–#174.
- `@react-native-community/datetimepicker` proves incompatible with a tested RN/Expo
  row in `docs/compatibility-matrix.md`, or an Expo config-plugin requirement surfaces
  that this ADR did not anticipate — narrowing or replacing the native-picker dependency
  becomes its own scoped decision.
- `Intl.Locale.prototype.getWeekInfo` (or `Intl.DateTimeFormat` locale/label support more
  broadly) proves unavailable or inconsistent on a tested Hermes/JSC/V8 row — the
  week-start/label derivation fallback chain would need to be re-evaluated with that
  evidence, not assumed fixed by this ADR.
- #156/#157 land an accepted `Sheet` and a concrete narrow-viewport Web usability gap is
  demonstrated for the `Popover`-hosted picker — adopting `Sheet` for that path becomes
  its own scoped decision, not implied by this ADR.
- A host application demonstrates a concrete, reproducible need for BeeUI to interpret a
  non-local-timezone `Date` boundary (beyond the documented local-wall-clock
  `toLocalDate`/`fromLocalDate` adapter) — that would require re-evaluating the
  timezone-ownership boundary itself, which stays an application concern absent new
  evidence that BeeUI's boundary is actually insufficient in practice.
- #349's headless-iOS-Simulator blank-render defect is fixed, or BeeUI 1.0 adopts a
  real-device/cloud runtime harness — either resolves the "#177 resolution" deferral
  above, and the native picker path should get real Simulator/device Runtime proof
  (system-picker rendering and gesture handling) rather than relying solely on the
  mocked-boundary deterministic contract tests.
