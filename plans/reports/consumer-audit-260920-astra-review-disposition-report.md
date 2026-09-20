# Disposition of Astra's independent review (2026-09-20)

Review: plans/reports/from-astra-260920-consumer-audit-review-report.md. Fix work: WS-O (plans/260919-1258-consumer-audit-followups/phase-O-astra-review-fixes.md).

| Finding | Disposition | Evidence / action |
|---|---|---|
| major · dist-tag policy explanation "unsupported by npm docs" | **Partially rejected, wording corrected** (c026a6e) | The causal claim is backed by this repo's own publish log: release run 34294238899 (2026-09-09, job `bootstrap-rc`) printed `npm notice Publishing to https://registry.npmjs.org/ with tag next and public access` for every package, and `npm view … dist-tags` still shows `latest` = `next` = 0.86.2-rc.1. npm's general docs describe the non-first-publish case; the registry's mandatory `latest` on a first publish is the observed edge. The over-claim that the tag "cannot be removed" was not verified and is now stated as unverified; the policy does not depend on it. `dist-policy`, `release-control-plane`, `public-truth`, `llms`, `ai-contract` checks green after the rewrite. |
| major · Toolbar roving focus counts non-focusable items | **Accepted** | WS-O item 1: sequence derived from registered focusables; Fragment/null/text treated as non-focusable with a dev warning; tests for null, conditional, Fragment, plain element, disabled. |
| major · TableRow onPress has no embedded-action exclusion | **Accepted** | WS-O item 2: Web ignores activation from interactive descendants (click and Enter/Space); native nested-Pressable test; Table page documents the a11y rule for rows with onPress. |
| minor · packed consumer does not exercise BeeThemeScope/useBeeToken | **Accepted** | WS-O item 3: fixture in examples/web-consumer + assertion in scripts/verify-web-consumer.sh (runs in the web-consumer workflow against packed tarballs). |
| plausible · Sheet rapid close→reopen race | **Accepted as test-first** | WS-O item 4: deterministic jest with the gorhom mock; fix only if it fails; Maestro rapid-toggle case added. |
| unverified · Android sheet runtime | **Open (owner)** | Android emulator/device smoke for present, backdrop/swipe/back dismissal, reopen; recorded in #619 follow-ups. |
| unverified · 38 refreshed baselines | **Partially covered** | Coordinator inspected the representative diffs (forms, foundation, sign-in, table, high-contrast input, date-time picker) and WS-M measured the popover geometry; the remaining theme/viewport variants of the same fixtures were accepted by class. No further action unless a reviewer finds a delta outside the five intentional changes. |
| #619 layers A–D | **Adopted as revised** | Comment posted on #619: A without the outer-provider skip, B spike-first on both platforms, C with single topmost toast renderer, D diagnostics report the boundary; legacy transport retired separately. |
| Cleared by reviewer | — | CI edits still compile both Android APKs and iOS; public-surface delta is the expected 9 rows; #606 diagnosis correct; #584 mount-time dismiss matches upstream gorhom 5.2.14 defect. |

PR state: #617 and #618 stay open until WS-O lands on `fix/consumer-audit-followups` and CI is green again; #617 is not amended separately because #618 is stacked on it and will carry the TableRow fix.
