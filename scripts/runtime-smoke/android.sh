#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SHOWCASE="$ROOT/apps/showcase"
ARTIFACT_DIR="${BEEUI_RUNTIME_ARTIFACT_DIR:-$ROOT/.artifacts/runtime-smoke/android}"
MAESTRO_FLOW="$SHOWCASE/runtime-smoke/maestro"
APP_ID="com.beeui.showcase"
AVD_NAME="${BEEUI_ANDROID_AVD_NAME:-beeui-runtime-api36}"
SYSTEM_IMAGE="${BEEUI_ANDROID_SYSTEM_IMAGE:-system-images;android-36;google_apis;x86_64}"
ANDROID_ACCEL="${BEEUI_ANDROID_ACCEL:-auto}"

# Maestro's UIAutomator driver handshake (device-side server bring-up, not
# per-command element-wait timeouts — Maestro 2.7.0 has no global override
# for those) defaults to 15s. That's tight on a cold, resource-strapped
# runner, so give it more room here. This is a defense-in-depth addition on
# top of the per-command flow hardening below, not a substitute for it.
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-60000}"

mkdir -p "$ARTIFACT_DIR"

for cmd in node pnpm adb sdkmanager avdmanager maestro; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing required command: $cmd" >&2; exit 1; }
done

HEAD_SHA="$(git -C "$ROOT" rev-parse HEAD)"
EXPECTED_HEAD="${BEEUI_RUNTIME_HEAD_SHA:-}"
if [ -n "$EXPECTED_HEAD" ] && [ "$HEAD_SHA" != "$EXPECTED_HEAD" ]; then
  echo "Runtime checkout mismatch: expected head $EXPECTED_HEAD, got $HEAD_SHA" >&2
  exit 1
fi
EXPECTED_BASE="${BEEUI_RUNTIME_EXPECTED_BASE:-}"
if [ -n "$EXPECTED_BASE" ]; then
  merge_base="$(git -C "$ROOT" merge-base "$EXPECTED_BASE" HEAD)"
  if [ "$merge_base" != "$EXPECTED_BASE" ]; then
    echo "Runtime branch merge-base mismatch: expected $EXPECTED_BASE, got $merge_base" >&2
    exit 1
  fi
fi

