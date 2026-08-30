# BeeUI Calendar/date i18n & timezone matrix

> **Status:** Accepted — [#175](https://github.com/beobungbu/BeeUI/issues/175) (R4F.5,
> parent [#114](https://github.com/beobungbu/BeeUI/issues/114)).
> **Snapshot:** 2026-08-30
> **Scope:** `Calendar` (#172), `DatePicker` (#173), `DateTimePicker` (#174) —
> `CalendarDate`/`ClockTime` and their locale/timezone-facing surfaces, per the value
> model and locale/week-start/timezone-ownership decisions in
> [ADR-008](decisions/008-datetime-architecture.md).

This is the regression-fixture record #175's DoD requires: "regression fixtures cover
the accepted value model and locale rules across supported Web/native paths, with
documented limitations and no off-by-one-day regressions." It does not re-decide
anything ADR-008 already locked — it records what the fixtures actually prove, on the
actual Node/ICU build this repo tests against.

## Locale matrix

Required by the issue: Vietnamese, English, Arabic/RTL, and a representative CJK
locale; Sunday/Monday week starts; locale month/day labels; 12/24h display where
applicable.

| Locale | Family | Real `Intl` week start | Real `hour12` | Notes |
| --- | --- | --- | --- | --- |
| `vi-VN` | Vietnamese | Monday (`1`) | `false` (24h) | Latin script with diacritics; distinct AM/PM-equivalent labels (`SA`/`CH`). |
| `en-US` | English (US) | Sunday (`7`) | `true` (12h) | Baseline locale (`DEFAULT_CALENDAR_LOCALE` fallback when `locale` is omitted). |
| `en-GB` | English (UK) | Monday (`1`) | `false` (24h) | Same script/vocabulary as `en-US`, opposite week start and hour cycle — isolates the week-start/hour-cycle axis from the translation axis. |
| `ar-SA` | Arabic/RTL | Sunday (`7`) | `true` (12h) | Non-Latin script; renders the year in Arabic-Indic digits (e.g. `٢٠٢٦`), not ASCII `2026` — tests assert non-ASCII-digit locales structurally (non-empty, distinct from `en-US`) rather than asserting the literal digit string. Paired with the `direction="rtl"` prop (a separate resolver, see "Locale vs. direction" below) for the realistic Arabic-locale rendering. |
| `ja-JP` | CJK (Japanese) | Sunday (`7`) | `false` (24h) | Non-Latin script (`1月`, `午前`/`午後`). |

Evidence: `apps/showcase/__tests__/issue-175-date-i18n-timezone-matrix.test.ts`
(pure-function matrix: week start, `hour12`, label content, distinctness) and
`apps/showcase/__tests__/issue-175-date-i18n-component-matrix.test.tsx` (the same
locales rendered through the actual `Calendar`/`DatePicker`/`DateTimePicker`
components) — both **deterministic contract evidence**
(`docs/beeui-1.0-evidence-classes.md`), run against the real `Intl` engine, no mocked
`getWeekInfo`/`hour12` inputs.

### Locale vs. direction

`locale` (label/week-start/hour-cycle formatting, via `Intl`) and `direction`
(logical LTR/RTL layout + keyboard mirroring, via `useDirection()`/ADR-004) are two
independent, explicit resolvers by design (ADR-008 does not derive one from the
other). A host application rendering Arabic content is expected to pass both:
`locale="ar-SA"` for correct labels and `direction="rtl"` (or rely on the ambient
`document.dir`/`I18nManager.isRTL` read) for mirrored layout/keyboard behavior. The
component matrix test exercises exactly that combined, realistic pairing.

### `Intl.Locale.prototype.getWeekInfo` availability

`resolveCalendarWeekStartsOn` derives `weekStartsOn` from
`Intl.Locale(locale).getWeekInfo()` when available, falling back to a static Monday
otherwise (ADR-008). `issue-175-date-i18n-timezone-matrix.test.ts` asserts this method
is actually present on the tested runtime — the ADR-008 "compatibility-matrix
follow-up" this issue owes. Feature-*absence* handling itself (the fallback path) is
unit-tested separately with an injected absence in
`issue-172-calendar-locale.test.ts`; it is not re-tested here.

**Limitation, documented not hidden:** this availability check runs on the same
Node/V8 build `docs/compatibility-matrix.md` already pins for the rest of the repo. It
is not independently re-verified per Hermes (iOS/Android)/JSC row here — that native
row-level verification, if ever needed, is a `docs/compatibility-matrix.md` follow-up,
not a gap this file hides.

## Sunday/Monday week starts

Proven twice, deliberately: once via the locale matrix above (`vi-VN`/`en-GB` = Monday,
`en-US`/`ar-SA`/`ja-JP` = Sunday), and once isolated from any translation difference —
`en-US` vs. `en-GB`, identical vocabulary, opposite week start — in
`issue-175-date-i18n-timezone-matrix.test.ts`. `Calendar`'s explicit `weekStartsOn` prop
override (independent of locale) already has direct coverage in
`issue-172-calendar.test.tsx`.

## 12h/24h display

`resolveDateTimePickerHour12` is exercised across the same five-locale matrix
(`vi-VN`/`ja-JP`/`en-GB` = 24h, `en-US`/`ar-SA` = 12h), plus the existing explicit-
override precedence tests in `issue-174-date-time-picker-locale.test.ts`. The
component matrix additionally proves `DateTimePicker`'s Web AM/PM `SegmentedControl`
only renders for a 12h-default locale (`date-time-picker-showcase-bounded` in the
Playwright suite already covers the `hour12={false}` explicit-override case
end to end in a real browser).

## Date-only day-shift regression (no off-by-one-day)

The hard, non-negotiable ADR-008 guarantee: a date-only `CalendarDate` must never
change calendar day through an implicit timezone conversion. Fixture timezones,
across both the ISO-string adapter and the `toLocalDate`/`fromLocalDate` `Date`
adapter:

| Timezone | Offset | Why this fixture |
| --- | --- | --- |
| `UTC` | `+00:00` | The zero-offset control case. |
| `Asia/Kolkata` | `+05:30` | A common non-integer-hour positive offset. |
| `Pacific/Chatham` | `+13:45` | The least common denominator offset in real IANA data (45-minute), the hardest to get right if arithmetic ever used minute-truncating math. |
| `Pacific/Kiritimati` | `+14:00` | The earliest civil timezone — brackets the positive extreme. |
| `Pacific/Niue` | `-11:00` | Brackets the negative extreme; this is the exact offset class that breaks the classic `new Date('2026-01-15')` UTC-midnight bug. |

Evidence: `issue-175-date-i18n-timezone-matrix.test.ts` (5 timezones × 3 dates each,
plus the ISO-adapter round trip), on top of #172's own 2-timezone bracketing suite in
`issue-172-calendar-date.test.ts`. All pass with zero day shift.

## DST-boundary cases for time values

Fixture zone: `America/New_York` (observes US DST), dates `2026-03-08` (spring-forward)
and `2026-11-01` (fall-back).

| Case | Wall-clock input | Result | Meaning |
| --- | --- | --- | --- |
| Unambiguous time, spring-forward date | `09:00` | Round-trips exactly | No DST transition touches this hour. |
| In the spring-forward gap | `02:30` (does not exist that day) | Normalizes to `03:30`; **date unchanged** | The platform `Date` constructor advances a nonexistent wall-clock time forward — identical to a browser `<input type="time">` or an OS clock app on the same platform. The *day* guarantee still holds; only the in-gap hour is platform-normalized, which is documented here, not hidden. |
| Immediately before/after the gap | `01:30`, `03:30` | Round-trips exactly | Confirms the gap gets special-cased, not the whole day. |
| Ambiguous fall-back hour | `01:30` (occurs twice) | Round-trips to `01:30` | The wall-clock fields round-trip correctly regardless of which of the two real instants the platform resolved to — BeeUI never stores or infers the UTC offset an ambiguous instant resolved to (this is exactly ADR-008's "timezone storage/business rules stay application-owned" boundary applied to the DST case). |

**Evidence class and a documented harness limitation:** this Jest worker's V8 isolate
caches its local-timezone state at process start, so mutating `process.env.TZ` inside
a running test (the pattern used for the day-shift matrix above, which only needs a
tautological same-timezone round trip) has **no effect** on `Date`'s DST arithmetic —
verified empirically. Proving a genuine DST *transition* therefore requires a fresh
process with `TZ` set in its real launch environment;
`apps/showcase/__tests__/helpers/dst-boundary-probe.mjs` is that fresh child process,
invoked via `child_process.execFileSync` from the DST suite in
`issue-175-date-i18n-timezone-matrix.test.ts`, importing (not reimplementing) the real
`toLocalDate`/`fromLocalDate`/`clockTimeFromLocalDate` adapters. This remains
**deterministic contract evidence**, not native/runtime evidence — it exercises Node's
own ICU tzdata, not an iOS/Android system clock.

## Documented limitations

- **No ambient locale detection** (ADR-008, Option B1 rejected): `locale` is an
  explicit-only prop; an omitted `locale` always falls back to `'en-US'`/Monday, even
  on a Vietnamese- or Arabic-configured device. A host application must pass its own
  resolved UI locale for locale-correct rendering — this is a stated design decision,
  not a defect.
- **No bundled CLDR/locale database**: all label/week-start/hour-cycle derivation goes
  through the JS engine's built-in `Intl`. A runtime with materially different `Intl`
  data (an older/non-full-ICU build) would render different — but still
  internally-consistent — labels; this matrix documents the Node/ICU build actually
  tested, not a guarantee of byte-identical output on every runtime.
- **Timezone/business-calendar rules stay application-owned**: BeeUI never stores,
  infers, or writes a timezone (`CalendarDate`/`ClockTime` cannot express one by
  construction). The DST cases above describe wall-clock normalization only; deciding
  which real-world instant a wall-clock value refers to is the host application's job.
- **Native (iOS/Android) evidence is out of this issue's scope**: #175 delivers
  deterministic (Jest/Node) i18n/timezone fixtures. Native system-picker locale/DST
  behavior on a real iOS Simulator/Android Emulator is #177's runtime-evidence lane,
  not re-covered here.
