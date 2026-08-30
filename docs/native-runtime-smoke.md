# Native runtime smoke

BeeUI's native runtime smoke layer proves interaction that Jest, browser integration, Expo export, Prebuild, and generic Simulator compilation cannot prove.

## Evidence boundaries

The verification layers are intentionally distinct:

1. **deterministic tests** — Jest/RNTL/source contracts;
2. **browser integration** — Playwright/Web visual and interaction proof;
3. **native compile** — generated Expo project and true bare React Native compile proof;
4. **real simulator/emulator runtime** — this suite, running the installed Showcase on an iOS Simulator or Android Emulator;
5. **physical-device evidence** — separately recorded manual/device execution only. Simulator/emulator PASS never implies physical-device PASS.

## Why Maestro

The repository previously had no native UI-driving framework. iOS `simctl` can boot/install/capture but does not provide a small accessibility-selector interaction API; Android `adb` can drive hardware Back and collect evidence but is not a maintainable cross-platform selector layer. The runtime suite therefore uses a pinned Maestro CLI only for UI selectors, waits, text entry, and sheet swipe gestures. Device lifecycle, build, installation, Android Back, metadata, screenshots/video, logs, and cleanup remain platform-standard tooling.

Pinned version: `2.7.0`.

Maestro is installed outside the JavaScript workspace by `scripts/runtime-smoke/install-maestro.sh`; no production package dependency is added.

## Fixture contract

`apps/showcase/runtime-smoke/runtime-acceptance.tsx` is a QA-only Showcase surface. It may add stable `testID`/accessibility markers and controlled demo state, but it must not change BeeUI production component behavior or public APIs.

The shared fixture covers:

- explicit light → dark → light transitions;
- root Dialog and AlertDialog;
- root Popover and DropdownMenu;
- Dialog → DropdownMenu and Dialog → Popover;
- persistent Toast show/dismiss;
- input focus/text entry and keyboard-reduced usable height;
- scroll reachability;
- safe-area inset evidence;
- `overFullScreen`, `pageSheet`, and `formSheet` Dialog presentations;
- child Popover/DropdownMenu inside each iOS presentation;
- controlled sheet open state and `onRequestClose` counters for native swipe dismissal.

### Isolated movement/scroll/keyboard stress (#126)

`apps/showcase/runtime-smoke/runtime-stress-acceptance.tsx` is a separate QA-only surface reached through `showcase-open-runtime-stress`. It must stay isolated from `runtime-acceptance.tsx`: an earlier #126 revision added stress controls to the shared screen and shifted the existing Toast path enough to break the baseline runtime flow.

The dedicated stress surface and `apps/showcase/runtime-smoke/maestro/runtime-stress.yaml` prove:

- root Select open/select/close;
- root Popover outside-press dismissal;
- a **subsequent independent native scroll gesture** remains interactive, moves through labelled visual sentinels to a lower target, returns to the trigger, and allows a coherent reopen;
- explicit close still works after an outside-dismiss cycle;
- modal-local child Select remains scoped to its Dialog;
- modal-local child Popover remains coherent while a real keyboard is shown and hidden from an in-Popover focus control.

The movement test intentionally does **not** require one in-flight touch to start on `OverlayDismissLayer`, dismiss that layer, then retarget the remainder of the same gesture to the underlying `ScrollView`. That responder handoff is not part of BeeUI's documented overlay contract. The release invariant is the user-visible behavior after dismissal: the underlying surface remains interactive, viewport movement completes, and the overlay can reopen coherently.

The scroll corridor uses visible cards (`runtime-stress-scroll-sentinel-1..3`) instead of a large blank spacer. This makes video/screenshot evidence unambiguous and avoids confusing an intentionally white fixture region with a render failure.

The keyboard is raised from inside the child Popover by programmatically focusing/blurring the Dialog input. Tapping the Dialog input directly while the child Popover is open is a legitimate outside press and closes it by contract, so it cannot be used as a non-vacuous keyboard-revision setup.

