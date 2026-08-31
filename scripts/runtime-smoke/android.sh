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

for cmd in node pnpm adb maestro; do
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
  fi
  # Emulator shutdown is owned by reactivecircus/android-emulator-runner.
  exit "$status"
}
trap cleanup EXIT INT TERM

# Emulator create/boot/teardown and adb-server ownership belong to the
# reactivecircus action. Restarting adb here races the action-owned transport
# and previously produced deterministic `device offline` failures.
SERIAL="$(adb devices | awk 'NR>1 && $1 ~ /^emulator-/ {print $1; exit}')"
if [ -z "$SERIAL" ]; then
  echo "No Android emulator device found; expected the CI action to boot one before this script runs." >&2
  adb devices >&2 || true
  exit 1
fi
adb -s "$SERIAL" wait-for-device
BOOT_WAIT_ATTEMPTS=60
for _ in $(seq 1 "$BOOT_WAIT_ATTEMPTS"); do
  if [ "$(adb_for_device shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then
    break
  fi
  sleep 2
done
if [ "$(adb_for_device shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; then
  echo "Android emulator device $SERIAL did not report boot_completed within the timeout." >&2
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
avd_name=$AVD_NAME
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

# #126 — dismiss -> independent scroll -> coherent reopen plus modal-local
# Select/keyboard coherence. No invalid same-gesture responder handoff test.
run_maestro runtime-stress "$MAESTRO_FLOW/runtime-stress.yaml"

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

# A7 — real keyboard + hardware Back ordering on the dedicated stress screen.
run_inline_maestro reset-before-a7 <<'EOF_FLOW'
- launchApp:
    clearState: true
- retry:
    maxRetries: 4
    commands:
      - scrollUntilVisible:
          element:
            id: "showcase-open-runtime-stress"
          direction: DOWN
          timeout: 40000
      - tapOn:
          id: "showcase-open-runtime-stress"
      - extendedWaitUntil:
          visible:
            id: "runtime-stress-ready"
          timeout: 12000
EOF_FLOW
run_inline_maestro a7-open <<'EOF_FLOW'
- scrollUntilVisible:
    element:
      id: "runtime-stress-dialog-trigger"
    direction: DOWN
- waitForAnimationToEnd
- tapOn:
    id: "runtime-stress-dialog-trigger"
- assertVisible:
    id: "runtime-stress-dialog-content"
- tapOn:
    id: "runtime-stress-dialog-popover-trigger"
- assertVisible:
    id: "runtime-stress-dialog-popover-content"
- tapOn:
    id: "runtime-stress-dialog-popover-keyboard-toggle"
- extendedWaitUntil:
    visible:
      text: "keyboard: shown"
    timeout: 10000
- waitForAnimationToEnd
- assertVisible:
    id: "runtime-stress-dialog-popover-content"
EOF_FLOW
real_back "A7 Back #1 (keyboard dismiss, IME-owned)"
run_inline_maestro a7-keyboard-assert <<'EOF_FLOW'
- waitForAnimationToEnd
- extendedWaitUntil:
    visible:
      text: "keyboard: hidden"
    timeout: 10000
- assertVisible:
    id: "runtime-stress-dialog-popover-content"
EOF_FLOW
real_back "A7 Back #2 (child Popover close)"
run_inline_maestro a7-popover-assert <<'EOF_FLOW'
- waitForAnimationToEnd
- assertNotVisible:
    id: "runtime-stress-dialog-popover-content"
- assertVisible:
    id: "runtime-stress-dialog-content"
EOF_FLOW
real_back "A7 Back #3 (Dialog close)"
run_inline_maestro a7-dialog-assert <<'EOF_FLOW'
- waitForAnimationToEnd
- assertNotVisible:
    id: "runtime-stress-dialog-content"
EOF_FLOW

run_inline_maestro reset-after-a7 <<'EOF_FLOW'
- launchApp:
    clearState: true
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

# #143 — real native Dynamic Type evidence on the dedicated fixture screen.
. "$ROOT/scripts/runtime-smoke/android-dynamic-type.sh"
run_dynamic_type_evidence

adb_for_device logcat -d -v threadtime > "$ARTIFACT_DIR/logcat.txt"
printf 'PASS\n' > "$ARTIFACT_DIR/result.txt"
echo "Android runtime smoke PASS at $HEAD_SHA"
