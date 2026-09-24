# W5 colour and typography: report

Branch `ws5-color-and-typography`, based on `243c4ae`.

Commits:

| SHA | Subject |
|---|---|
| 862349a | fix(core): merge typography step classes as font sizes |
| f00ee46 | fix(ui): give table cells and caption the foreground colour |
| deb97e8 | fix(ui): keep the current stepper title at text contrast |
| 93626f7 | fix(ui): dock bottom toasts above bottom navigation |
| eb269d9 | fix(ui): resolve web spinner and switch colours from theme variables |
| 4e41072 | test(visual): measure consumer colour and typography contrast on web |

The report itself is committed on top of these.

## Measurement method

New fixture `apps/visual-regression/src/color-typography-fixture.tsx` (`?fixture=color-typography`). It is written the way a consumer writes it: the only colour class on any ancestor is the page background, so text that falls back to the document colour shows up. New spec `apps/visual-regression/tests/color-typography-contrast.spec.ts` reads computed styles in Chromium. Colours go through a 1×1 canvas to get sRGB, ancestor backgrounds are alpha-composited over white, and the spec computes WCAG 2.x relative luminance and contrast. It runs in all 8 canonical projects (mobile/desktop × light, dark, high-contrast-light, high-contrast-dark).

Computed values from the fixture, mobile viewport:

