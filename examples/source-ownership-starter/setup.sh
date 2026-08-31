#!/usr/bin/env bash
# R10.2 (#231) — installs runtime/tooling dependencies (from freshly packed
# @beeui/tokens, since it is unpublished — no @beeui/ui/@beeui/core package
# consumption in this starter at all) and then runs the packed,
# unpublished @beeui/cli end-to-end: `beeui init` + `beeui add button popover`
# copy component source directly into src/components/beeui and src/lib/beeui,
# and copy the canonical theme into src/beeui/theme.css.
#
# Re-running this script is safe: `beeui add` is idempotent (identical
# content reports UNCHANGED; see docs/registry-cli.md's collision policy).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RUNTIME_DEPS=(
  react@19.2.3
  react-dom@19.2.3
  react-native@0.86.2
  react-native-web@0.21.0
  react-native-safe-area-context@5.7.0
  react-native-teleport@1.1.13
  class-variance-authority@0.7.1
  clsx@2.1.1
  tailwind-merge@3.6.0
  tailwindcss@4.3.3
  uniwind@1.10.1
)

DEV_DEPS=(
  vite@8.2.2
  vite-plugin-rnw@0.0.12
  @tailwindcss/vite@4.3.3
  typescript@5.9.3
)

echo "==> Building the packed @beeui/cli artifact (packages/cli/dist/beeui.mjs)"
pnpm --filter @beeui/cli run build

CLI_BIN="${REPO_ROOT}/packages/cli/dist/beeui.mjs"
test -f "${CLI_BIN}" || { echo "Expected packed CLI binary missing: ${CLI_BIN}" >&2; exit 1; }

echo "==> Packing @beeui/tokens through the package boundary (#355 runtime dependency)"
eval "$(node ../scripts/pack-beeui-packages.mjs --out .beeui-tarballs --packages tokens)"

echo "==> Installing @beeui/tokens tarball and copied-source runtime/tooling dependencies"
npm install --save-exact "${TOKENS_TARBALL}" "${RUNTIME_DEPS[@]}"
npm install --save-exact -D "${DEV_DEPS[@]}"

echo "==> Running the packed CLI: beeui init"
node "${CLI_BIN}" init

echo "==> Running the packed CLI: beeui add button popover"
node "${CLI_BIN}" add button popover

echo "==> Running the packed CLI: beeui doctor"
node "${CLI_BIN}" doctor

if node -e "require.resolve('@beeui/ui')" >/dev/null 2>&1; then
  echo "This starter unexpectedly resolves @beeui/ui; source ownership must not depend on it." >&2
  exit 1
fi

echo "==> Setup complete. Run: npm run build"
