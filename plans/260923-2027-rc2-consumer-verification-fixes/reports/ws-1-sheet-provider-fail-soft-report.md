# W1: native Sheet without SheetProvider must not crash (#629, #584)

Branch `ws1-sheet-provider-fail-soft`, based on `243c4ae`. Worktree:
`/Users/textsoft/workspace/BeeUI/.claude/worktrees/agent-a2f04cc406762d353`.

## Root cause (proven)

The consumer's rc.1 wiring is `GestureHandlerRootView > BottomSheetModalProvider > BeeUIProvider > app`,
with no `SheetProvider`. Two failure modes exist; the consumer hit the first one (A).

### A. Outer gorhom provider above BeeUIProvider (the #629 crash)

1. gorhom's modal provider wraps its children in `@gorhom/portal`'s `PortalProvider`. That provider's root
   `PortalHost` is a **sibling rendered after the children**:
   `@gorhom/bottom-sheet@5.2.14 src/components/bottomSheetModalProvider/BottomSheetModalProvider.tsx:202-210`,
   `@gorhom/portal@1.0.14 src/components/portalProvider/PortalProvider.tsx:18-21`.
   With the rc.1 wiring, the gorhom host therefore sits **outside** `BeeUIProvider`.
2. A presented `BottomSheetModal` renders its children through `<Portal hostName={hostName}>` into that
   host (`BottomSheetModal.tsx:536-544`). The Sheet content is re-parented outside `BeeUIProvider`.
3. `BeeUIProvider` (`packages/ui/src/components/safe-area.tsx:59-65`) mounts `OverlayRuntimeProvider`. On native,
   its `RootBoundary` is teleport's `PortalProvider` (`overlay-runtime.tsx:632`,
   `overlay-transport.native.tsx:25-26`). The re-parented content is outside it.
4. `SheetContent` captures the overlay runtime where it is declared (`sheet.native.tsx:553` at `243c4ae`). It then
   re-provides that runtime inside the portal through `OverlayRuntimeBridge` (`sheet.native.tsx:738-747`,
   `overlay-runtime.tsx:741-751`). The bridge re-provides BeeUI's `OverlayTransportContext` (mode
   `native-teleport`). It does **not** re-provide teleport's own private `PortalManagerContext`, which only
   `PortalProvider` supplies.
5. The content always renders `ModalOverlayHost` (`sheet.native.tsx:756`), which renders the transport's
   `HostOutlet` (`overlay-runtime.tsx:824,843`). On native that is teleport's `PortalHost`
   (`overlay-transport.native.tsx:28-29`). `PortalHostComponent` calls `usePortalManagerContext()`
   (`react-native-teleport@1.1.13 src/components/PortalHost.tsx:28-29`). That call throws
   `usePortalContext must be used within PortalProvider` (`src/contexts/PortalManager.tsx:34-38`). This matches
   the consumer's stack (`PortalHostComponent` < `HostOutlet`). No error boundary catches it, so the app root
   unmounts and the screen goes blank.

The app crashes only on open because gorhom mounts the portal only while presented (`mount` state,
`BottomSheetModal.tsx:536`). Duplicate `@gorhom/portal` or teleport copies are not the cause: one copy of each
resolves. The failure is provider topology alone: a store-backed portal moves content out of a provider that
teleport's hooks require. The same crash occurs when `SheetProvider` is mounted above `BeeUIProvider`.

### B. No gorhom provider at all

`BottomSheetModal` calls `useBottomSheetModalInternal()` without `unsafe` (`BottomSheetModal.tsx:72-78`). With no
provider, that throws `'BottomSheetModalInternalContext' cannot be null!` (`src/hooks/useBottomSheetModalInternal.ts`).
The screen crashes as soon as `SheetContent` mounts, even while the Sheet is closed.

## Fix (`packages/ui/src/components/sheet.native.tsx` only)

- **No gorhom provider** (`useBottomSheetModalInternal(true) === null`): `SheetContent` renders nothing. It does
  not call `present()` or `dismiss()`, and it does not register the Android back listener.
  - Rationale: with no modal provider there is no host to present into.
  - A locally provisioned provider was rejected: it would size the sheet to the box around `SheetContent` and
    would also need a `GestureHandlerRootView`, so the sheet would render wrong on screen.
  - A clear dev error and a sheet that stays closed are safer than a sheet that renders wrong.
