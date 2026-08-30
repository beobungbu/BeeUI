# GitHub-hosted CI optimization — migration + caching plan

Prepared while private; **apply after the repo is public** (GitHub-hosted standard runners are
free for public repos, incl. macOS + Linux+KVM for Android). Goal: retire the single self-hosted
Mars box; run all CI on free, auto-scaling GitHub-hosted runners with aggressive caching so cold
cost (esp. macOS ×concurrency-limited) stays low.

## 1. Runner mapping (one-line swaps)
| Job | file | now | → github-hosted |
|---|---|---|---|
| verify | ci.yml | `[self-hosted, beeui]` | `ubuntu-latest` |
| bare-native | ci.yml | `[self-hosted, beeui]` | `ubuntu-latest` |
| ios-native | ci.yml | `[self-hosted, beeui-macos]` | `macos-latest` (has Xcode 26.6 — verified) |
| ios-runtime | runtime-native.yml | `[self-hosted, beeui-macos]` | `macos-latest` |
| android-runtime | runtime-native.yml | `[self-hosted, beeui]` | `ubuntu-latest` (KVM available) |
| visual-web / web-a11y | *.yml | `[self-hosted, beeui]` | `ubuntu-latest` |

Keep the least-privilege `permissions:` + fork guards from #324. Concurrency `cancel-in-progress` already set.
Remove the self-hosted-only pod snapshot mechanism (`BEEUI_IOS_CACHE_ROOT` rsync) and the hardcoded
`/opt/homebrew/bin/pod` (use `pod` on PATH) — replaced by `actions/cache` below.

## 2. Global win — pnpm store cache (every job)
Every job runs `pnpm install`. After corepack enables pnpm, set a uniform store and cache it:
```yaml
- name: pnpm store dir
  run: pnpm config set store-dir "$HOME/.pnpm-store"
- name: Cache pnpm store
  uses: actions/cache@v4
  with:
    path: ~/.pnpm-store
    key: pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
    restore-keys: pnpm-${{ runner.os }}-
```
(Alternative: reorder to `pnpm/action-setup` → `actions/setup-node` with `cache: pnpm` — auto. But
explicit cache is fewer moving parts given the current corepack flow.) Biggest, safest speedup.

## 3. Per-job caches (paths + keys)
### verify (ubuntu) — pnpm + Metro/Expo
Expo export ×3 (web/android/ios) + prebuild are Metro-heavy. Cache Metro:
```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.expo
      node_modules/.cache
      .expo
    key: metro-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml','apps/showcase/app.json') }}
    restore-keys: metro-${{ runner.os }}-
```

### bare-native (ubuntu) — pnpm + Gradle + Android SDK
```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.gradle/caches
      ~/.gradle/wrapper
    key: gradle-${{ runner.os }}-${{ hashFiles('**/*.gradle*','**/gradle-wrapper.properties') }}
    restore-keys: gradle-${{ runner.os }}-
```
`android-actions/setup-android@v4` already caches SDK packages; keep it.

### ios-native (macos) — pnpm + CocoaPods + DerivedData
```yaml
- uses: actions/cache@v4         # CocoaPods spec + downloads
  with:
    path: |
      ~/.cocoapods
      ~/Library/Caches/CocoaPods
    key: pods-macos-${{ hashFiles('pnpm-lock.yaml') }}   # proxy: RN deps drive pod versions
    restore-keys: pods-macos-
- uses: actions/cache@v4         # Xcode DerivedData (build objects)
  with:
    path: ~/Library/Developer/Xcode/DerivedData
    key: dd-macos-${{ hashFiles('pnpm-lock.yaml') }}
    restore-keys: dd-macos-
```
DerivedData cache is best-effort (invalidates on Xcode/source drift) — big win when it hits, harmless on miss.

### ios-runtime (macos) — pnpm + CocoaPods + DerivedData + Maestro
Same pods + DerivedData as above, plus:
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.maestro
    key: maestro-${{ runner.os }}-${{ hashFiles('scripts/runtime-smoke/install-maestro.sh') }}
```

### android-runtime (ubuntu) — pnpm + Gradle + Maestro + **AVD snapshot**
Biggest android win: cache the created AVD so the emulator boots from snapshot. Recommended: switch the
manual emulator launch to **`reactivecircus/android-emulator-runner@v2`**, which handles KVM + AVD
create + boot-snapshot caching:
```yaml
- uses: actions/cache@v4
  id: avd-cache
  with:
    path: |
      ~/.android/avd/*
      ~/.android/adb*
    key: avd-31-${{ runner.os }}         # bump when API/target changes
- if: steps.avd-cache.outputs.cache-hit != 'true'
  uses: reactivecircus/android-emulator-runner@v2
  with: { api-level: 31, arch: x86_64, force-avd-creation: false, emulator-options: -no-window -gpu swiftshader_indirect -no-snapshot-load, script: echo "seed AVD snapshot" }
- uses: reactivecircus/android-emulator-runner@v2
  with: { api-level: 31, arch: x86_64, force-avd-creation: false, emulator-options: -no-snapshot-save -no-window -gpu swiftshader_indirect, script: bash ./scripts/runtime-smoke/android.sh }
```
(If keeping the current manual launch, at minimum add the `~/.android/avd` cache + keep the KVM check.)

### visual-web / web-a11y (ubuntu) — pnpm + **Playwright browsers**
`playwright install --with-deps chromium` re-downloads Chromium (~150MB) each cold run. Cache it:
```yaml
- uses: actions/cache@v4
  id: pw-cache
  with:
    path: ~/.cache/ms-playwright
    key: pw-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
    restore-keys: pw-${{ runner.os }}-
- run: pnpm --dir apps/visual-regression exec playwright install ${{ steps.pw-cache.outputs.cache-hit == 'true' && '' || '--with-deps' }} chromium
```
(On cache hit, skip the browser download; still `--with-deps` on miss for the apt libs.)

## 4. Optional — batch iOS to save the (concurrency-limited) macOS pool
Free public macOS is free but concurrency-capped (~5). Keep iOS off the per-PR merge gate:
gate PRs on `verify + visual-web + web-a11y + bare-native` (Linux); run `ios-native`/`ios-runtime`
on `push` to main + nightly `schedule` + on-demand `ci:ios` label. bare-native already bundles iOS JS
(catches import/bundling). Native-implementation PRs (#153/#158/#167/#174) get `ci:ios` explicitly.

## 5. Expected effect
- Cold first run per cache key: similar to today. Warm runs: pnpm/pods/gradle/playwright/AVD restored →
  setup minutes cut ~50–70%; macOS ×10 concern replaced by free public macOS.
- All jobs auto-scale (parallel across PRs) instead of serializing on one box → the throughput cap is gone.

## 6. Apply order (post-public)
1. Flip repo public (owner).
2. One PR: runner swaps + caches + drop self-hosted cruft (this plan). Validate on the PR itself (it runs on github-hosted). Iterate keys if a path is wrong (cache miss is non-fatal).
3. Merge → main + nightly + `ci:ios` all on github-hosted. Decommission Mars.

## Open items
- Confirm exact free-tier macOS allowance on public with one real run (Linux+Android are unconditionally free).
- DerivedData cache size vs the 10 GB/repo Actions cache limit — monitor; evict oldest if it crowds pods/gradle.
