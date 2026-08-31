#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SHOWCASE="$ROOT/apps/showcase"
ARTIFACT_DIR="${BEEUI_RUNTIME_ARTIFACT_DIR:-$ROOT/.artifacts/runtime-smoke/ios}"
MAESTRO_FLOW="$SHOWCASE/runtime-smoke/maestro"
APP_ID="com.beeui.showcase"
SIMULATOR_NAME_PREFIX="BeeUI Runtime"
DERIVED_DATA_ROOT="${BEEUI_RUNTIME_DERIVED_DATA:-$HOME/Library/Caches/BeeUI/RuntimeDerivedData/showcase}"

mkdir -p "$ARTIFACT_DIR" "$DERIVED_DATA_ROOT"

for cmd in node pnpm xcodebuild xcrun pod maestro; do
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

SIM_UDID=""
SIM_CREATED="0"
METRO_PID=""
VIDEO_PID=""

capture_failure() {
  if [ -n "$SIM_UDID" ]; then
    xcrun simctl io "$SIM_UDID" screenshot "$ARTIFACT_DIR/failure.png" >/dev/null 2>&1 || true
    xcrun simctl spawn "$SIM_UDID" log show --last 10m --style compact > "$ARTIFACT_DIR/simulator.log" 2>&1 || true
  fi
}

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    capture_failure
  fi
  if [ -n "$VIDEO_PID" ]; then
    kill -INT "$VIDEO_PID" >/dev/null 2>&1 || true
    wait "$VIDEO_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "$METRO_PID" ]; then
    kill "$METRO_PID" >/dev/null 2>&1 || true
    wait "$METRO_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "$SIM_UDID" ]; then
    xcrun simctl terminate "$SIM_UDID" "$APP_ID" >/dev/null 2>&1 || true
    xcrun simctl shutdown "$SIM_UDID" >/dev/null 2>&1 || true
    if [ "$SIM_CREATED" = "1" ]; then
      xcrun simctl delete "$SIM_UDID" >/dev/null 2>&1 || true
    fi
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

select_simulator() {
  local selection
  selection="$(node - <<'NODE'
const { execFileSync } = require('node:child_process');
const runtimes = JSON.parse(execFileSync('xcrun', ['simctl','list','runtimes','-j'], {encoding:'utf8'})).runtimes
  .filter((r) => r.isAvailable !== false && (r.platform === 'iOS' || String(r.identifier).includes('.iOS-') || /^iOS\b/.test(String(r.name))))
  .sort((a,b) => String(b.version).localeCompare(String(a.version), undefined, {numeric:true}));
if (!runtimes.length) process.exit(2);
const types = JSON.parse(execFileSync('xcrun', ['simctl','list','devicetypes','-j'], {encoding:'utf8'})).devicetypes;
const preferred = ['iPhone 17 Pro','iPhone 16 Pro','iPhone 15 Pro'];
let type = preferred.map((name) => types.find((t) => t.name === name)).find(Boolean);
if (!type) type = types.find((t) => /^iPhone .*Pro$/.test(t.name)) || types.find((t) => /^iPhone /.test(t.name));
if (!type) process.exit(3);
process.stdout.write(`${type.identifier}|${type.name}|${runtimes[0].identifier}|${runtimes[0].name}|${runtimes[0].version}`);
NODE
)"
  IFS='|' read -r device_type_id device_name runtime_id runtime_name runtime_version <<< "$selection"
  local run_suffix="${GITHUB_RUN_ID:-$$}-${GITHUB_RUN_ATTEMPT:-1}"
  local sim_name="${SIMULATOR_NAME_PREFIX} ${run_suffix}"
  local sim_udid
  sim_udid="$(xcrun simctl create "$sim_name" "$device_type_id" "$runtime_id")"
  test -n "$sim_udid"
  printf '%s|%s|%s|%s\n' "$sim_udid" "$device_name" "$runtime_name" "$runtime_version"
}

IFS='|' read -r SIM_UDID DEVICE_NAME RUNTIME_NAME IOS_VERSION <<< "$(select_simulator)"
test -n "$SIM_UDID"
SIM_CREATED="1"

echo "Booting $DEVICE_NAME on $RUNTIME_NAME ($IOS_VERSION): $SIM_UDID"
xcrun simctl boot "$SIM_UDID"
xcrun simctl bootstatus "$SIM_UDID" -b

cat > "$ARTIFACT_DIR/metadata.txt" <<EOF_META
head=$HEAD_SHA
platform=iOS
simulator_udid=$SIM_UDID
device=$DEVICE_NAME
os=$RUNTIME_NAME
os_version=$IOS_VERSION
orientation=portrait
app_id=$APP_ID
maestro=$(maestro --version)
xcode=$(xcodebuild -version | tr '\n' ' ')
EOF_META