## Local prerequisites

Use the repository toolchain from `AGENTS.md`: Node `24.13.1` and pnpm `10.15.0`.

Both platforms require Java 17+ for Maestro. Install the pinned CLI with:

```bash
MAESTRO_VERSION=2.7.0 bash ./scripts/runtime-smoke/install-maestro.sh
```

Before runtime smoke, the normal repository gates remain required:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm release:verify
```

### iOS Simulator

Requirements:

- macOS runner/developer machine;
- Xcode 26.4+ with an available modern iOS Simulator runtime;
- CocoaPods;
- Java 17+ and Maestro 2.7.0.

Run:

```bash
bash ./scripts/runtime-smoke/ios.sh
```

The script creates a temporary modern iPhone Pro simulator, boots it, performs clean Expo Prebuild, installs pods, compiles the Debug Simulator app, installs it, starts Metro, runs `common.yaml`, the isolated #126 `runtime-stress.yaml`, and the iOS sheet flow, records video/screenshots, and deletes the temporary simulator on exit.

Recorded metadata includes exact Git SHA, simulator UDID/model, iOS runtime/version, orientation, app id, Maestro version, and Xcode version.

### Android Emulator

Requirements:

- Linux/macOS with Android SDK command-line tools;
- hardware acceleration suitable for the Android Emulator;
- Java 17+ and Maestro 2.7.0.

Run:

```bash
bash ./scripts/runtime-smoke/android.sh
```

CI uses `reactivecircus/android-emulator-runner` to own AVD creation, boot, adb transport, and teardown for a Pixel 7 / API 36 Google APIs x86_64 device. `android.sh` consumes the already-booted emulator; it does not restart the adb server or create a competing AVD. The workflow cache stores only the AVD and keys it by API/target/arch/profile, never by reusable adb state.

Every required Back event is generated by the real platform command:

```bash
adb shell input keyevent KEYCODE_BACK
```

Maestro is used only to establish/assert UI state around those ADB commands.

The Android script temporarily reduces emulator height for the reduced-height/keyboard/scroll case, restores it on exit, captures `adb logcat`, and leaves emulator teardown to the action that created it.

## Runtime matrix

### Common

| Scenario | Automated assertion |
| --- | --- |
| Showcase launch | `showcase-home` visible |
| Component Gallery | reachable and visible |
| Pattern Gallery | reachable and visible |
| light → dark → light | explicit theme state markers |
| Dialog | open / visible / close |
| AlertDialog | open / explicit close in common flow |
| root Popover | open / content / close |
| root DropdownMenu | open / select / close / selection state |
| Toast | persistent show / dismiss |
| input/keyboard | focus + actual text injection; iOS dismisses through explicit UI instead of unreliable Maestro `hideKeyboard` |
| scrolling | bottom marker reached |
| safe area | non-zero top inset required by iOS sheet flow |

### iOS

| Case | Runtime proof |
| --- | --- |
| I1 root Popover | common flow open/content/dismiss |
| I2 Dialog → DropdownMenu | common fixture plus Android child-first matrix; iOS nested menu exercised in sheet flows |
| I3 `overFullScreen` | actual RN Modal presentation + child Popover + screenshot |
| I4 `pageSheet` | actual `presentationStyle=pageSheet`, child Popover/Menu, screenshot, keyboard, swipe dismissal |
| I5 `formSheet` | actual `presentationStyle=formSheet`, child Popover/Menu, screenshot, swipe dismissal where supported |
| I6 native swipe dismissal | sheet swipe followed by closed controlled state + `requestClose: 1` |
| I7 keyboard | text entry inside `pageSheet` + screenshot before dismissal |
| I8 #126 runtime stress | root Select; dismiss → independent movement → reopen; modal-local Select; child Popover across real keyboard show/hide |

Sheet presentation screenshots/video are retained because an automated accessibility assertion cannot prove native sheet chrome/geometry. A release reviewer must inspect exact-head artifacts before converting the run into a visual acceptance claim.

### Android

| Case | Runtime proof |
| --- | --- |
| A1 root Popover | open → real `KEYCODE_BACK` → closed |
| A2 root DropdownMenu | open → real `KEYCODE_BACK` → closed |
| A3 Dialog → DropdownMenu | Back #1 child closes/Dialog stays; Back #2 Dialog closes |
| A4 Dialog → Popover | same child-first ordering |
| A5 AlertDialog | real Back does not bypass explicit-action policy; explicit Cancel then closes |
| A6 keyboard/focus | text entry plus reduced-height scroll reachability |
| A7 #126 keyboard + child Popover ordering | keyboard raised from inside child Popover; Back #1 hides IME while Popover stays open; Back #2 closes child Popover; Back #3 closes Dialog |

### Runtime stress (#126)

Cross-platform, on the dedicated stress fixture:

| Contract | Runtime proof |
| --- | --- |
| Root Select | open / select / close / selection state |
| Outside dismissal | Popover outside press closes cleanly |
| Movement after dismissal | independent real scroll reaches labelled sentinel and lower target, returns to trigger |
| Reopen coherence | Popover reopens visibly after viewport movement and closes explicitly |
| Modal-local Select | child Select operates inside Dialog without dismissing parent |
| Keyboard host revision | child Popover stays visible across proven `keyboard: shown` and `keyboard: hidden` states |

### Sheet (`@gorhom/bottom-sheet`, #160)

The `Sheet` component added by #157/#158 is a distinct surface from the `Dialog` `pageSheet`/`formSheet` presentation styles in the iOS table above. Its dedicated runtime-acceptance matrix, evidence classes actually obtained, and the explicit real-device-gesture deferral (real native swipe/spring physics, nested-scroll gesture arbitration, true keyboard-avoidance geometry, VoiceOver/TalkBack focus-into-sheet, and RTL mirrored geometry) are recorded in `docs/sheet-runtime-acceptance.md`, not in this file's I/A tables.

## Artifacts

All runtime evidence is written under:

```text
.artifacts/runtime-smoke/ios/
.artifacts/runtime-smoke/android/
```

On failure, scripts retain as much evidence as the platform permits before cleanup.

Typical iOS artifacts:

- `metadata.txt`
- `xcodebuild.log`
- `metro.log`
- `maestro-common.log`
- `maestro-runtime-stress.log`
- `maestro-ios-sheets.log`
- sheet screenshots
- `sheet-cases.mp4`
- failure/final Simulator screenshots
- Simulator unified log on failure

Typical Android artifacts:

- `metadata.txt`
- `gradle.log`
- `metro.log`
- `runtime-stress.log` and per-scenario Maestro logs
- `adb-back.log`
- full/reduced-height screenshots
- `logcat.txt`
- UI hierarchy XML on failure

## CI scheduling

`.github/workflows/runtime-native.yml` intentionally does **not** make every ordinary pull request wait for a device matrix.

Real runtime jobs run when any of these is true:

- nightly schedule;
- manual `workflow_dispatch`;
- PR explicitly labeled `ci:runtime`;
- the foundation workstream branch `test/runtime-device-smoke` itself.

Normal PR CI remains responsible for Jest/typecheck/release verification/Web/native compile as before. Pushes to `main` continue to use the existing compile gate; runtime smoke is nightly/release-candidate evidence rather than an always-on main blocker.

Both runtime jobs have deterministic 90-minute job timeouts and platform cleanup traps.

## Failure handling

Do not repair a production component during the first runtime acceptance pass. Capture one PR comment per product finding using the release evidence contract, then create a `gap:` or bug issue with exact platform/SHA/reproduction/evidence/severity. Harness-only defects may be fixed on this branch and rerun.

The final PR comment must separate PASS, FINDINGS, and NOT TESTED and must never generalize simulator/emulator results into physical-device evidence.
