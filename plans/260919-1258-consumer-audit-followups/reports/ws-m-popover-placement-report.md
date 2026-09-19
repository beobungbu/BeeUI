# WS-M · DateTimePicker popover placement on Web: regression check

Date: 2026-09-19 · Branch: `ws/m-popover-placement` (from `fix/consumer-audit-followups` @ 4f88b93) · Compared against `origin/development` @ 66e94ff
Scope: investigation only. No `packages/*` or `apps/*` code changed.

## Verdict

**Not a regression.** The DateTimePicker popover is placed identically on `origin/development` and on `fix/consumer-audit-followups` in the live viewport (same side, same 216px offset from the trigger, fully inside the viewport, trigger off-screen on both). The screenshot delta on PR #618 is not a scroll-offset artifact either: the baseline PNG committed in 4f88b93 was captured in a state that 4f88b93 itself never renders (see "Why the baseline differs"), so CI is right and the committed baseline is wrong.

Two corrections to the working hypothesis in the task:

- The popover is **not** `position: fixed`. `PopoverContent` is `position: absolute` inside the overlay host, which is `position: absolute; top: 0; height: 800px` inside the 800px-tall RN root (`#root` → `body` is `overflow: hidden`; `html` is the scroller, 1298px). The host is document-anchored, so a full-page capture shows the popover at its real document position regardless of the scroll offset at capture time.
- The old baseline (4e08549, 2026-08-31, still what `origin/development` renders) already shows the popover pinned to the viewport bottom with the trigger off-screen. The rendering that shows the popover adjacent to the trigger is the *new* PNG committed in 4f88b93.

## Method

Both builds were produced in this worktree (Node 24.13.1, `corepack pnpm install --frozen-lockfile && corepack pnpm build && corepack pnpm --filter @beemvp/beeui-visual-regression build:web`), served with `apps/visual-regression/scripts/serve.mjs` on 4173, and driven by a throwaway Playwright script (scratch space, not committed) that mirrors `date-production.spec.ts` › "DateTimePicker opens its bounded Calendar and time controls in a Popover": desktop-light project settings (1280x800, `deviceScaleFactor: 1`, `colorScheme: light`, `reducedMotion: reduce`), `/?fixture=date`, wait for `data-visual-ready`, click `date-production-date-time-picker-default-trigger`, wait for the content, grid, and hour input, then read `boundingBox()` of trigger and content, `window.scrollY`, and the viewport height. The development build was obtained with `git checkout origin/development -- packages/ui/src packages/core/src packages/tokens/src apps/visual-regression/App.tsx`, rebuilt, measured, then `git checkout HEAD -- .` and rebuilt again (tree verified clean before the report commit). Six trials per build, with `HTMLElement.prototype.focus`, window `scroll`, and the content's inline `style` mutations timestamped from inside the page.

## Measured numbers (live viewport, 1280x800)

DateTimePicker, default open flow (6/6 trials identical per build):

| Build | `scrollY` at click | `scrollY` after open | Trigger y (viewport) | Content y / height | Side | Gap to trigger | Content in viewport | Trigger in viewport |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `origin/development` 66e94ff | 498 | **0** | 1008 (off-screen) | 324 / 468 | top (shifted) | 216 | yes (324..792) | no |
| `fix/consumer-audit-followups` 4f88b93 | 498 | **0** | 1008 (off-screen) | 304 / 488 | top (shifted) | 216 | yes (304..792) | no |

Delta between builds: content is 20px taller on the branch (468 → 488: the AM/PM segmented control wraps to two lines after the `Input` `h-*` → `min-h-*` change widened the hour/minute inputs), so the bottom-pinned popover's top moves from 324 to 304. Side, gap, clipping, and scroll behaviour are identical. `content.y + content.height = 792 = 800 − 8` on both: the popover is pinned by the 8px collision padding, which is what `useAnchoredOverlayPosition`'s shift does when the anchor is at viewport y 1008 and neither side fits.

DatePicker, same flow (trigger at document y 628, already inside the viewport, no scroll needed): both builds place the content at y 266, height 354, top side, 8px gap, fully in view, `scrollY` stays 0. Unaffected.

Event order, every trial, both builds (branch timestamps shown; development is the same sequence):

