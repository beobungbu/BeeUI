// Standalone probe script (BeeUI issue #175, "DST-boundary cases for time
// values"). Spawned as a *fresh* child process with an explicit `TZ` env var
// set at process launch, because the existing Jest worker's V8 isolate caches
// its local-timezone state at startup: mutating `process.env.TZ` after
// startup (the pattern this repo's other `toLocalDate`/`fromLocalDate`
// timezone fixtures use — see `issue-172-calendar-date.test.ts` — works for
// those because they only prove a same-timezone round trip, which is
// tautologically TZ-independent) was verified empirically to have zero effect
// on `Date`'s local-time arithmetic inside this Jest worker, so it cannot
// exercise a genuine DST rule transition. A brand-new Node process, given
// `TZ` in its real environment at launch, resolves DST correctly — this
// script is that fresh process, invoked via `child_process.execFileSync` from
// `issue-175-date-i18n-timezone-matrix.test.ts`.
//
// Usage: TZ=<IANA zone> node dst-boundary-probe.mjs <year> <month> <day> <hour> <minute>
// Prints exactly one JSON line: {"date":<CalendarDate>,"time":<ClockTime>} —
// the round trip of the given date-only + wall-clock time through the exact
// `@beemvp/beeui-core` `toLocalDate`/`fromLocalDate`/`clockTimeFromLocalDate` public
// adapters (imported directly, not reimplemented), so this is evidence about
// the real adapter, not a parallel implementation of it.

import {
  clockTimeFromLocalDate,
  fromLocalDate,
  toLocalDate,
} from '../../../../packages/core/src/utils/calendar-date.ts';

const [year, month, day, hour, minute] = process.argv.slice(2).map(Number);
const local = toLocalDate({ day, month, year }, { hour, minute });
process.stdout.write(
  JSON.stringify({ date: fromLocalDate(local), time: clockTimeFromLocalDate(local) }),
);