- **gorhom host outside BeeUI's overlay runtime** (rc.1 wiring, or `SheetProvider` mounted above `BeeUIProvider`):
  - The new `SheetHostTransportBoundary` runs where gorhom mounts the content. The case applies when the
    captured transport is non-null but no overlay runtime is visible at that host, which means teleport's
    `PortalProvider` is not above it either.
  - In that case the sheet content gets its own `createLegacyStoreTransport()`, with its `RootBoundary`,
    instead of the teleport transport.
  - The sheet **still presents and works**, and nested overlays render under the sheet's modal-local host.
  - Trade-off: nested overlays keep BeeUI's bridged contexts but lose app context declared between the sheet and
    the overlay. This is the documented behavior of the legacy host.
  - When the host is inside the runtime (the correct wiring), nothing changes.
  - The check looks at the actual mechanism (whether the runtime is visible at the host), not at whether
    `SheetProvider` is mounted. An outer provider mounted *below* `BeeUIProvider` therefore keeps full teleport
    behavior.
- **Dev diagnostics** (`console.error`, once per JS runtime):
  - `SheetContent` without `SheetProvider`, detected through a private `SheetProviderPresenceContext`. The message
    names `SheetProvider`, gives the wiring `<BeeUIProvider><SheetProvider>{app}</SheetProvider></BeeUIProvider>`,
    and says to remove any outer `BottomSheetModalProvider`. It also says what happens until then: the Sheet
    either does not open, or presents from the outer provider without guarantees.
  - `SheetProvider` mounted outside `BeeUIProvider` (no overlay runtime visible): the message gives the same wiring.
- Unchanged: the `SheetProvider` wiring itself, `sheet-context-bridge.tsx` (not needed),
  `overlay-transport.native.tsx`, `sheet.tsx` and `sheet.web.tsx`.

## Tests

New:
- `apps/showcase/__tests__/helpers/gorhom-modal-portal-mock.tsx`:
  - A gorhom mock that keeps gorhom's provider topology. It throws when no provider is mounted.
  - Its provider uses the **real** `@gorhom/portal` `PortalProvider` and `Portal`, so presented content is
    re-parented under the provider's trailing host.
  - A teleport mock that keeps only the real `PortalProvider` guard and its exact error message.
- `sheet-native-provider-fail-soft.test.tsx`:
  - (c) `BeeUIProvider > SheetProvider`: the sheet presents, the transport stays `native-teleport`, `SheetClose`
    works, and no SheetProvider error is logged. This test runs first so that the once-per-runtime flag cannot
    hide an error.
  - (a) No provider: two sheets go through open, close and open again. Nothing throws, nothing renders, and
    exactly one error is logged.
- `sheet-native-outer-gorhom-provider.test.tsx`:
  - (b) rc.1 wiring: the sheet opens without throwing, and its content mounts under gorhom's host outside
    `BeeUIProvider`.
  - A nested `OverlayPortal` renders, `SheetClose` works, reopening works, and exactly one error is logged.
  - This is a separate file because the error is logged only once per module registry.
- `helpers/render-with-modal-provider.tsx`: a shared wrapper for suites that assume a mounted modal provider.

### Red on `243c4ae` (unfixed `sheet.native.tsx`, new tests only)

```
FAIL __tests__/sheet-native-provider-fail-soft.test.tsx
  ● Sheet (native) without any sheet modal provider › does not throw when opened and logs one actionable development error
    thrown: "'BottomSheetModalInternalContext' cannot be null!"
FAIL __tests__/sheet-native-outer-gorhom-provider.test.tsx
  ● Sheet (native) under an outer gorhom provider without SheetProvider › opens without throwing, keeps nested overlays working, and logs one development error
    usePortalContext must be used within PortalProvider
      at usePortalManagerContext (__tests__/helpers/gorhom-modal-portal-mock.tsx:101:25)
      at usePortalManagerContext (__tests__/helpers/gorhom-modal-portal-mock.tsx:118:5)   <- PortalHost
Tests:       2 failed, 1 passed, 3 total
```
The test that passes is (c), which covers the unchanged `SheetProvider` behavior.

### Green on the branch

The two new files report `Tests: 3 passed, 3 total`.

Mutation check: forcing `hostOutsideRuntime = false` in `SheetHostTransportBoundary` makes (b) fail again with
`usePortalContext must be used within PortalProvider`. This shows that the boundary removes the crash, not the
test setup.

### Existing tests adjusted (and why they missed this)