```
scroll@t+0   scrollY=498   Playwright scrolls the trigger into view (viewport y 510)
focus@t+0    scrollY=498   focus() on the day gridcell while the content still sits at styles.measuring (top:-10000): rect y = -10297
scroll@t+2   scrollY=0     the browser scrolls the document to bring the focused cell into view; clamps at 0
style@t+3    scrollY=0     content positioned: top 304 (branch) / 324 (development), anchor measured with the trigger at viewport y 1008
```

`PopoverContent` renders at `left/top: -10000, opacity: 0` until it has both an anchor rect and its own layout size (`popover.tsx` `styles.measuring`). The open-focus effect in `date-time-picker.web.tsx` / `date-picker.web.tsx` calls `focus()` on the roving day cell from a `requestAnimationFrame`, which runs before the `ResizeObserver`-backed `onLayout` that completes positioning in the same frame; `focus()` without `preventScroll` scrolls the document toward the cell's −10000 position, i.e. to the top, and the anchor is then measured with the trigger below the fold. This is deterministic (12/12 trials), and it exists on `origin/development` unchanged since 9e683eb / 4e1084e (2026-08-30, the commits that added the focus effect; `styles.measuring` dates from b973340).

## Why the baseline differs

`apps/visual-regression/tests/__screenshots__/date-production--open-date-time-picker--light--desktop.png` was rewritten in 4f88b93. Comparing captures against both committed PNGs (Pillow, exact pixel diff; the ~2% floor is macOS-vs-CI font rasterisation and spans the whole page):

| Capture | vs 4f88b93 PNG | vs 4e08549 PNG |
| --- | --- | --- |
| development, default flow | 7.64% | **2.10%** |
| branch, default flow | 7.74% | **2.78%** |
| branch, gridcell `focus()` suppressed | **2.00%** | 7.66% |
| branch, gridcell `focus({ preventScroll: true })` | **2.00%** | 7.66% |

With the gridcell `focus()` neutralised, the branch build places the content at document y 506, height 488, top side, 14px below-trigger gap, trigger and popover both in view, `scrollY` 498 — the rendering in the 4f88b93 PNG. That is the state of commit bc841bc, where `calendar.tsx` switched the day role to `gridcell` while the focus selector still read `[role="cell"][tabindex="0"]` (the effect silently matched nothing, so nothing scrolled); 4f88b93 restored the selector, which restored the scroll-to-top, but its baseline reflects the bc841bc rendering. The CI "complete" capture (popover top 304, trigger off-screen) is the true 4f88b93 rendering and matches `origin/development` (324) up to the 20px height delta. The "about 170px higher" observation is the 506 → 304 difference against the 4f88b93 PNG (202px), not a difference against development.

## Files

- `plans/260919-1258-consumer-audit-followups/reports/ws-m-popover-placement-report.md` (this file). No other changes on the branch.

## Concerns for the owner of `fix/consumer-audit-followups`

1. The 4f88b93 baseline PNG cannot pass `maxDiffPixelRatio: 0.0001` against 4f88b93's own rendering; the visual gate will stay red on this file until either the PNG is regenerated from the branch (accepting the current behaviour) or the behaviour is changed to match the PNG.
2. The behaviour behind it is a pre-existing Web defect, not introduced by this branch: opening a `DatePicker`/`DateTimePicker` whose trigger sits below the fold scrolls the page to the top and detaches the popover from its trigger. Measured fix candidate (not applied here, out of WS-M's report-only scope): pass `{ preventScroll: true }` to the gridcell `focus()` in `date-time-picker.web.tsx` and `date-picker.web.tsx`. With that, the branch build keeps `scrollY` 498, focus lands on the day cell, and the popover renders at document y 506 with a 14px gap above the in-view trigger, pixel-identical to the suppressed-focus capture and therefore to the rendering the 4f88b93 PNG already encodes. If that route is taken, a live-viewport geometry assertion in `date-production.spec.ts` (content bottom within 8..16px above the trigger top, trigger inside the viewport) would pin it.

Status: DONE_WITH_CONCERNS
Branch: ws/m-popover-placement @ (report commit)
Summary: Popover placement did not regress — development and the branch measure identically (top side, 216px from an off-screen trigger, 8px viewport clamp), the PR #618 delta comes from a baseline PNG committed in 4f88b93 that encodes the bc841bc inert-focus rendering, and the underlying scroll-to-top-on-open is a pre-existing defect with a measured `preventScroll` fix left for the owner.
Concerns: the 4f88b93 baseline will not match its own commit in CI; the pre-existing focus scroll detaches the popover from below-the-fold triggers on Web.
