# WS-D2 · docs: components, props generator, patterns, llms, site structure

Owned: apps/docs/src/content/docs/{components,patterns,learn,reference,accessibility,ai,responsive.md}/**, scripts/ docs generators (props/reference/llms/patterns generators and their scripts/__tests__), llms*.txt (regenerate, never hand-edit), apps/docs sidebar config (astro.config.mjs). Do NOT touch packages/ui/src. WS-C may edit the Table docs page for #572 — leave components/table.md* alone.

Issues (read each with `gh issue view N --repo beobungbu/BeeUI`):
- #560 llms-components.txt and /docs/ai/ must link per-component Props pages.
- #567 llms-components.txt wrongly says DatePicker native-only → fix generator source of truth.
- #565 Document that *Trigger components are pressables (nesting IconButton nests <button>); add "do not nest pressables" callout; #573 item 5 generalize nested-pressable rule (ListItem trailing IconButton, SettingsItem + AlertDialogTrigger). #592 item 3: DropdownMenuTrigger is a full Button — say so.
- #569 Timeline page publishes TimelineStatus literal values.
- #578 "Verified example source" blocks must be runnable as pasted (imports + wrapper) — fix the 7 pages named + the generator so future blocks are complete.
- #579 Props tables: PaginationItem.page and BeeThemeScope.appearance/brand marked required but optional in .d.ts → fix generator optionality detection.
- #580 Props generator: 30 declared defaults rendered "—", 2 phantom type names, 2 undocumented Table props → fix generator; add scripts/__tests__ cases.
- #582 Patterns: 30 of 37 "State and callback contract" blocks reference undefined domain types → declare the types inline or import from a shown snippet so blocks tsc as pasted; extend docs:patterns:check to compile them if feasible.
- #585 Readability audit: apply the 7 site-level fixes listed in the issue.
- #590 items 1-4: merge/cross-link overlapping responsive pages; fix accessibility sidebar order to match index; declare prop types in Learn examples; add descriptions for the 12 undocumented Reference Core values.
- #574 Docs vs llms consistency matrix: resolve every row marked inconsistent (regenerate llms after fixes; `pnpm llms:check`).
- #573 item 4: Accordion page callout for shadcn `type="single"|"multiple"` → BeeUI equivalent. #611 item 5: say Select inside Popover is supported. #566 item 5: document OTPInput.onChange event shape. #566 item 6: /sitemap-index.xml root must not be empty (fix astro/site config or redirect).

Checks: `pnpm docs:reference:check && pnpm docs:surface:check && pnpm docs:portal-pages:check && pnpm docs:a11y:check && pnpm docs:examples:check && pnpm docs:patterns:check && pnpm llms:check && pnpm ai-contract:check && pnpm docs:contract:check` plus `node --test scripts/__tests__` for touched generators.