- `issue-158-sheet-native.test.tsx`, `issue-160-sheet-runtime-acceptance.test.tsx`,
  `sheet-native-rapid-close-reopen.test.tsx` and `sheet-native-double-dismiss-race.test.tsx` rendered
  `SheetContent` with **no** gorhom provider. That is the setup that crashes on device (failure mode B).
  - They now render through `helpers/render-with-modal-provider.tsx`, whose wrapper is the suite's mocked
    `BottomSheetModalProvider`.
  - The three local mocks gained `BottomSheetModalProvider` and `useBottomSheetModalInternal`.
  - Assertions are unchanged.
  - In `issue-158`, the `SheetProvider` ownership tests are not wrapped, so their probes still test something.
- Why the existing gates missed #629:
  1. Every gorhom mock (the global one in `jest.setup.ts` and the local ones) rendered `BottomSheetModal` children
     **in place** and never threw without a provider. The provider requirement and the re-parenting were invisible.
  2. Jest has no registered `PortalHostView`, so `BeeUIProvider` resolves the **legacy** transport, whose
     `HostOutlet` tolerates a missing store context. Suites that force teleport mock `PortalHost` as `() => null`,
     with no provider guard.
  3. The one detached-host test deliberately placed its host **inside** `BeeUIProvider`
     (`issue-158`, "routes anchored-overlay portal content...", comment "#619 A"). That is the `SheetProvider`
     topology, never the rc.1 one.

## Commands run

```
export PATH="$HOME/.nvm/versions/node/v24.13.1/bin:$PATH"; export LC_ALL=en_US.UTF-8
pnpm install --frozen-lockfile
pnpm --filter '@beemvp/beeui-ui...' run build
pnpm --filter @beemvp/beeui-showcase exec jest --runInBand <new tests>                   # red on 243c4ae, green on branch
pnpm --filter @beemvp/beeui-showcase exec jest --runInBand <26 suites mentioning Sheet>  # 26/26 suites, 223/223 tests
pnpm --filter @beemvp/beeui-showcase exec jest --runInBand                               # full showcase suite, see below
pnpm --filter @beemvp/beeui-ui typecheck                                                 # clean
pnpm --filter @beemvp/beeui-showcase typecheck                                           # clean
pnpm lint                                                                                # clean
```

Baseline note: before the ui build, `perf-overlay-latency`, `showcase-root` and `sheet-web-viewport-geometry`
failed to load with `Cannot find module '@beemvp/beeui-tokens/motion-runtime'`. The cause was environmental (no
dist build yet). After the build they pass on both the base commit and the branch.

The web and generic Sheet suites (`sheet-web-viewport-geometry`, `issue-157-sheet-api`) pass unchanged.

Full showcase suite: `Test Suites: 134 passed, 3 failed, 137 total; Tests: 1191 passed, 3 failed`.
- All 3 failures were 5 s jest timeouts. The machine was running several other agents' jest runs in parallel at
  the time.
- The failing tests were `overlay-transport` (a Dialog/Popover test), `perf-render-commit` (the Calendar
  benchmark hook) and `wave-2a-select` (a 101-option list).
- None of them renders a Sheet.
- Rerun on their own, all three pass: `overlay-transport` 19/19, `wave-2a-select` + `perf-render-commit` 33/33.

## Needs real-device proof

- rc.1 wiring on iOS (BeePOS setup, teleport 1.2.2): opening a Sheet should no longer blank the app. The Sheet
  presents from the outer provider. Check that it is visible, that the backdrop and close work, and that a
  Popover opened inside it shows. The Jest proof models gorhom and teleport topology from their sources; it does
  not run their native views.
- No gorhom provider at all: the screen mounts, the Sheet stays closed, and one red LogBox error names `SheetProvider`.
- Correct wiring (`BeeUIProvider > SheetProvider`): unchanged. The Sheet should still present at 50% (the #584
  acceptance).
- Not addressed here (outside W1 scope, but listed in #629):
  - the drag handle floating above the panel
  - the backdrop being limited to a route-level `SheetProvider`
  - auto-mounting `SheetProvider` from `BeeUIProvider`
  - the docs and llms coverage (W6)
- This repo installs teleport 1.1.13; BeePOS runs 1.2.2. The guard message in the consumer report is identical,
  but the 1.2.2 source was not inspected.
- Location note: the task asked for this report in the `beeui-portal-pages-ci-e8e1fc` worktree. This agent is
  sandboxed to its own worktree, so the report is at the same relative path here:
  `plans/260923-2027-rc2-consumer-verification-fixes/reports/ws-1-sheet-provider-fail-soft-report.md`.
