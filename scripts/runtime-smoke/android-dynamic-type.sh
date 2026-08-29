#!/usr/bin/env bash
# #143 — real native Dynamic Type evidence (Android).
#
# Sourceable segment: defines and exposes `run_dynamic_type_evidence`. The
# caller (scripts/runtime-smoke/android.sh in CI, or a local harness against
# an already-booted emulator) must provide:
#   adb_for_device()      adb wrapper bound to the target device serial
#   run_inline_maestro()  inline Maestro flow runner (writes logs under ARTIFACT_DIR)
#   ARTIFACT_DIR          evidence output directory
#   node                  on PATH
#
# Evidence model: this exercises Android's actual system font scale
# (`settings put system font_scale`) and measures the rendered native
# accessibility-node bounds via UIAutomator — no PixelRatio mocks. It measures
# the dedicated Dynamic Type runtime fixture screen
# (apps/showcase/runtime-smoke/dynamic-type-acceptance.tsx), reached with a
# single tap from Showcase home. The audited targets render at the top of that
# screen, so no scale ever requires scrolling to them — the failure mode that
# sank the previous Component Gallery traversal (a deep scroll target that
# real font scaling pushes beyond any fixed scroll budget) cannot recur here.
#
# The fixture's own `dynamic-type-font-scale` label renders
# `PixelRatio.getFontScale().toFixed(2)`, and every per-scale flow asserts its
# exact text before measuring: in-app proof that the OS-level setting reached
# the freshly launched process, not just that adb accepted the write.

DYNAMIC_TYPE_SCALES=(1.0 1.3 1.5 2.0)
DYNAMIC_TYPE_TARGETS=(dynamic-type-select-trigger dynamic-type-pagination-item-1)

dynamic_type_dump_metrics() {
  local scale="$1" slug="$2"
  local remote_xml="/sdcard/beeui-dynamic-type-${slug}.xml"
  local local_xml="$ARTIFACT_DIR/dynamic-type-${slug}.xml"

  adb_for_device shell uiautomator dump "$remote_xml" >/dev/null
  adb_for_device pull "$remote_xml" "$local_xml" >/dev/null
  node - "$local_xml" "$scale" "$DYNAMIC_TYPE_METRICS" "${DYNAMIC_TYPE_TARGETS[@]}" <<'NODE'
const fs = require('node:fs');
const [xmlPath, scale, metricsPath, ...targets] = process.argv.slice(2);
const xml = fs.readFileSync(xmlPath, 'utf8');
const nodeTags = xml.match(/<node\b[^>]*>/g) ?? [];
for (const target of targets) {
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
}
NODE
}

dynamic_type_run_scale() {
  local scale="$1"
  local slug="${scale/./p}"
  local expected_label
  # LC_ALL=C pins the decimal separator: the fixture renders toFixed(2) ("1.30"),
  # which a comma-decimal runner locale would otherwise fail to match.
  expected_label="$(LC_ALL=C printf 'font scale: %.2f' "$scale")"

  adb_for_device shell settings put system font_scale "$scale"
  local observed_scale
  observed_scale="$(adb_for_device shell settings get system font_scale | tr -d '\r')"
  echo "Android font_scale requested=$scale observed=$observed_scale" | tee -a "$ARTIFACT_DIR/dynamic-type-font-scale.log"

  # One deterministic flow per scale: cold relaunch under the new scale, one
  # tap from home into the fixture, then direct visibility assertions — the
  # only scroll is over the short home screen to reach the launcher card.
  run_inline_maestro "dynamic-type-${slug}" <<EOF_FLOW
- launchApp:
    clearState: true
- extendedWaitUntil:
    timeout: 180000
    visible:
      id: "showcase-home"
# Cold relaunch (clearState) leaves the app cold-bundling; retry the whole
# open-fixture navigation until the fixture is ready, mirroring the runtime
# smoke's home-navigation hardening.
- retry:
    maxRetries: 4
    commands:
      - scrollUntilVisible:
          element:
            id: "showcase-open-dynamic-type"
          direction: DOWN
          timeout: 60000
      - tapOn:
          id: "showcase-open-dynamic-type"
      - extendedWaitUntil:
          visible:
            id: "dynamic-type-ready"
          timeout: 15000
- waitForAnimationToEnd
# In-app proof the OS font scale reached this process before anything is
# measured. PixelRatio.getFontScale() is rendered by the fixture itself.
- assertVisible:
    text: "${expected_label}"
- assertVisible:
    id: "dynamic-type-select-trigger"
- assertVisible:
    id: "dynamic-type-pagination-item-1"
EOF_FLOW

  dynamic_type_dump_metrics "$scale" "$slug"
  adb_for_device exec-out screencap -p > "$ARTIFACT_DIR/dynamic-type-${slug}.png"
}

run_dynamic_type_evidence() {
  DYNAMIC_TYPE_METRICS="$ARTIFACT_DIR/dynamic-type-metrics.tsv"
  printf 'scale\ttarget\twidth\theight\tbounds\n' > "$DYNAMIC_TYPE_METRICS"

  local scale
  for scale in "${DYNAMIC_TYPE_SCALES[@]}"; do
    dynamic_type_run_scale "$scale"
  done

  node - "$DYNAMIC_TYPE_METRICS" "${DYNAMIC_TYPE_TARGETS[@]}" <<'NODE'
const fs = require('node:fs');
const [metricsPath, ...targets] = process.argv.slice(2);
const lines = fs.readFileSync(metricsPath, 'utf8').trim().split(/\r?\n/).slice(1);
const rows = lines.map((line) => {
  const [scale, target, width, height, bounds] = line.split('\t');
  return { scale: Number(scale), target, width: Number(width), height: Number(height), bounds };
});
const expectedScales = [1, 1.3, 1.5, 2];
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
}