# The Android emulator binds its modem chardev to [::1]; on runners with IPv6
# disabled at the kernel level qemu dies before boot ("Unable to connect
# character device modem: address resolution failed for ::1:<port>: Name or
# service not known"). /etc/hosts or `ip` can still claim ::1 exists, so test
# the actual socket capability through node (already a hard requirement).
if ! node -e '
const net = require("node:net");
const socket = net.createConnection({ host: "::1", port: 1 });
socket.on("connect", () => { socket.destroy(); process.exit(0); });
socket.on("error", (error) => {
  // ECONNREFUSED means the IPv6 loopback stack works and nothing listens.
  process.exit(error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT" ? 0 : 1);
});
'; then
  echo "IPv6 loopback sockets are unavailable on this runner." >&2
  echo "The Android emulator requires them: qemu binds its modem chardev to [::1] and exits before boot otherwise." >&2
  echo "Fix the host, e.g.: sysctl -w net.ipv6.conf.all.disable_ipv6=0 net.ipv6.conf.default.disable_ipv6=0 net.ipv6.conf.lo.disable_ipv6=0" >&2
  exit 1
fi

EMULATOR_PID=""
METRO_PID=""
SERIAL=""
ORIGINAL_WM_SIZE=""

adb_for_device() {
  adb -s "$SERIAL" "$@"
}

capture_failure() {
  if [ -n "$SERIAL" ]; then
    adb_for_device exec-out screencap -p > "$ARTIFACT_DIR/failure.png" 2>/dev/null || true
    adb_for_device logcat -d -v threadtime > "$ARTIFACT_DIR/logcat.txt" 2>&1 || true
    adb_for_device shell uiautomator dump /sdcard/beeui-window.xml >/dev/null 2>&1 || true
    adb_for_device pull /sdcard/beeui-window.xml "$ARTIFACT_DIR/window.xml" >/dev/null 2>&1 || true
  fi
}

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    capture_failure
  fi
  if [ -n "$SERIAL" ] && [ -n "$ORIGINAL_WM_SIZE" ]; then
    adb_for_device shell wm size reset >/dev/null 2>&1 || true
  fi
  if [ -n "$SERIAL" ]; then
    adb_for_device shell settings put system font_scale 1.0 >/dev/null 2>&1 || true
  fi
  if [ -n "$METRO_PID" ]; then
    kill "$METRO_PID" >/dev/null 2>&1 || true
    wait "$METRO_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "$SERIAL" ]; then
    adb_for_device shell am force-stop "$APP_ID" >/dev/null 2>&1 || true
    adb_for_device emu kill >/dev/null 2>&1 || true
  fi
  if [ -n "$EMULATOR_PID" ]; then
    wait "$EMULATOR_PID" >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

sdkmanager "platform-tools" "emulator" \
  "platforms;android-35" "platforms;android-36" \
  "build-tools;35.0.0" "build-tools;36.0.0" \
  "ndk;27.1.12297006" "cmake;3.22.1" \
  "$SYSTEM_IMAGE"

command -v emulator >/dev/null 2>&1 || { echo "Android emulator was not installed by sdkmanager" >&2; exit 1; }

if ! avdmanager list avd | grep -q "Name: $AVD_NAME"; then
  echo no | avdmanager create avd --force --name "$AVD_NAME" --package "$SYSTEM_IMAGE" --device "pixel_7"
fi

adb kill-server >/dev/null 2>&1 || true
adb start-server >/dev/null

if [ "$ANDROID_ACCEL" = "off" ]; then
  BOOT_ATTEMPTS=450
  echo "Starting Android emulator with software CPU emulation (-accel off)."
else
  BOOT_ATTEMPTS=120
  echo "Starting Android emulator with acceleration mode: $ANDROID_ACCEL"
fi

emulator "@$AVD_NAME" \
  -no-window \
  -no-audio \
  -no-boot-anim \
  -gpu swiftshader_indirect \
  -camera-back none \
  -camera-front none \
  -accel "$ANDROID_ACCEL" \
  -memory 4096 \
  -cores 4 \
  -wipe-data \
  > "$ARTIFACT_DIR/emulator.log" 2>&1 &
EMULATOR_PID=$!

for _ in $(seq 1 "$BOOT_ATTEMPTS"); do
  SERIAL="$(adb devices | awk 'NR>1 && $2=="device" && $1 ~ /^emulator-/ {print $1; exit}')"
  if [ -n "$SERIAL" ] && [ "$(adb_for_device shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then
    break
  fi
  if ! kill -0 "$EMULATOR_PID" >/dev/null 2>&1; then
    echo "Android emulator exited before boot completed" >&2
    tail -n 100 "$ARTIFACT_DIR/emulator.log" >&2 || true
    exit 1
  fi
  sleep 2
done

if [ -z "$SERIAL" ] || [ "$(adb_for_device shell getprop sys.boot_completed | tr -d '\r')" != "1" ]; then
  echo "Android emulator did not boot before timeout" >&2
  if [ "$ANDROID_ACCEL" = "off" ]; then
    echo "Acceleration is OFF: TCG software emulation of an API 36 image is impractically slow." >&2
    echo "Enable KVM so the workflow picks hardware acceleration: load kvm_intel/kvm_amd on the host" >&2
    echo "and, if this runner is containerized, map the device with --device /dev/kvm." >&2
  fi
  tail -n 100 "$ARTIFACT_DIR/emulator.log" >&2 || true
  exit 1
fi

adb_for_device shell input keyevent 82 >/dev/null 2>&1 || true
adb_for_device shell settings put global window_animation_scale 0
adb_for_device shell settings put global transition_animation_scale 0
adb_for_device shell settings put global animator_duration_scale 0
ORIGINAL_WM_SIZE="$(adb_for_device shell wm size | tr -d '\r')"

cat > "$ARTIFACT_DIR/metadata.txt" <<EOF_META
head=$HEAD_SHA
platform=Android
serial=$SERIAL
device=$(adb_for_device shell getprop ro.product.model | tr -d '\r')
os=$(adb_for_device shell getprop ro.build.version.release | tr -d '\r')
sdk=$(adb_for_device shell getprop ro.build.version.sdk | tr -d '\r')
orientation=portrait
app_id=$APP_ID
maestro=$(maestro --version)
wm_size=$ORIGINAL_WM_SIZE
acceleration=$ANDROID_ACCEL
system_image=$SYSTEM_IMAGE
EOF_META

(
  cd "$SHOWCASE"
  EXPO_NO_GIT_STATUS=1 pnpm exec expo prebuild --clean --no-install
)

set +e
(
  cd "$SHOWCASE/android"
  ./gradlew --no-daemon app:assembleDebug
) 2>&1 | tee "$ARTIFACT_DIR/gradle.log"
gradle_status=${PIPESTATUS[0]}
set -e
if [ "$gradle_status" -ne 0 ]; then
  exit "$gradle_status"
fi

apk="$(find "$SHOWCASE/android/app/build/outputs/apk/debug" -type f -name '*.apk' -print -quit)"
if [ -z "$apk" ]; then
  echo "No debug APK found" >&2
  exit 1
fi
adb_for_device install -r "$apk" | tee "$ARTIFACT_DIR/adb-install.txt"
adb_for_device reverse tcp:8081 tcp:8081

(
  cd "$SHOWCASE"
  NODE_OPTIONS=--dns-result-order=ipv4first CI=1 pnpm exec expo start --localhost --port 8081 > "$ARTIFACT_DIR/metro.log" 2>&1
) &
METRO_PID=$!

metro_ready() {
  local host base
  for host in 127.0.0.1 '[::1]'; do
    base="http://${host}:8081"
    if curl -fsS "$base/status" 2>/dev/null | grep -q 'packager-status:running'; then
      printf '%s' "$base"
      return 0
    fi
  done
  return 1
}

METRO_BASE_URL=""
for _ in $(seq 1 60); do
  if METRO_BASE_URL="$(metro_ready)"; then
    break
  fi
  if ! kill -0 "$METRO_PID" >/dev/null 2>&1; then
    echo "Metro exited before becoming ready" >&2
    exit 1
  fi
  sleep 1 # infrastructure-startup polling only
done

if [ -z "$METRO_BASE_URL" ]; then
  echo "Metro never reported packager-status:running on 127.0.0.1 or [::1]:8081" >&2
  ss -ltnp '( sport = :8081 )' > "$ARTIFACT_DIR/metro-port.txt" 2>&1 || true
  exit 1
fi
curl -fsS "$METRO_BASE_URL/status" | tee "$ARTIFACT_DIR/metro-status.txt"

# Warm the RN bundle so the first launch renders immediately; otherwise the
# app shows the "Bundling N%..." screen while Maestro's first assertion runs.
if ! curl -fsS "$METRO_BASE_URL/.expo/.virtual-metro-entry.bundle?platform=android&dev=true" -o /dev/null; then
  echo "::warning::Bundle warm-up request failed; the first Maestro assertion must absorb cold bundling." >&2
fi

run_maestro() {
  local name="$1" flow="$2"
  set +e
  (
    cd "$ROOT"
    maestro --device "$SERIAL" test "$flow"
  ) 2>&1 | tee "$ARTIFACT_DIR/${name}.log"
  local status=${PIPESTATUS[0]}
  set -e
  if [ "$status" -ne 0 ]; then
    exit "$status"
  fi
}

run_inline_maestro() {
  local name="$1"
  local flow="$ARTIFACT_DIR/${name}.yaml"
  {
    printf 'appId: %s\n---\n' "$APP_ID"
    cat
  } > "$flow"
  run_maestro "$name" "$flow"
}

real_back() {
  local label="$1"
  echo "adb shell input keyevent KEYCODE_BACK # $label" | tee -a "$ARTIFACT_DIR/adb-back.log"
  adb_for_device shell input keyevent KEYCODE_BACK
}

run_maestro common "$MAESTRO_FLOW/common.yaml"

run_inline_maestro reset <<'EOF_FLOW'
- launchApp:
    clearState: true
# Cold relaunch (clearState) leaves the app cold-bundling; retry the whole
# open-runtime navigation (scroll + tap) with a generous scroll timeout until
# the runtime screen is ready, so a slow first bundle on a fresh/cold runner
# does not flake the smoke.
- retry:
    maxRetries: 4
    commands:
      - scrollUntilVisible:
          element:
            id: "showcase-open-runtime"
          direction: DOWN
          timeout: 40000
      - tapOn:
          id: "showcase-open-runtime"
      - extendedWaitUntil:
          visible:
            id: "runtime-ready"
          timeout: 12000
EOF_FLOW

run_inline_maestro a1-open <<'EOF_FLOW'
- tapOn:
    id: "runtime-popover-trigger"
- assertVisible:
    id: "runtime-popover-content"
EOF_FLOW
real_back "A1 root Popover"
run_inline_maestro a1-assert <<'EOF_FLOW'
- waitForAnimationToEnd
- assertNotVisible:
    id: "runtime-popover-content"
- assertVisible:
    id: "runtime-popover-trigger"
EOF_FLOW

run_inline_maestro a2-open <<'EOF_FLOW'
- tapOn:
    id: "runtime-menu-trigger"
- assertVisible:
    id: "runtime-menu-content"
EOF_FLOW
real_back "A2 root DropdownMenu"
run_inline_maestro a2-assert <<'EOF_FLOW'
- waitForAnimationToEnd
- assertNotVisible:
    id: "runtime-menu-content"
- assertVisible:
    id: "runtime-menu-trigger"
EOF_FLOW

run_inline_maestro a3-open <<'EOF_FLOW'
- scrollUntilVisible:
    element:
      id: "runtime-dialog-menu-trigger"
    direction: DOWN
- waitForAnimationToEnd
- tapOn:
    id: "runtime-dialog-menu-trigger"
- assertVisible:
    id: "runtime-dialog-menu-content"
- waitForAnimationToEnd
- tapOn:
    id: "runtime-dialog-child-menu-trigger"
- assertVisible:
    id: "runtime-dialog-child-menu-content"
EOF_FLOW
real_back "A3 Back #1 child DropdownMenu"
run_inline_maestro a3-child-assert <<'EOF_FLOW'
- waitForAnimationToEnd
- assertNotVisible:
    id: "runtime-dialog-child-menu-content"
- assertVisible:
    id: "runtime-dialog-menu-content"
EOF_FLOW
real_back "A3 Back #2 Dialog"
run_inline_maestro a3-dialog-assert <<'EOF_FLOW'
- waitForAnimationToEnd
- assertNotVisible:
    id: "runtime-dialog-menu-content"
EOF_FLOW

run_inline_maestro reset-before-a4 <<'EOF_FLOW'
- launchApp:
    clearState: true
# Cold relaunch (clearState) leaves the app cold-bundling; retry the whole
# open-runtime navigation (scroll + tap) with a generous scroll timeout until
# the runtime screen is ready, so a slow first bundle on a fresh/cold runner
# does not flake the smoke.
- retry:
    maxRetries: 4
    commands:
      - scrollUntilVisible:
          element:
            id: "showcase-open-runtime"
          direction: DOWN
          timeout: 40000
      - tapOn:
          id: "showcase-open-runtime"
      - extendedWaitUntil:
          visible:
            id: "runtime-ready"
          timeout: 12000
EOF_FLOW
run_inline_maestro a4-open <<'EOF_FLOW'
- scrollUntilVisible:
    element:
      id: "runtime-dialog-popover-trigger"
    direction: DOWN
- waitForAnimationToEnd
- tapOn:
    id: "runtime-dialog-popover-trigger"
- assertVisible:
    id: "runtime-dialog-popover-content"
- waitForAnimationToEnd
- tapOn:
    id: "runtime-dialog-child-popover-trigger"
- assertVisible:
    id: "runtime-dialog-child-popover-content"
EOF_FLOW
real_back "A4 Back #1 child Popover"
run_inline_maestro a4-child-assert <<'EOF_FLOW'
- waitForAnimationToEnd
- assertNotVisible:
    id: "runtime-dialog-child-popover-content"
- assertVisible:
    id: "runtime-dialog-popover-content"
EOF_FLOW
real_back "A4 Back #2 Dialog"
run_inline_maestro a4-dialog-assert <<'EOF_FLOW'
- waitForAnimationToEnd
- assertNotVisible:
    id: "runtime-dialog-popover-content"
EOF_FLOW

run_inline_maestro reset-before-a5 <<'EOF_FLOW'
- launchApp:
    clearState: true
# Cold relaunch (clearState) leaves the app cold-bundling; retry the whole
# open-runtime navigation (scroll + tap) with a generous scroll timeout until
# the runtime screen is ready, so a slow first bundle on a fresh/cold runner
# does not flake the smoke.
- retry:
    maxRetries: 4
    commands:
      - scrollUntilVisible:
          element:
            id: "showcase-open-runtime"
          direction: DOWN
          timeout: 40000
      - tapOn:
          id: "showcase-open-runtime"
      - extendedWaitUntil:
          visible:
            id: "runtime-ready"
          timeout: 12000
EOF_FLOW
run_inline_maestro a5-open <<'EOF_FLOW'
- scrollUntilVisible:
    element:
      id: "runtime-alert-trigger"
    direction: DOWN
- waitForAnimationToEnd
- tapOn:
    id: "runtime-alert-trigger"
- assertVisible:
    id: "runtime-alert-content"
EOF_FLOW
real_back "A5 AlertDialog policy"
run_inline_maestro a5-assert <<'EOF_FLOW'
- waitForAnimationToEnd
- assertVisible:
    id: "runtime-alert-content"
- waitForAnimationToEnd
- retry:
    maxRetries: 4
    commands:
      - extendedWaitUntil:
          visible:
            id: "runtime-alert-cancel"
          timeout: 15000
      - tapOn:
          id: "runtime-alert-cancel"
      - assertNotVisible:
          id: "runtime-alert-content"
EOF_FLOW

adb_for_device exec-out screencap -p > "$ARTIFACT_DIR/full-height.png"
adb_for_device shell wm size 1080x1400
run_inline_maestro reduced-height <<'EOF_FLOW'
- launchApp:
    clearState: true
# Cold relaunch (clearState) leaves the app cold-bundling; retry the whole
# open-runtime navigation (scroll + tap) with a generous scroll timeout until
# the runtime screen is ready, so a slow first bundle on a fresh/cold runner
# does not flake the smoke.
- retry:
    maxRetries: 4
    commands:
      - scrollUntilVisible:
          element:
            id: "showcase-open-runtime"
          direction: DOWN
          timeout: 40000
      - tapOn:
          id: "showcase-open-runtime"
      - extendedWaitUntil:
          visible:
            id: "runtime-ready"
          timeout: 12000
- scrollUntilVisible:
    element:
      id: "runtime-input"
    direction: DOWN
- waitForAnimationToEnd
- tapOn:
    id: "runtime-input"
- inputText: "reduced-height"
- assertVisible:
    text: "reduced-height"
- hideKeyboard
- scrollUntilVisible:
    element:
      id: "runtime-scroll-end"
    direction: DOWN
- waitForAnimationToEnd
- assertVisible:
    id: "runtime-scroll-end"
EOF_FLOW
adb_for_device exec-out screencap -p > "$ARTIFACT_DIR/reduced-height.png"
adb_for_device shell wm size reset
ORIGINAL_WM_SIZE=""

# #143 — real native Dynamic Type evidence. Exercise Android's actual system
# font scale and measure the rendered native accessibility-node bounds for the
# two text-bearing controls whose growable-height contract is audited by the
# Dynamic Type foundation. This deliberately does not use PixelRatio mocks.
DYNAMIC_TYPE_METRICS="$ARTIFACT_DIR/dynamic-type-metrics.tsv"
printf 'scale\ttarget\twidth\theight\tbounds\n' > "$DYNAMIC_TYPE_METRICS"

dump_dynamic_type_metric() {
  local scale="$1" target="$2" slug="$3"
  local remote_xml="/sdcard/beeui-dynamic-type-${slug}-${target}.xml"
  local local_xml="$ARTIFACT_DIR/dynamic-type-${slug}-${target}.xml"

  adb_for_device shell uiautomator dump "$remote_xml" >/dev/null
  adb_for_device pull "$remote_xml" "$local_xml" >/dev/null
  node - "$local_xml" "$scale" "$target" "$DYNAMIC_TYPE_METRICS" <<'NODE'
const fs = require('node:fs');
const [xmlPath, scale, target, metricsPath] = process.argv.slice(2);
const xml = fs.readFileSync(xmlPath, 'utf8');
const nodeTags = xml.match(/<node\b[^>]*>/g) ?? [];
const targetNode = nodeTags.find((tag) => tag.includes(target));
if (!targetNode) {
  console.error(`Native Dynamic Type target not found in UIAutomator dump: ${target}`);
  process.exit(1);
}
const bounds = targetNode.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
if (!bounds) {
  console.error(`Native Dynamic Type target has no parseable bounds: ${targetNode}`);
  process.exit(1);
}
const [, left, top, right, bottom] = bounds.map(Number);
const width = right - left;
const height = bottom - top;
if (width <= 0 || height <= 0) {
  console.error(`Native Dynamic Type target collapsed: ${target} ${bounds[0]}`);
  process.exit(1);
}
fs.appendFileSync(metricsPath, `${scale}\t${target}\t${width}\t${height}\t${bounds[0]}\n`);
console.log(`BEEUI_NATIVE_DYNAMIC_TYPE scale=${scale} target=${target} width=${width} height=${height} ${bounds[0]}`);
NODE
}

run_dynamic_type_scale() {
  local scale="$1"
  local slug="${scale/./p}"

  adb_for_device shell settings put system font_scale "$scale"
  local observed_scale
  observed_scale="$(adb_for_device shell settings get system font_scale | tr -d '\r')"
  echo "Android font_scale requested=$scale observed=$observed_scale" | tee -a "$ARTIFACT_DIR/dynamic-type-font-scale.log"

  run_inline_maestro "dynamic-type-${slug}-select" <<'EOF_FLOW'
- launchApp:
    clearState: true
- extendedWaitUntil:
    timeout: 180000
    visible:
      id: "showcase-home"
- tapOn:
    id: "showcase-open-components"
- extendedWaitUntil:
    timeout: 15000
    visible:
      id: "component-gallery"
- scrollUntilVisible:
    element:
      id: "select-showcase-controlled-trigger"
    direction: DOWN
    timeout: 40000
- waitForAnimationToEnd
- assertVisible:
    id: "select-showcase-controlled-trigger"
EOF_FLOW
  dump_dynamic_type_metric "$scale" "select-showcase-controlled-trigger" "$slug"

  run_inline_maestro "dynamic-type-${slug}-pagination" <<'EOF_FLOW'
- scrollUntilVisible:
    element:
      id: "dynamic-type-pagination-item-1"
    direction: DOWN
    timeout: 40000
- waitForAnimationToEnd
- assertVisible:
    id: "dynamic-type-pagination-item-1"
EOF_FLOW
  dump_dynamic_type_metric "$scale" "dynamic-type-pagination-item-1" "$slug"
  adb_for_device exec-out screencap -p > "$ARTIFACT_DIR/dynamic-type-${slug}.png"
}

for scale in 1.0 1.3 1.5 2.0; do
  run_dynamic_type_scale "$scale"
done

node - "$DYNAMIC_TYPE_METRICS" <<'NODE'
const fs = require('node:fs');
const metricsPath = process.argv[2];
const lines = fs.readFileSync(metricsPath, 'utf8').trim().split(/\r?\n/).slice(1);
const rows = lines.map((line) => {
  const [scale, target, width, height, bounds] = line.split('\t');
  return { scale: Number(scale), target, width: Number(width), height: Number(height), bounds };
});
const expectedScales = [1, 1.3, 1.5, 2];
const targets = ['select-showcase-controlled-trigger', 'dynamic-type-pagination-item-1'];
for (const target of targets) {
  const targetRows = rows.filter((row) => row.target === target);
  if (targetRows.length !== expectedScales.length) {
    throw new Error(`${target}: expected ${expectedScales.length} native scale measurements, got ${targetRows.length}`);
  }
  for (const scale of expectedScales) {
    const row = targetRows.find((candidate) => candidate.scale === scale);
    if (!row || row.width <= 0 || row.height <= 0) {
      throw new Error(`${target}: missing/non-usable native bounds at ${scale}x`);
    }
  }
  const baseline = targetRows.find((row) => row.scale === 1);
  const doubled = targetRows.find((row) => row.scale === 2);
  if (!baseline || !doubled || doubled.height <= baseline.height) {
    throw new Error(
      `${target}: expected real 2x Android font scale to grow rendered height; baseline=${baseline?.height}, 2x=${doubled?.height}`,
    );
  }
  console.log(
    `BEEUI_NATIVE_DYNAMIC_TYPE_GROWTH target=${target} baselineHeight=${baseline.height} doubledHeight=${doubled.height}`,
  );
}
NODE

adb_for_device shell settings put system font_scale 1.0
printf '\ndynamic_type_platform=Android emulator\ndynamic_type_font_scales=1.0,1.3,1.5,2.0\ndynamic_type_metrics=dynamic-type-metrics.tsv\n' >> "$ARTIFACT_DIR/metadata.txt"

adb_for_device logcat -d -v threadtime > "$ARTIFACT_DIR/logcat.txt"
printf 'PASS\n' > "$ARTIFACT_DIR/result.txt"
echo "Android runtime smoke PASS at $HEAD_SHA"
