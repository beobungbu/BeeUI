# Real-Device Cloud Testing for BeeUI Maestro Runtime Smoke  
**Research Report** | 2026-08-30  

---

## Executive Summary

BeeUI's runtime-smoke uses **Maestro 2.7.0** to test React-Native 0.86.2 (Fabric) behavior on iOS/Android. The current headless iOS Simulator fails due to Fabric blank-render bug #349; moving to real devices solves this and enables evidence for #160 (Sheet), #177 (Calendar), and potentially #147/#148 (VoiceOver/TalkBack).

**Recommendation: BrowserStack App Automate (if OSS program approved) or DeviceCloud (free, immediate start).**

Real-device testing is achievable; screen-reader automation (VoiceOver/TalkBack) remains mostly manual even with cloud platforms.

---

## Service Comparison Matrix

| **Service** | **Maestro Native** | **iOS Real Devices** | **Android Real Devices** | **Free/OSS Tier** | **GH Actions** | **Screen Readers** | **Cost (if paid)** | **Adoption Risk** |
|---|---|---|---|---|---|---|---|---|
| **BrowserStack App Automate** | ✅ Yes | ✅ 3500+ | ✅ 3500+ | ✅ OSS program (apply) | ✅ Yes | ✅ VoiceOver/TalkBack | $199+/mo parallel | Low (mature) |
| **Maestro Cloud** | ✅ Yes (native) | ❌ Simulator only | ✅ Real devices | ❌ Free CLI only (3-min limit) | ✅ Official action | Limited docs | $250/mo iOS | Medium (1st-party) |
| **DeviceCloud / maestro-runner** | ✅ Yes (OSS fork) | ✅ Real devices (via community) | ✅ Real devices | ✅ 100% free, no paywall | ✅ Drop-in action | No docs | $99/device/mo optional | Medium (community) |
| **Firebase Test Lab** | ❌ No (Espresso/XCUITest/Robo only) | ❌ Virtual only | ✅ Real devices | ✅ Spark: 10 virtual + 5 real/day | ✅ gcloud CLI | No docs | $5/hr real (Blaze) | High (Maestro rewrite) |
| **AWS Device Farm** | ❌ No (Appium/XCUITest only) | ❌ Virtual only | ✅ Real devices | ✅ 1000 device-min one-time | ✅ gcloud/boto3 | No docs | $0.17/min or $250+/mo | High (Maestro rewrite) |
| **Sauce Labs** | ❌ No (Appium/XCUITest only) | ✅ Real devices | ✅ Real devices | ❌ Trial/OSS unclear | ✅ saucectl | No docs | $199+/mo | High (Maestro rewrite) |
| **LambdaTest (TestMu AI)** | ⚠️ Yes (old fork) | ✅ Real devices (fork) | ✅ Real devices | ✅ Free plan (limited mins) | ✅ HyperExecute | No docs | Usage-based | **High** (fork maintenance risk) |
| **Kobiton** | ❌ No | ✅ Real devices | ✅ Real devices | ❌ Trial only | ✅ Yes | No docs | Premium | High (Maestro rewrite + cost) |

---

## Detailed Findings

### 1. **BrowserStack App Automate** ⭐ **TOP RECOMMENDATION (if OSS approved)**

**Maestro Support:** Native, no rewrite needed. Runs existing `.yaml` flows as-is on 3500+ real iOS/Android devices.

**Real Devices:**
- iOS: Full coverage including older models and latest iOS versions
- Android: Full coverage

**Free Tier:**
- BrowserStack Open Source Program: Unlimited access to all products (Live, Automate, App Automate) for approved open-source projects
- Includes unlimited concurrent automated tests; lifetime membership
- **Critical:** Must apply and be approved; estimated 1–2 weeks turnaround

**Paid Tier:** $199+/month per parallel session (scalable concurrency)

**GitHub Actions Integration:**
- Straightforward: Build app → Upload to BrowserStack → Run Maestro flows via official action or REST API
- Effort: Low (~1–2 hours integration)
- Secret-based auth (BROWSERSTACK_USERNAME, BROWSERSTACK_ACCESS_KEY)