(
  cd "$SHOWCASE"
  EXPO_NO_GIT_STATUS=1 pnpm exec expo prebuild --clean --no-install
)

(
  cd "$SHOWCASE/ios"
  pod install
  printf 'export NODE_BINARY="%s"\n' "$(command -v node)" > .xcode.env.local
)

workspace="$(find "$SHOWCASE/ios" -maxdepth 1 -type d -name '*.xcworkspace' -print -quit)"
if [ -z "$workspace" ]; then
  echo "No generated .xcworkspace found" >&2
  exit 1
fi
scheme="$({ xcodebuild -workspace "$workspace" -list -json; } | node -e '
let input=""; process.stdin.on("data", c => input += c); process.stdin.on("end", () => {
  const data=JSON.parse(input); const schemes=data.workspace?.schemes ?? [];
  if (!schemes.length) process.exit(2); process.stdout.write(schemes[0]);
});')"

pod_hash="$(shasum -a 256 "$SHOWCASE/ios/Podfile.lock" | awk '{print $1}')"
derived_data="$DERIVED_DATA_ROOT/${pod_hash}"
mkdir -p "$derived_data"

set +e
xcodebuild \
  -workspace "$workspace" \
  -scheme "$scheme" \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$SIM_UDID" \
  -derivedDataPath "$derived_data" \
  CODE_SIGNING_ALLOWED=NO \
  ONLY_ACTIVE_ARCH=YES \
  build 2>&1 | tee "$ARTIFACT_DIR/xcodebuild.log"
build_status=${PIPESTATUS[0]}
set -e
if [ "$build_status" -ne 0 ]; then
  exit "$build_status"
fi

app_path="$(find "$derived_data/Build/Products/Debug-iphonesimulator" -maxdepth 1 -type d -name '*.app' -print -quit)"
if [ -z "$app_path" ]; then
  echo "No built .app found" >&2
  exit 1
fi

xcrun simctl install "$SIM_UDID" "$app_path"

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
  sleep 1
done

if [ -z "$METRO_BASE_URL" ]; then
  echo "Metro never reported packager-status:running on 127.0.0.1 or [::1]:8081" >&2
  lsof -nP -iTCP:8081 -sTCP:LISTEN > "$ARTIFACT_DIR/metro-port.txt" 2>&1 || true
  exit 1
fi
curl -fsS "$METRO_BASE_URL/status" | tee "$ARTIFACT_DIR/metro-status.txt"

# Warm the RN bundle so the first launch renders immediately; otherwise the
# app shows the "Bundling N%..." screen while Maestro's first assertion runs.
if ! curl -fsS "$METRO_BASE_URL/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true" -o /dev/null; then
  echo "::warning::Bundle warm-up request failed; the first Maestro assertion must absorb cold bundling." >&2
fi

xcrun simctl io "$SIM_UDID" recordVideo "$ARTIFACT_DIR/sheet-cases.mp4" > "$ARTIFACT_DIR/record-video.log" 2>&1 &
VIDEO_PID=$!

set +e
(
  cd "$ROOT"
  maestro --device "$SIM_UDID" test "$MAESTRO_FLOW/common.yaml"
) 2>&1 | tee "$ARTIFACT_DIR/maestro-common.log"
common_status=${PIPESTATUS[0]}
set -e
if [ "$common_status" -ne 0 ]; then
  exit "$common_status"
fi

set +e
(
  cd "$ROOT"
  maestro --device "$SIM_UDID" test "$MAESTRO_FLOW/runtime-stress.yaml"
) 2>&1 | tee "$ARTIFACT_DIR/maestro-runtime-stress.log"
stress_status=${PIPESTATUS[0]}
set -e
if [ "$stress_status" -ne 0 ]; then
  exit "$stress_status"
fi

set +e
(
  cd "$ROOT"
  maestro --device "$SIM_UDID" test "$MAESTRO_FLOW/ios-sheets.yaml"
) 2>&1 | tee "$ARTIFACT_DIR/maestro-ios-sheets.log"
sheet_status=${PIPESTATUS[0]}
set -e
if [ "$sheet_status" -ne 0 ]; then
  exit "$sheet_status"
fi

kill -INT "$VIDEO_PID" >/dev/null 2>&1 || true
wait "$VIDEO_PID" >/dev/null 2>&1 || true
VIDEO_PID=""

xcrun simctl io "$SIM_UDID" screenshot "$ARTIFACT_DIR/final.png" >/dev/null
printf 'PASS\n' > "$ARTIFACT_DIR/result.txt"
echo "iOS runtime smoke PASS at $HEAD_SHA"
