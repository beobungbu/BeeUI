# BeeUI 1.0 — Autonomous Drive (owner-authorized 2026-08-30)

Owner (beobungbu) authorized full autonomous execution of the #114 program on 2026-08-30,
superseding the overnight `integration/beeui-1.0-overnight-2026-08-29` parking. Dispatcher =
this session. Wave-by-wave; genuine owner/admin/legal/release gates stay locked and are only
reported, never crossed.

## Hard locked gates (report, never auto-execute)
- #254 npm publication · #195 repo→public · #188 license choice · #198 npm scope/account ·
  #205 trusted-publisher account actions · #119 branch protection (owner-declined).

## Standing rules
- One worker = one issue / one branch / one PR, each in its own git worktree.
- Independent review (separate worktree) before any merge to `main`. CI green ≠ status.
- Keep `main` green. Squash-merge. Update tracker #114 + roadmap after each merge.
- Max ordinary parallelism 4 (until #268 raises to 6).

## Status baseline (2026-08-30 10:48)
- main @ `e19c66b`. Merged already: #115/#116/#117/#118 (S0), #120 (#266), #139 (#267),
  #274 (#277), #276 (#278), #275 (#279).
- S0-B #119 DEFERRED (owner).

## Phase A — DONE (blocker backlog cleared)
- [x] #143 Dynamic Type (PR #297); #269 closed.
- [x] #145 Web a11y gate (PR #298); #273 closed.
- [x] #284 AppHeader large-text (PR #299); #285 closed.
- [x] #280 reclassified transient RNW; stays open, not a blocker.
- [x] #281 BottomActionBar occlusion (PR #306).
- [x] Overnight train PR #288 closed; integration branch retired.

## RECOVERY — stranded overnight work re-landed onto current main (nothing lost)
Deleted integration branch held 10 merged PRs never on main. Re-landed as: #300(#129),
#301(#268), #302(#128), #303(#179), #304(#140), #305(#121–#125). #287 dropped (superseded by #300).

## Phase B — DONE (S1 + control plane complete on main @ 54fb3c6)
- [x] Runtime lane #120–#125; [x] a11y #139/#140/#143/#145; [x] compat #129; [x] perf #179;
      [x] #128 pageSheet; [x] #268 cap→6.

## Phase C — S2 hard-component ADRs (IN PROGRESS, Wave C)
- [ ] #151 Tooltip · [ ] #156 Sheet · [ ] #164 Table · [ ] #171 Calendar/date (4 ADR workers dispatched).

## Phase C — S2 ADRs DONE (#151/#156/#164/#171 merged, renumbered ADR-005..008).

## Phase D — component impl (Wave D/E) — DONE/merged:
- Tooltip Web #152 · Sheet API #157 + Web #159 · Table core #165 + Web #166 · Calendar #172 + DatePicker #173.
- Real defects caught+fixed mid-impl (Table aria-selected/focus-ring, Sheet Escape-swallow, DatePicker aria-expanded).
- Findings filed: #318 (overlay Escape/Input latent), #319 (use-direction registry gap).

## Phase E — OSS governance DONE (merging): #189/#190/#191/#192 (PR #321). #188 license owner-gated.

## In-flight: #315 (#126 native stress — harness isolated; final assertion fix pushed).

## CONSTRAINT: single self-hosted Mars native runner = throughput cap (~1 PR / ~20-min native cycle);
nearly every PR triggers native jobs. Merges paced by it, not by tokens.

## Remaining frontier (all native-CI-bound unless noted; owner gates uncrossed):
- Per-lane: Tooltip #153 native/#154 regression/#155 export; Sheet #158 native (needs #127)/#160/#161;
  Table #167 native/#168 perf/#169/#170; Calendar #174 DateTimePicker/#175 i18n/#176/#177/#178.
- Runtime: #127 (#59 closure, needs #126). Compat rows #130–#135. Perf #180–#186.
- OSS/security #187/#193/#194/#196; #195 public preflight (owner).
- Packages R7 #197–#208; CLI R8 #209–#219; Docs/Showcase/AI R9 #220–#229;
  Consumers/demo R10 #230–#242; Freeze/RC R11 #243–#253; then STOP (1.0-ready).
- S9 publish #254/#255 — explicit owner command only.