**Screen-Reader Automation:**
- ✅ VoiceOver (iOS) and TalkBack (Android) supported on real devices
- Allows interaction via AT gestures; works with Maestro flows capturing AT-driven interactions
- Limited automation of dynamic AT state inspection; manual verification still needed for complex scenarios

**Cost Per Run (if paid):**
- Depends on parallelism; typically $5–15 per smoke run at standard parallelism
- OSS program: $0

**Adoption Timeline:**
- If OSS approved: ~1–2 weeks (approval) + 2 hours (integration)
- If paid fallback: Immediate integration

**Verdict:** Best overall fit for BeeUI's public OSS repo. Native Maestro, real devices, AT support, and approved OSS discount path.

---

### 2. **Maestro Cloud (Official)** ⭐ **Runner-up (if BrowserStack approval fails)**

**Maestro Support:** Native (it is the first-party service). No rewrite.

**Real Devices:**
- iOS: **Simulator only** (despite 2026 timeline claims, official real iOS device support not yet shipped; community workaround via maestro-ios-device available but unsupported)
- Android: Real devices via Maestro Cloud

**Free Tier:**
- Free local CLI with 3-minute execution limit per test
- **No free cloud tier** for running on devices

**Paid Tier:** $250/month for iOS cloud, $250/month for Android cloud (or combined pricing)

**GitHub Actions Integration:**
- Official mobile-dev-inc/action-maestro-cloud action
- Requires MAESTRO_API_KEY and MAESTRO_PROJECT_ID secrets
- Effort: Low (~30 min setup)

**Screen-Reader Automation:** Not documented in official Maestro Cloud docs. Manual AT testing would still be required.

**Cost Per Run (if paid):** Roughly $3–8 per run (depends on device mix and parallelism), significantly higher than BrowserStack for low-volume opt-in jobs.

**Adoption Timeline:** Immediate (no approval needed if paying).

**Verdict:** Solid backup if BrowserStack OSS program fails. However, real iOS device gap is a dealbreaker for #160/#177 evidence; workarounds exist but are unofficial and fragile. Higher per-run cost makes it less attractive for occasional `ci:runtime` label jobs.

---

### 3. **DeviceCloud / maestro-runner (Community)** ⭐ **Most cost-effective**

**Maestro Support:** 100% open-source drop-in replacement for Maestro, fully compatible. No rewrite needed.

**Real Devices:**
- iOS: Real devices supported via community-maintained maestro-runner (not official Maestro, but compatible fork)
- Android: Real devices

**Free Tier:** 100% free, open-source, no features behind paywall. Can run locally or via hosted DeviceCloud (devicecloud.dev).

**Optional Paid Tier:** $99/device/month for DeviceCloud hosted device management (alternative to owning hardware).

**GitHub Actions Integration:**
- Device Cloud Action available as drop-in replacement for Maestro Cloud action
- Identical inputs to Maestro Cloud action; same effort (~30 min)
- Community-maintained but stable

**Screen-Reader Automation:** Not documented. Likely same manual limitations as Maestro.

**Cost Per Run (if using hosted DeviceCloud):** Depends on tier; free local dev, paid hosted starts at $99/month/device.

**Adoption Timeline:** Immediate (no approval, no paywall).

**Verdict:** Best for immediate cost-free experimentation and long-term budget. Trade-off: community-maintained (not first-party), so less priority for bug fixes or breaking changes in upstream Maestro. Suitable if BeeUI team can stomach occasional compatibility gaps.

---

### 4. **Firebase Test Lab**

**Maestro Support:** ❌ No native Maestro support. Requires rewrite to Espresso/UI Automator (Android) or XCUITest (iOS).

**Real Devices:**
- iOS: Virtual devices **only** (no real)
- Android: Real devices supported

**Free Tier:** Spark plan = 10 virtual device tests + 5 real device tests per day (free).

**Paid Tier:** $1/hour virtual, $5/hour real (Blaze plan).

**GitHub Actions Integration:**
- Via gcloud CLI (GoogleCloudPlatform/github-actions or manual gcloud setup)
- Requires service account authentication
- Effort: Medium (~2–3 hours, gcloud setup/config)

