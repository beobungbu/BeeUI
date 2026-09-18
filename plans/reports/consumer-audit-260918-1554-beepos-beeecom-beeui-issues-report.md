# BeeUI issues found by BeePOS and BeeECOM consumer audits

Scan date: 2026-09-18 · Source: `gh issue list --repo beobungbu/BeeUI` (#543–#615), cross-checked against BeeECOM `docs/beeui-consumer-validation.md` and BeePOS `docs/beeui-audit/findings-*.md` (36 files). Every BeePOS finding is either filed upstream or explicitly marked "not a BeeUI problem"; no unfiled upstream findings remain in either consumer repo.

| Source | Issues | Open | Closed | Umbrella sub-items |
|---|---|---|---|---|
| BeeECOM | 16 | 15 | 1 | 0 |
| BeePOS | 56 | 56 | 0 | 39 |
| **Total** | 72 | | | |

Related but not a finding: #234 (R10.5 program umbrella), #554 (closed PR-style issue for #553).


## BeeECOM (npm consumer 0.86.2-rc.1, Web + Expo)


### Accessibility

| # | State | Labels | Title |
|---|---|---|---|
| [#546](https://github.com/beobungbu/BeeUI/issues/546) | OPEN |  | table(web): RN accessibilityLabel accepted by package typing but not mapped to aria-label |
| [#552](https://github.com/beobungbu/BeeUI/issues/552) | OPEN |  | bug: BeeThemeScope does not scope semantic CSS variables in a real Web external consumer |
| [#553](https://github.com/beobungbu/BeeUI/issues/553) | OPEN |  | fix(a11y): expose correct Web current/selected semantics for Tabs, Pagination and Stepper |
| [#555](https://github.com/beobungbu/BeeUI/issues/555) | OPEN |  | bug(web a11y): Accordion and Collapsible triggers omit aria-expanded in RNW DOM |
| [#556](https://github.com/beobungbu/BeeUI/issues/556) | OPEN |  | bug(web a11y): Progress omits aria-valuemin/now/max in RNW DOM |
| [#557](https://github.com/beobungbu/BeeUI/issues/557) | OPEN |  | bug(web a11y): Calendar selected day omits aria-selected in RNW DOM |
| [#558](https://github.com/beobungbu/BeeUI/issues/558) | OPEN |  | bug(web a11y): DropdownMenuTrigger omits aria-haspopup in RNW DOM |
| [#559](https://github.com/beobungbu/BeeUI/issues/559) | OPEN |  | bug(web a11y): Switch accessibilityLabelledBy does not label the interactive input |

### Bug web / runtime

| # | State | Labels | Title |
|---|---|---|---|
| [#548](https://github.com/beobungbu/BeeUI/issues/548) | OPEN |  | [Bug][Web][Sheet] overlay and percentage snap geometry use short app-root height instead of viewport |
| [#549](https://github.com/beobungbu/BeeUI/issues/549) | OPEN |  | bug: useBeeToken motion duration crashes on Web when Uniwind returns seconds |
| [#550](https://github.com/beobungbu/BeeUI/issues/550) | OPEN |  | bug: useBeeToken ignores BeeThemeScope in a real Web external consumer |
| [#551](https://github.com/beobungbu/BeeUI/issues/551) | CLOSED |  | bug: BeeThemeScope does not apply scoped semantic CSS in a real Web external consumer |

### Docs / compat

| # | State | Labels | Title |
|---|---|---|---|
| [#543](https://github.com/beobungbu/BeeUI/issues/543) | OPEN |  | docs: AI-agent cookbook contradicts current npm RC publication status |
| [#544](https://github.com/beobungbu/BeeUI/issues/544) | OPEN |  | compat: Expo package-consumer starter pins metro-runtime below current Expo 57 peer floor |
| [#545](https://github.com/beobungbu/BeeUI/issues/545) | OPEN |  | docs/llm: document system theme preference and restore semantics |
| [#547](https://github.com/beobungbu/BeeUI/issues/547) | OPEN |  | docs(web): Web onboarding and provider/safe-area guide contradict each other on root SafeArea |

## BeePOS (Expo SDK 57 + expo-router consumer, Web + iOS)


### API gap / enhancement

| # | State | Labels | Title |
|---|---|---|---|
| [#568](https://github.com/beobungbu/BeeUI/issues/568) | OPEN | enhancement,area:components | api: IconButton has no size prop while the rest of the Button family does |
| [#572](https://github.com/beobungbu/BeeUI/issues/572) | OPEN | documentation,enhancement,area:docs,area:components | api/docs(table): TableRow has no onPress; row-to-detail navigation pattern is undocumented |
| [#591](https://github.com/beobungbu/BeeUI/issues/591) | OPEN | documentation,enhancement | No family composes a closable, scrollable tab strip (POS open orders) |

### Accessibility

| # | State | Labels | Title |
|---|---|---|---|
| [#570](https://github.com/beobungbu/BeeUI/issues/570) | OPEN | bug,accessibility,area:a11y,area:components | bug(web a11y): Field exposes the accessible name on both the label element and the control, so getByLabel resolves to 2 nodes |
| [#571](https://github.com/beobungbu/BeeUI/issues/571) | OPEN | accessibility,documentation,area:a11y,area:components | a11y/docs: Field and FormGroup label relationships do not reach Switch, Checkbox or Checkbox lists |
| [#587](https://github.com/beobungbu/BeeUI/issues/587) | OPEN | accessibility,area:a11y,area:components | a11y(web): AlertDialog content exposes role="dialog" instead of "alertdialog" |
| [#589](https://github.com/beobungbu/BeeUI/issues/589) | OPEN | bug,accessibility,area:a11y,area:components | a11y(native): AppHeader, Input and SearchInput clip text at large Dynamic Type because of fixed heights and line heights |
| [#593](https://github.com/beobungbu/BeeUI/issues/593) | OPEN | bug | bug(dark): DialogTrigger variant="outline" paints the outline fill with the primary label colour (unreadable) |
| [#596](https://github.com/beobungbu/BeeUI/issues/596) | OPEN | bug | table(web): TableRow selected sets aria-selected but paints nothing |
| [#600](https://github.com/beobungbu/BeeUI/issues/600) | OPEN | bug | a11y(native): SegmentedControl truncates labels mid-glyph at accessibility-large instead of wrapping |
| [#601](https://github.com/beobungbu/BeeUI/issues/601) | OPEN | bug | a11y/i18n: Field required appends the untranslated English word "required" to the accessibility label |
| [#602](https://github.com/beobungbu/BeeUI/issues/602) | OPEN | bug | a11y(native): ButtonLabel clamps to one line and ignores numberOfLines at large text |
| [#614](https://github.com/beobungbu/BeeUI/issues/614) | OPEN | bug | a11y(iOS): an Input with accessibilityLabel stops exposing the typed value to VoiceOver |
| [#615](https://github.com/beobungbu/BeeUI/issues/615) | OPEN | bug | a11y(web): Table layout="stacked" drops the row grouping (cells no longer inside a row element) |

### Bug native (iOS)

| # | State | Labels | Title |
|---|---|---|---|
| [#584](https://github.com/beobungbu/BeeUI/issues/584) | OPEN | bug,area:runtime,area:components,ci:native | bug(native): Sheet never presents on iOS in a real Expo 57 consumer; present() is called, gorhom fires no onChange, nothing renders |
| [#586](https://github.com/beobungbu/BeeUI/issues/586) | OPEN | bug,documentation,area:components | native: Toast defaults to top placement on iOS (undocumented); DatePicker forwards deprecated onChange to the native picker |
| [#588](https://github.com/beobungbu/BeeUI/issues/588) | OPEN | bug,area:runtime,area:components,ci:native | bug(native): KeyboardAwareScreen pads for the keyboard but does not scroll the focused input into view on iOS |
| [#608](https://github.com/beobungbu/BeeUI/issues/608) | OPEN | bug | bug(native): DialogContent does not clip its children; overflowing content paints over the page on iOS |

### Bug web / runtime

| # | State | Labels | Title |
|---|---|---|---|
| [#563](https://github.com/beobungbu/BeeUI/issues/563) | OPEN | bug,area:runtime,area:components | bug(web): className={cond ? "x" : undefined} throws styleq "typeof undefined" on every render |
| [#564](https://github.com/beobungbu/BeeUI/issues/564) | OPEN | bug,area:runtime,area:components | bug(web): AppHeader inside partial-edge SafeArea (the provider-safe-area doc example) throws styleq error on mount |
| [#595](https://github.com/beobungbu/BeeUI/issues/595) | OPEN | bug | table(web): TableCell cannot right-align content through className alone; no align prop |
| [#598](https://github.com/beobungbu/BeeUI/issues/598) | OPEN | bug | bug(web): SafeArea silently drops padding passed in className; inline inset style wins |
| [#606](https://github.com/beobungbu/BeeUI/issues/606) | OPEN | bug | bug(web): a focused Input/SearchInput stops keydown from bubbling, killing every app-level keyboard shortcut |
| [#612](https://github.com/beobungbu/BeeUI/issues/612) | OPEN | bug | bug(web): a scrolling SelectContent swallows mouse presses, so a Select with more than ~8 options cannot be picked |

### Dark mode / contrast

| # | State | Labels | Title |
|---|---|---|---|
| [#604](https://github.com/beobungbu/BeeUI/issues/604) | OPEN | bug | bug(web dark): Table header cells render raw <th> text with the document colour, 1.1:1 in dark |
| [#605](https://github.com/beobungbu/BeeUI/issues/605) | OPEN | bug | bug(web dark): Avatar fallback initials paint react-native-web's default black, 1.43:1 in dark |

### Distribution / release

| # | State | Labels | Title |
|---|---|---|---|
| [#561](https://github.com/beobungbu/BeeUI/issues/561) | OPEN | area:distribution,area:release | dist: npm `latest` dist-tag points at prerelease 0.86.2-rc.1, docs say only `next` |

### Docs / compat

| # | State | Labels | Title |
|---|---|---|---|
| [#560](https://github.com/beobungbu/BeeUI/issues/560) | OPEN | documentation,area:docs,area:ai-agent | docs/llm: llms-components.txt and /docs/ai/ never link the per-component Props pages |
| [#562](https://github.com/beobungbu/BeeUI/issues/562) | OPEN | documentation,area:compatibility,area:docs | docs(expo): fresh checkout fails tsc until undocumented `uniwind generate-artifacts` runs |
| [#565](https://github.com/beobungbu/BeeUI/issues/565) | OPEN | documentation,area:docs,area:components | docs(components): *Trigger components are pressables; wrapping IconButton nests <button> on Web |
| [#567](https://github.com/beobungbu/BeeUI/issues/567) | OPEN | documentation,area:docs,area:ai-agent | docs/llm: llms-components.txt claims DatePicker is native-only; the component page, the guide and the package all say it ships date-picker.web.tsx |
| [#569](https://github.com/beobungbu/BeeUI/issues/569) | OPEN | documentation,area:docs | docs(timeline): TimelineStatus literal values are not published on the Timeline page |
| [#575](https://github.com/beobungbu/BeeUI/issues/575) | OPEN | documentation,area:docs | docs(web start): "Vite configuration" section has no configuration; fresh reader builds an unstyled app (62 min) |
| [#576](https://github.com/beobungbu/BeeUI/issues/576) | OPEN | documentation,area:docs | docs(start): no project-creation step, Web install order hits ERESOLVE, Expo provider example ignores expo-router root |
| [#577](https://github.com/beobungbu/BeeUI/issues/577) | OPEN | documentation,area:docs | docs(styling entry): @source paths given without the CSS file location; wrong relative path silently unstyles the app |
| [#578](https://github.com/beobungbu/BeeUI/issues/578) | OPEN | documentation,area:docs | docs(components): "Verified example source" blocks are fragments, not runnable as pasted (7 of 8 pages checked) |
| [#579](https://github.com/beobungbu/BeeUI/issues/579) | OPEN | documentation,area:docs,area:components | docs(props): PaginationItem.page and BeeThemeScope.appearance/brand marked required in the tables but optional in the .d.ts |
| [#580](https://github.com/beobungbu/BeeUI/issues/580) | OPEN | documentation,area:docs | docs(props generator): 30 declared defaults rendered as "—", 2 phantom type names, 2 undocumented Table props (62 components checked) |
| [#581](https://github.com/beobungbu/BeeUI/issues/581) | OPEN | bug,documentation,area:docs | docs(branding): "Register a brand of your own" example throws Uniwind not-registered at runtime; page still says packages unpublished |
| [#582](https://github.com/beobungbu/BeeUI/issues/582) | OPEN | documentation,area:docs | docs(patterns): 30 of 37 "State and callback contract" blocks reference undefined domain types and fail tsc as pasted |
| [#583](https://github.com/beobungbu/BeeUI/issues/583) | OPEN | documentation,area:docs | docs(config): Troubleshooting metro fragment and Theming CSS block do not match a working app config (missing wrapper, path, @source) |
| [#585](https://github.com/beobungbu/BeeUI/issues/585) | OPEN | documentation,area:docs | docs: readability and knowledge-transfer audit of the whole site (52 pages 3.82/5, templates 3.0 and 3.3, exam 50/50) with 7 site-level fixes |
| [#594](https://github.com/beobungbu/BeeUI/issues/594) | OPEN | documentation | docs/types(tokens): documented chart token path colors.chart-series-1 does not typecheck; the real path is chart.series-1 |
| [#599](https://github.com/beobungbu/BeeUI/issues/599) | OPEN | documentation | docs/tokens(typography): the type scale is not reachable as text-<step> classes; only Text variant works, and no page says so |
| [#609](https://github.com/beobungbu/BeeUI/issues/609) | OPEN | bug,documentation | docs/theming: Uniwind.setTheme('system') does not resume following the OS after an explicit theme |

### Khác

| # | State | Labels | Title |
|---|---|---|---|
| [#574](https://github.com/beobungbu/BeeUI/issues/574) | OPEN | documentation,area:docs,area:ai-agent | [Consumer audit] Docs site vs llms*.txt consistency matrix (BeePOS) |

### Umbrella (nhiều item)

| # | State | Labels | Title |
|---|---|---|---|
| [#566](https://github.com/beobungbu/BeeUI/issues/566) | OPEN | documentation,area:compatibility,area:docs | consumer audit umbrella: minor compat/docs/API gaps from BeePOS (6 items) |
| [#573](https://github.com/beobungbu/BeeUI/issues/573) | OPEN | documentation,area:docs,area:components | consumer audit umbrella 2: Chip static variant, ChipGroup deselect, DatePicker locale copy, Accordion type prop, nested-pressable rule (5 items) |
| [#590](https://github.com/beobungbu/BeeUI/issues/590) | OPEN | documentation,area:docs | consumer audit umbrella 3: overlapping pages, accessibility sidebar order, Learn examples with undeclared types, Reference Core descriptions, Text.numeric robustness, site stalls |
| [#592](https://github.com/beobungbu/BeeUI/issues/592) | OPEN | documentation,enhancement | consumer audit umbrella 4: OTPInput segmented appearance, Switch accent warning on web, DropdownMenuTrigger is a Button (3 items) |
| [#597](https://github.com/beobungbu/BeeUI/issues/597) | OPEN | documentation,enhancement | consumer audit umbrella 5: labelClassName vs ButtonLabel, SearchInput trailing slot and focus ref, Badge in TableCell, Screen does not scroll, ListItem node title loses accessible name (5 items) |
| [#603](https://github.com/beobungbu/BeeUI/issues/603) | OPEN | enhancement | consumer audit umbrella 6: no per-table row density step (44/56/64 only), DropdownMenuItem has no secondary-line slot (2 items) |
| [#607](https://github.com/beobungbu/BeeUI/issues/607) | OPEN | bug,enhancement | consumer audit umbrella 7: Dialog renders two nested role=dialog nodes, DropdownMenuTrigger has no hover state or pointer callbacks (2 items) |
| [#611](https://github.com/beobungbu/BeeUI/issues/611) | OPEN | documentation,enhancement | consumer audit umbrella 8: no toolbar overflow primitive, Stepper vertical-only and 1-based clamp, disabled Switch states identical, Select inside Popover undocumented, vertical Separator needs explicit height (6 items) |
| [#613](https://github.com/beobungbu/BeeUI/issues/613) | OPEN | bug,enhancement | consumer audit umbrella 9: SegmentedControl radiogroup has no accessible name, SelectValue empty for empty-string value, Badge outline looks disabled, IconButton has no count slot (4 items) |


**#566 sub-items:**
1. Compatibility page omits five declared peers
2. Exact `react-native@0.86.2` pin is one patch behind Expo SDK 57
3. `ListItem` has no `active`/`selected` prop
4. Three version strings in public surfaces
5. `OTPInput.onChange` event shape undocumented
6. `/sitemap-index.xml` at the site root returns an empty body

**#573 sub-items:**
1. No static tag chip
2. `ChipGroup` single mode has no "none/any" state
3. `DatePicker.locale` does not localize the component's own copy
4. `Accordion` drops the shadcn-style `type="single" | "multiple"` prop
5. Nested-pressable pitfall generalises

**#590 sub-items:**
1. Overlapping pages restate each other
2. Accessibility sidebar order does not match the index
3. Learn examples reference undeclared prop types
4. Reference Core leaves 12 of 25 values without a description
5. `Text.numeric` crashes on an invalid literal
6. Site availability (operational)

**#592 sub-items:**
1. OTPInput has no segmented (one box per digit) appearance
2. Switch logs a Uniwind accent warning on web on every mount
3. DropdownMenuTrigger is a full Button; docs do not say so

**#597 sub-items:**
1. Button `labelClassName` is ignored when the child is an explicit `ButtonLabel`
2. `SearchInput` has no trailing slot and no way to focus it
3. `Badge` as a direct child of `TableCell` stretches to the column width
4. No family member is a scrolling page container
5. `ListItem` loses its accessible name when `title` is a node

**#603 sub-items:**
1. Table row density is global and has no 48 pt step
2. DropdownMenuItem has no secondary-line slot

**#607 sub-items:**
1. Dialog renders two nested `role="dialog"` nodes
2. DropdownMenuTrigger has no hover state and forwards no pointer callbacks

**#611 sub-items:**
1. No overflow / collapse primitive for a toolbar row
2. Stepper is vertical only, with no orientation prop
3. Stepper numbering is 1-based and a 0 clamps silently
4. A disabled Switch looks the same on and off
5. A Select inside a Popover works, but neither page says it may
6. `Separator orientation="vertical"` draws nothing without an explicit height

**#613 sub-items:**
1. SegmentedControl gives its `radiogroup` no accessible name
2. SelectValue renders nothing when the bound value is the empty string
3. `Badge variant="outline"` is visually indistinguishable from a disabled text input
4. IconButton has no count slot

### i18n

| # | State | Labels | Title |
|---|---|---|---|
| [#610](https://github.com/beobungbu/BeeUI/issues/610) | OPEN | bug,documentation | i18n: PasswordInput renders a hardcoded English "Show" / "Hide"; showLabel/hideLabel only change the accessible name |

## Notes
- #586 has no consumer tag in body; filed 2026-09-11 in the BeePOS iOS simulator batch (#584–#590), attributed to BeePOS.
- #551 closed as duplicate of #552.
- #570 references both consumers; found by BeePOS.
- Labels on #591–#615 are generic (bug/documentation/enhancement) without area:* labels; earlier batch #560–#590 is fully triaged.