| Node | Base `243c4ae` light | Base dark | Fixed light | Fixed dark |
|---|---|---|---|---|
| `<Text className="text-caption">` | 16px/24px, rgb(0,0,0) | 16px/24px, **1.09:1** | 12px/16px, 17.75:1 | 12px/16px, 17.44:1 |
| Avatar fallback sm/md/lg/xl | 14/14/14/14 px | same | 12/14/16/18 px (4.51:1) | 12/14/16/18 px (6.47:1) |
| `th` | 17.75:1 | 17.44:1 | 17.75:1 | 17.44:1 |
| `td` (plain) | rgb(0,0,0) | **1.09:1** | 17.75:1 | 17.44:1 |
| `td` in a selected row | rgb(0,0,0) | **1.30:1** | 16.41:1 | 14.69:1 |
| `TableCaption` (scroll layout) | 16px black | **1.09:1** | 12px muted, 4.97:1 | 8.48:1 |
| Current Stepper title | **2.15:1** (#f59e0b on white) | 11.51:1 | 17.75:1 | 17.44:1 |

The base dark numbers (1.09:1 for `td` and caption, `text-caption` rendering 16px) match the BeePOS rc.2 comments exactly.

## Red evidence (base code, new tests)

Playwright, `color-typography-contrast.spec.ts` on `243c4ae` sources (mobile-light and mobile-dark shown):

```
✘ [mobile-light] a className typography step sets its own size and keeps the foreground colour
✘ [mobile-dark]  a className typography step sets its own size and keeps the foreground colour
✘ [mobile-*]     avatar fallback initials scale with the avatar size
✘ [mobile-dark]  table body cells and caption keep a readable foreground in every theme
✘ [mobile-light] stepper step titles, including the current one, meet AA contrast
✘ [mobile-*]     accent colours resolve when the stylesheet arrives after the first render
    Expected: "12px"  Received: "16px"                       (text-caption)
    Error: Avatar size="sm"  Expected: "12px"  Received: "14px"
    Error: plain TableCell: rgb(0, 0, 0) on rgb(11, 15, 20) is 1.09:1
    Error: current StepperItem title: rgb(245, 158, 11) on rgb(255, 255, 255) is 2.15:1
    Error: Spinner arc stroke  Expected: "rgb(245, 158, 11)"  Received: "rgb(25, 118, 210)"
```

Jest on the base sources: 22 of 53 tests in the five new or changed suites fail. Excerpts:

```
● typography step classes merge as font sizes › text-caption replaces the variant size and keeps the colour class
    Expected value: "text-foreground"
    Received array: ["text-[length:var(--text-body)]", "leading-[var(--text-body--line-height)]", "text-caption"]
● Avatar fallback initials follow the avatar size › size="sm" renders text-caption with the muted foreground
    Received array: ["text-[length:var(--text-label)]", "leading-[var(--text-label--line-height)]", "font-semibold", "text-muted-foreground"]
● Table plain text made of several JSX text parts (native) › renders the cell text through a foreground Text
    Unable to find an element with text: Row 2
● Table plain text … › keeps the inferred column label in the cell accessible name
    Expected: "Reference #: Row 2"  Received: undefined
● Stepper current step title colour › renders the current title in the foreground colour, emphasised by weight
    Expected value: not "text-primary"
● Toast transient notification runtime › docks the native default toast stack above an iOS tab bar (49pt)
    Expected: > 83  Received: 46
● Spinner accent colour › uses the theme variable and no accent class on Web
    Expected: "var(--color-primary)"  Received: undefined
```

## Green evidence

- Playwright `color-typography-contrast.spec.ts`: **40/40 passed** (5 tests × 8 canonical projects).
- The new and changed jest suites (`typography-step-class-merge`, `table-mixed-text-children`, `stepper-current-title-contrast`, `accent-colour-web-theme-variables`, `toast`): 53/53 passed.
- Full showcase jest run: 1210 passed, 4 timed out. The four suites were `overlay-scope`, `wave-2a-select`, `wave-2a-select-adversarial` and `dropdown-menu-item-description-slot`, each failing on a 5000 ms test timeout while other heavy processes were running. Re-run in isolation, they pass on the base sources, on the `cn` change alone, and on the full fix set (46/46), so these were load-related timeouts, not regressions. Also green: `avatar-fallback-contrast`, `switch-labelledby-and-disabled-contrast`, `table`, `tabs-pagination-stepper-current-aria` and `class-name-merge-safety`.
- `pnpm lint` passes. Typecheck passes for `@beemvp/beeui-core`, `@beemvp/beeui-ui`, `@beemvp/beeui-showcase` and `@beemvp/beeui-visual-regression`. `tokens:consumption-check` passes with 0 violations.

## Per item

### #599: `text-caption` renders 16px and loses the colour; Avatar fallback is 14px at every size

Root cause: there is no Uniwind or CSS defect here. The exported stylesheet does contain `.text-caption{font-size:var(--text-caption);line-height:var(--tw-leading,var(--text-caption--line-height))}`. The fault is in `cn()` (`packages/core/src/utils/cn.ts`, plain `twMerge`). tailwind-merge knows only t-shirt font sizes and files any other `text-<word>` under text colour. As a result, `<Text className="text-caption">` merged to `text-[length:var(--text-body)] leading-[…] text-caption`: `text-foreground` was evicted, which gives black text (1.09:1 in dark), and the variant's arbitrary body size stayed. The arbitrary rule comes later in the stylesheet, so it wins and the text renders at 16px. Avatar's `text-caption`/`text-label`/… size classes lost to the `label` variant's arbitrary size in the same way, which is why every size rendered 14px. The old Avatar comment described the colour half of this and worked around it by ordering the classes.

Fix: `cn` now uses `extendTailwindMerge` and registers `caption, label, body, heading, title, display` as the font-size theme scale. Each step now replaces the variant's size and, through the font-size/leading conflict, its line height, and it no longer touches the colour. Avatar moves `text-muted-foreground` back into the cva base; the ordering workaround is removed.

Scope note: `packages/core/src/utils/cn.ts` is not in the listed file set. It is where the root cause lives, and no other workstream owns it. A `text.tsx`-only fix would have left Avatar, and any other `cn` call site given a step class, broken. The change is limited to the six step names. A jest test pins that colour-on-colour merging still works (`cn('text-foreground text-caption', 'text-primary')` gives `text-caption text-primary`). The tokens package was not changed.

### #604: dark `td` text is black

Root cause: `table.web.tsx` renders raw `<td>`, `<caption>` and stacked value `<div>`s with no colour class, so they inherit the document colour. `th` had been fixed individually in rc.2.

Fix: `text-foreground` on the Table root container, so everything the web table emits inherits it, plus explicitly on `<td>`. The scroll-layout `<caption>` now uses the same `textVariants({variant:'caption', tone:'muted'})` classes the stacked caption already used.

Native: plain cells already rendered through BeeUI `Text` (foreground). The one native gap was mixed text children. `<TableCell>Row {n}</TableCell>` passes `['Row ', n]`, which failed the `typeof children === 'string'` check. Bare strings then landed in a `View` with no theme colour, which is not a valid RN text node, and the column-label accessible name was lost. The new `plainTextContent()` in `table-shared.ts` treats arrays of only strings and numbers as plain text, on both platforms. Mixed and selected-row cells are both covered by the Playwright spec.

### #631 item 4: current Stepper step label contrast

Measured: light theme 2.15:1 (`text-primary` #f59e0b on #ffffff), dark 11.51:1. Primary is a fill colour, and no text-safe primary token exists. Adding one would mean a new semantic token in every theme, plus tokens.json, generator, docs and lifecycle changes, which is outside this scope. Fix: the current title renders in the foreground colour with `font-bold` (the label variant is semibold). The filled primary circle and `aria-current="step"` still carry the current state. Result: 17.75:1 light, 17.44:1 dark. High-contrast themes also pass.

### #631 item 6: native toast sits over a bottom tab bar

The toast runtime lives at the app root and cannot see the navigator, and the brief rules out a navigation dependency. The existing `toastPlacement` prop stays as the explicit override. Default chosen: bottom placement docks at `insets.bottom + 80 + 12`. 80 is the tallest standard bottom navigation (Material 3 navigation bar, 80dp). It also clears the iOS tab bar (49pt) and React Navigation / expo-router bottom tabs (49pt iOS, 56dp Android), all of which sit on top of the bottom inset. The cost is that an app without bottom navigation sees the toast about 80pt higher, which covers nothing. Alternatives rejected:

- `'top'` default: this reverses #586, where the consumer explicitly asked for bottom placement.
- Measuring the bar: this needs React Navigation's `useBottomTabBarHeight`, which is a dependency.
- A new offset prop: this is a public API addition, and the default would still have to be correct on its own.

The BeePOS custom shell bar in #631 item 6 is 80pt, so it is also cleared. Test: `toast.test.tsx` checks the computed `bottom` against each bar height stacked on the mocked 34pt inset. Base gives 46 against a required >83, so it fails; the fix gives 126.

### #592: `accent-primary` warning on some cold loads

Source: Uniwind's `useUniwindAccent` (web, `uniwind/src/components/web/useUniwindAccent.ts`) and `withUniwind`. These resolve `*ColorClassName` by scanning `document.styleSheets` rules during render (`getWebStyles`, which runs over `CSSListener.activeRules`). BeeUI passes `accent-primary` from two places: Spinner (default tone) and Switch (`trackColorOnClassName`). `input.tsx` also passes it, but that file belongs to W4 (see below). On a cold load after a Metro restart, the CSS can attach after the first render. The rule set is then empty, the lookup returns no colour, and the warning fires once per session (`warnedOnce`). The `CSSListener` re-scan only re-renders media-query subscribers, so the colour does not recover: the Spinner stays on react-native-web's default `#1976D2` and the Switch on its default teal. That explains why BeePOS saw the warning in only 1 of 5 loads, since it depends on stylesheet timing.

Fix (the cause, not a silenced warning): on web, Spinner and Switch no longer go through the accent class bridge. They pass theme-variable colours built with the typed `semanticColorVariable()` helper. react-native-web passes a colour through untouched when it starts with `var(`. The browser resolves these whenever the stylesheet lands, and they follow theme and `BeeThemeScope` changes with no re-render. The disabled on-track keeps the same dimmed value `accent-primary/40` compiled to (`color-mix(in oklab, var(--color-primary) 40%, transparent)`), carried as the fallback of an unset custom property so react-native-web accepts it. Native keeps the class bridge unchanged, because it resolves from the compiled store, not DOM rules.

Red/green test: the Playwright case intercepts `index.html` and attaches the stylesheet only after the fixture has rendered, reproducing the late CSS. Base: the Spinner arc stays `rgb(25,118,210)`. Fixed: the arc and the Switch on-track equal the computed `--color-primary` in all 8 projects. Jest pins that web passes no accent class props and native keeps them. The visual screenshots of the Switch and Spinner scenarios are pixel-identical before and after, so the theme-variable colours render the same as the class-resolved ones.

**Ownership, NEEDS_CONTEXT for W4:** `input.tsx:143,151,152` also pass `cursorColorClassName="accent-primary"`, `selectionColorClassName` and `selectionHandleColorClassName`. That can emit the same warning, and leave caret/selection on the default colour, under the same cold-load condition. `button.tsx` passes `accent-*-foreground` for its spinner. I did not touch either file. The equivalent change for W4, on web only:

- `input.tsx`: pass `cursorColor`/`selectionColor` as `` `var(${semanticColorVariable('primary')})` `` and drop the three `*ColorClassName` props when `Platform.OS === 'web'`. Also replace `placeholderTextColorClassName="accent-muted-foreground"` with `placeholderTextColor` set to `var(--color-muted-foreground)` there.
- `button.tsx`: map the loading spinner tone to `var(--color-<variant>-foreground)` on web. The simpler alternative is to rely on the fixed `Spinner` if Button renders it.

My changes do not stop Input from emitting the warning, but Uniwind warns only once per session and Spinner/Switch were the default-mount sources. W4 or the controller should apply the Input change so the warning path is fully closed.

## Expected snapshot changes (baselines not updated)

These are local before/after comparisons of the same macOS Chromium build. The committed Linux baselines will need a controller refresh.

- `visual.spec.ts` › `navigation-data` (all 8 projects): only the current Stepper title ("Visual gate") changes, from amber to foreground bold.
- `table-production.spec.ts` (default matrix in all 8 projects; desktop-light density, loading/empty/error, RTL, large-text and tablet cases): the table caption moves from 16px/24px black to 12px/16px muted, so pages are 8px shorter. Cell text changes from the inherited colour to foreground. In dark themes that is a visible black-to-light change; in light themes it is a small shift from #000 to #101828.
- Also expected: any showcase or gallery screenshot containing Avatar fallback initials at sm/lg/xl (new sizes), a web Table, or a Stepper.
- Not caused by this change: `select-overflowing-list-mouse-pick` and `dynamic-type-home-navigation` failed identically on the base build in my local run, because they need the showcase servers that my local run did not start.

## Checks left for the controller

- `docs:contract:check` fails because `docs/component-reference.md` lists the new test file as an executable Spinner example. Fix: `pnpm docs:contract:generate`.
- `docs:portal-pages:check` reports avatar/spinner/stepper/switch/table pages as stale. Fix: `pnpm docs:portal-pages:generate`.
- Both are generated surfaces the brief said not to touch; I generated them locally to confirm and then reverted. They need regeneration at integration.
- Dark-theme `text-caption` in consumer docs: no docs were changed. `<Text className="text-caption">` now works as a consumer would expect, which W6 may want to reflect on the tokens and Text pages.