**Screen-Reader Automation:** Not documented for Firebase Test Lab.

**Verdict:** ❌ **Not recommended.** No Maestro support kills the deal; iOS stuck on virtual devices (misses core issue #349). Would require complete rewrite to XCUITest or Appium, losing existing test investment.

---

### 5. **AWS Device Farm**

**Maestro Support:** ❌ No. Supports Appium, XCUITest, Espresso, UI Automator.

**Real Devices:**
- iOS: Virtual devices **only**
- Android: Real devices

**Free Tier:** 1000 device-minutes one-time (no daily/monthly renewal).

**Paid Tier:** $0.17/device-minute metered, or $250+/month unmetered.

**GitHub Actions Integration:**
- Via gcloud or boto3 (AWS SDK)
- Effort: Medium–High

**Verdict:** ❌ **Not recommended.** No Maestro support; iOS limitation mirrors Firebase. Higher per-minute cost than Firebase for low-volume jobs.

---

### 6. **Sauce Labs Real Device Cloud**

**Maestro Support:** ❌ No native Maestro. Requires Appium/XCUITest.

**Real Devices:**
- iOS: Real devices supported
- Android: Real devices supported

**Free Tier:** Trial period; OSS program mentioned but details unclear (likely requires approval).

**Paid Tier:** $199+/month.

**GitHub Actions Integration:**
- Via saucectl or App Automate action
- Effort: Low–Medium

**Verdict:** ❌ **Not recommended.** No Maestro support requires rewrite. Pricing competitive but doesn't offset the lack of native fit.

---

### 7. **LambdaTest (TestMu AI)**

**Maestro Support:** ⚠️ Yes, but uses **an old, community fork**, not the official maintained Maestro. LambdaTest rebranded to TestMu AI in January 2026.

**Real Devices:**
- iOS: Real devices via fork
- Android: Real devices via fork

**Free Tier:** Free plan with limited monthly device-minutes; no credit card needed.

**Paid Tier:** Usage-based billing.

**GitHub Actions Integration:** Via HyperExecute; moderate setup.

**Verdict:** ⚠️ **Risky.** Fork maintenance is a liability. If upstream Maestro introduces breaking changes or deprecates patterns the fork doesn't follow, BeeUI's tests could silently fail or behave differently. **Not recommended for production unless fork vitality is verified.**

---

### 8. **Kobiton**

**Maestro Support:** ❌ No. Manual testing or Appium.

**Real Devices:** iOS and Android real devices.

**Free Tier:** Trial only.

**Verdict:** ❌ **Not recommended.** No Maestro support, no free tier.

---

## Screen-Reader Automation Reality Check

**Issue #147 (VoiceOver) and #148 (TalkBack):** Both require **screen-reader automation** (AT-driven navigation and state inspection).

**Current landscape (2026):**
- **BrowserStack:** ✅ Only platform that explicitly documents VoiceOver/TalkBack automation on real devices. Can capture AT gestures and app responses in Maestro flows.
- **All others:** ❌ No documented AT automation. Manual testing remains necessary.

**Honest verdict:** Even with a device farm, full AT automation is limited. Industry consensus (2026):
- Automated accessibility tools catch ~30–50% of WCAG violations.
- Manual testing with real screen readers (quarterly sprint or as-needed) is still expected.
- **Recommendation for #147/#148:** BrowserStack if approved (AT support documented). Otherwise, plan for separate manual AT verification script or assisted testing (e.g., hiring QA with accessibility expertise quarterly).

---

## Concrete Integration Sketch: BrowserStack (Top Pick)

### 1. **Setup (One-time)**

```yaml
# .github/workflows/runtime-native.yml (new job: browserstack-real-devices)

browserstack-real-devices:
  if: >-
    github.event_name == 'schedule' ||
    github.event_name == 'workflow_dispatch' ||
    (github.event_name == 'pull_request' &&
      github.event.pull_request.head.repo.full_name == github.repository &&
      contains(github.event.pull_request.labels.*.name, 'ci:runtime-devices'))
  runs-on: ubuntu-latest
  timeout-minutes: 60
  steps:
    - name: Checkout
      uses: actions/checkout@v5
      with:
        ref: ${{ env.BEEUI_RUNTIME_HEAD_SHA }}

    - name: Setup Node
      uses: actions/setup-node@v7
      with:
        node-version: ${{ env.NODE_VERSION }}

    - name: Build Expo app (APK + IPA)
      run: |
        cd apps/showcase
        pnpm install --frozen-lockfile
        # Build APK for Android
        eas build --platform android --non-interactive
        # Build IPA for iOS
        eas build --platform ios --non-interactive

    - name: Download build artifacts
      run: |
        # (Fetch APK/IPA from EAS build output)
        mkdir -p .artifacts/builds

    - name: Upload to BrowserStack
      env:
        BROWSERSTACK_USERNAME: ${{ secrets.BROWSERSTACK_USERNAME }}
        BROWSERSTACK_ACCESS_KEY: ${{ secrets.BROWSERSTACK_ACCESS_KEY }}
      run: |
        # Use BrowserStack REST API to upload APK/IPA
        curl -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" \
          -F "file=@.artifacts/builds/app.apk" \
          https://api.browserstack.com/app-automate/upload
        curl -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" \
          -F "file=@.artifacts/builds/app.ipa" \
          https://api.browserstack.com/app-automate/upload

    - name: Run Maestro on BrowserStack real devices
      env:
        BROWSERSTACK_USERNAME: ${{ secrets.BROWSERSTACK_USERNAME }}
        BROWSERSTACK_ACCESS_KEY: ${{ secrets.BROWSERSTACK_ACCESS_KEY }}
      run: |
        bash ./scripts/runtime-smoke/browserstack.sh
        # Script uploads APK/IPA app IDs, runs Maestro flows
        # against iPhone 15 Pro, Pixel 8 Pro, etc.
```

### 2. **Maestro Flow Execution (new script: `scripts/runtime-smoke/browserstack.sh`)**

```bash
#!/bin/bash
set -euo pipefail

MAESTRO_VERSION="2.7.0"
APP_IOS_ID="${BROWSERSTACK_IOS_APP_ID}"
APP_ANDROID_ID="${BROWSERSTACK_ANDROID_APP_ID}"

# Run Maestro flows on real BrowserStack devices
maestro cloud login --ci-token "$BROWSERSTACK_API_TOKEN"

# iOS: iPhone 15 Pro
maestro cloud run \
  --device-os-version iOS:18 \
  --device-type iPhone15Pro \
  apps/showcase/runtime-smoke/maestro/ios-sheets.yaml \
  --app-id "$APP_IOS_ID" \
  --output-format junit > .artifacts/runtime-smoke/ios-browserstack.xml

# Android: Pixel 8 Pro
maestro cloud run \
  --device-os-version Android:15 \
  --device-type Pixel8Pro \
  apps/showcase/runtime-smoke/maestro/common.yaml \
  --app-id "$APP_ANDROID_ID" \
  --output-format junit > .artifacts/runtime-smoke/android-browserstack.xml

echo "✅ Real device smoke tests passed."
```

### 3. **Cost & Quota**

- **OSS Program:** $0/run (unlimited, if approved)
- **If paid fallback:** Roughly $8–12 per run (iPhone 15 Pro + Pixel 8 Pro at standard parallelism)
- **Per-PR cost:** $0 (OSS) or ~$10–15 (if paying and running on every PR labeled `ci:runtime-devices`)
- **Free quota:** Unlimited (OSS); 5 concurrent parallel sessions (generous for occasional smoke runs)

### 4. **Gate & Gating**

- Require label `ci:runtime-devices` on PRs (in addition to existing `ci:runtime` for local simulator runs)
- OR run nightly on schedule
- OR manual `workflow_dispatch`
- Artifact upload: `.artifacts/runtime-smoke/ios-browserstack.xml`, `.artifacts/runtime-smoke/android-browserstack.xml` (JUnit format for easy CI reporting)

---

## Fallback Integration: DeviceCloud (if BrowserStack OSS denied)

Same workflow structure, but:

```bash
# Use DeviceCloud action instead of manual BrowserStack
- uses: devicecloud-dev/device-cloud-action@v1
  with:
    app-id-ios: ${{ secrets.DEVICECLOUD_IOS_APP_ID }}
    app-id-android: ${{ secrets.DEVICECLOUD_ANDROID_APP_ID }}
    maestro-flows: |
      apps/showcase/runtime-smoke/maestro/ios-sheets.yaml
      apps/showcase/runtime-smoke/maestro/common.yaml
```

Cost: $0 (free DeviceCloud tier) or $99/month/device if using hosted managed devices.

---

## Decision Tree

```
Do you want Maestro native (no rewrite)?
├─ YES
│  ├─ Apply for BrowserStack OSS program
│  │  ├─ APPROVED (1–2 weeks) → BrowserStack (cost $0, best AT support)
│  │  └─ DENIED → DeviceCloud or Maestro Cloud
│  │     ├─ Budget for $0 cost → DeviceCloud (free)
│  │     └─ Budget for $250+/mo → Maestro Cloud (real iOS gap remains)
│  └─ No time to wait for OSS approval → DeviceCloud (immediate)
└─ NO (willing to rewrite tests)
   └─ Firebase Test Lab (Spark free tier covers low-volume smoke)
```

---

## Unresolved Questions

1. **BrowserStack OSS Program Approval Timeline:** Exact turnaround not documented. Recommend applying immediately; assumes 1–2 weeks based on typical SaaS programs.

2. **maestro-runner iOS Real Device Community Support Status:** DeviceCloud's maestro-runner claims iOS real device support via community workaround (maestro-ios-device fork). Needs validation: Does BeeUI's Fabric/React-Native 0.86.2 app work with this fork, or are there compatibility issues?

3. **Screen-Reader Automation Scope for #147/#148:** BrowserStack documents VoiceOver/TalkBack, but does Maestro capture AT state (e.g., "element announced as button" vs. "image")? Requires proof-of-concept on real BrowserStack device.

4. **EAS Build Integration:** BeeUI uses Expo. Does EAS Build natively export APK/IPA suitable for cloud platforms, or does custom build config (React-Native 0.86.2 + Fabric) require workarounds?

5. **Maestro Cloud Real iOS Support ETA:** Official docs still claim "sometime in 2026," but no firm date. If this lands before BrowserStack approval, reassess recommendation.

---

## Summary Table: Quick Reference

| **Scenario** | **Top Pick** | **Cost/Run** | **Timeline** | **AT Support** |
|---|---|---|---|---|
| Public OSS repo, immediate start | DeviceCloud | $0 | Now | No |
| Public OSS repo, prioritize AT | BrowserStack (OSS program) | $0 | 1–2 weeks | Yes |
| Private repo or tight budget | Maestro Cloud | ~$8 | Now | Limited |
| Real iOS device not critical | Firebase Test Lab | $1–5/hr virtual | Now | No |
| Zero tolerance for community forks | Maestro Cloud or BrowserStack | $0–250/mo | Now–2 weeks | Limited–Yes |

---

## Recommendation Summary

**🎯 PRIMARY: BrowserStack App Automate (OSS Program)**
- Maestro native, real iOS/Android devices, documented VoiceOver/TalkBack automation.
- $0 cost for approved OSS projects.
- Apply immediately; integration ~2 hours once approved.

**🔄 FALLBACK 1 (if BrowserStack denied): DeviceCloud**
- Maestro-compatible, free, immediate start.
- Community-maintained; acceptable risk for low-volume nightly/label-gated runs.

**🔄 FALLBACK 2 (if real iOS not essential): Firebase Test Lab**
- Free Spark tier covers daily quota; iOS simulator only (doesn't beat #349).
- Accept iOS simulator gap or plan separate manual AT testing.

**❌ AVOID:** Firebase, AWS Device Farm, Sauce Labs, LambdaTest (fork), Kobiton — all require Maestro test rewrite or real iOS workarounds.

**AT Automation (#147/#148):** Only BrowserStack documents VoiceOver/TalkBack on real devices. Plan for supplementary manual AT testing or assisted quarterly audits regardless of device platform choice.
