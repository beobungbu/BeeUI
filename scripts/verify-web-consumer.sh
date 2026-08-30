#!/usr/bin/env bash
set -euo pipefail

# Issue #136 — the independent, non-Showcase clean Web consumer. Mirrors
# scripts/verify-bare-consumer.sh's structure and rigor (pack real tarballs,
# install into an isolated app with no monorepo fallback, prove build +
# real-browser interaction) but for the Web/react-native-web path instead of
# a bare React Native native app: Vite + react-native-web, chosen because
# uniwind's `uniwind/vite` plugin (available since 1.2.0, well under the
# 1.10.1 this repo pins) supports it directly — see docs/compatibility-matrix.md's
# Web support contract section for why Vite is the one bundler claimed here
# and why Next.js/Webpack/other bundlers are explicitly not.

ACTION="${1:-all}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# WORK_ROOT must survive across CI jobs for the same reason
# verify-bare-consumer.sh's does: GitHub Actions empties RUNNER_TEMP at the
# start of every job.
WORK_ROOT="${BEEUI_WEB_CONSUMER_WORK_ROOT:-${HOME:-/tmp}/Library/Caches/BeeUI}/web-consumer"
APP_DIR="${WORK_ROOT}/app"
PACKAGE_DIR="${WORK_ROOT}/packages"
FINGERPRINT_FILE="${WORK_ROOT}/.beeui-web-consumer-fingerprint"
PREVIEW_PORT="${BEEUI_WEB_CONSUMER_PORT:-4500}"

# Exact versions this repo has actually tested elsewhere (docs/compatibility-matrix.md),
# reused here so the Web support contract's claims stay pinned to the same
# evidence rather than drifting to whatever `npm install` resolves.
RUNTIME_DEPS=(
  react@19.2.3
  react-dom@19.2.3
  react-native@0.86.2
  react-native-web@0.21.0
  class-variance-authority@0.7.1
  react-native-safe-area-context@5.7.0
  react-native-teleport@1.1.13
  @react-native-community/datetimepicker@9.1.0
  @gorhom/bottom-sheet@5.2.14
  react-native-reanimated@4.5.1
  react-native-gesture-handler@2.32.0
  react-native-worklets@0.10.1
  tailwindcss@4.3.3
  uniwind@1.10.1
)

# Build/test tooling. vite/vite-plugin-rnw are new to this consumer (not
# claimed anywhere else in the repo) — see the Web support contract's
# "Tooling versions" note for why these exact pins are the tested ones, not
# an aspirational range. @playwright/test and @axe-core/playwright are
# pinned identically to apps/visual-regression so the same real-Chromium
# evidence class applies here.
DEV_DEPS=(
  vite@8.2.2
  vite-plugin-rnw@0.0.12
  @tailwindcss/vite@4.3.3
  typescript@5.9.3
  @playwright/test@1.62.1
  @axe-core/playwright@4.13.0
)

is_truthy() {
  case "${1:-}" in
    1|[Tt][Rr][Uu][Ee]|[Yy][Ee][Ss]) return 0 ;;
    *) return 1 ;;
  esac
}

compute_fingerprint() {
  {
    printf '%s\n' "${RUNTIME_DEPS[@]}"
    printf '%s\n' "${DEV_DEPS[@]}"
  } | shasum -a 256 | awk '{ print $1 }'
}

pack_beeui() {
  echo "::group::Pack BeeUI packages through the package boundary"
  rm -rf "${PACKAGE_DIR}"
  mkdir -p "${PACKAGE_DIR}"

  cd "${ROOT_DIR}"
  pnpm --filter @beeui/core pack --pack-destination "${PACKAGE_DIR}"
  pnpm --filter @beeui/tokens pack --pack-destination "${PACKAGE_DIR}"
  pnpm --filter @beeui/ui pack --pack-destination "${PACKAGE_DIR}"

  CORE_TARBALL="$(find "${PACKAGE_DIR}" -maxdepth 1 -type f -name 'beeui-core-*.tgz' -print -quit)"
  TOKENS_TARBALL="$(find "${PACKAGE_DIR}" -maxdepth 1 -type f -name 'beeui-tokens-*.tgz' -print -quit)"
  UI_TARBALL="$(find "${PACKAGE_DIR}" -maxdepth 1 -type f -name 'beeui-ui-*.tgz' -print -quit)"

  test -n "${CORE_TARBALL}" && test -f "${CORE_TARBALL}"
  test -n "${TOKENS_TARBALL}" && test -f "${TOKENS_TARBALL}"
  test -n "${UI_TARBALL}" && test -f "${UI_TARBALL}"
  echo "::endgroup::"
}

write_app_sources() {
  mkdir -p "${APP_DIR}/src"
  cd "${APP_DIR}"

  cat > vite.config.ts <<'EOF'
import tailwindcss from '@tailwindcss/vite';
import { uniwind } from 'uniwind/vite';
import { defineConfig } from 'vite';
import { rnw } from 'vite-plugin-rnw';

export default defineConfig({
  plugins: [
    rnw(),
    tailwindcss(),
    uniwind({
      cssEntryFile: './src/global.css',
      dtsFile: './src/uniwind-types.d.ts',
    }),
  ],
  preview: {
    port: Number(process.env.BEEUI_WEB_CONSUMER_PORT ?? 4500),
    strictPort: true,
  },
});
EOF

  cat > index.html <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BeeUI Vite + react-native-web consumer smoke</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

  cat > src/global.css <<'EOF'
@import 'tailwindcss';
@import 'uniwind';
@import '@beeui/tokens/theme.css';

@source '../node_modules/@beeui/core/src';
@source '../node_modules/@beeui/ui/src';
EOF

  cat > src/main.tsx <<'EOF'
import './global.css';

import * as React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root was not found.');
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
EOF

  # Exercises the surfaces #136's DoD enumerates: provider, forms, overlays,
  # Select/Tooltip, Sheet, Table, Calendar/date controls. TooltipTrigger and
  # SheetTrigger/DialogTrigger are themselves the interactive element (see
  # apps/showcase/component-gallery/component-gallery.tsx) — wrapping another
  # interactive control inside them produces nested-interactive elements that
  # axe correctly flags, so this fixture must not do that.
  cat > src/App.tsx <<'EOF'
import {
  BeeUIProvider,
  Button,
  Calendar,
  Card,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  Input,
  Screen,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
  SheetTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type CalendarDate,
} from '@beeui/ui';
import * as React from 'react';

export function App() {
  const [checked, setChecked] = React.useState(false);
  const [plan, setPlan] = React.useState<string | undefined>('pro');
  const [selectedDate, setSelectedDate] = React.useState<CalendarDate | null>(null);

  return (
    <BeeUIProvider>
      <Screen>
        <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
          <Card className="gap-4">
            <Text variant="title">BeeUI Vite + react-native-web consumer smoke</Text>

            <Input accessibilityLabel="Project name" placeholder="Project name" />
            <Checkbox checked={checked} label="Enable notifications" onCheckedChange={setChecked} />

            <Select onValueChange={setPlan} value={plan}>
              <SelectTrigger accessibilityLabel="Plan">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>

            <Tooltip>
              <TooltipTrigger variant="outline">Hover for tooltip</TooltipTrigger>
              <TooltipContent>Representative Tooltip content.</TooltipContent>
            </Tooltip>

            <Dialog>
              <DialogTrigger>Open dialog</DialogTrigger>
              <DialogContent>
                <DialogTitle>Vite RN Web dialog</DialogTitle>
                <DialogDescription>Overlay rendered through react-native-web's Modal path.</DialogDescription>
                <DialogFooter>
                  <DialogClose variant="outline">Close</DialogClose>
                  <Button>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger>Open sheet</SheetTrigger>
              <SheetContent>
                <SheetTitle>Representative Sheet</SheetTitle>
                <SheetDescription>Confirms Sheet mounts and closes on this consumer.</SheetDescription>
                <SheetFooter>
                  <SheetClose variant="outline">Dismiss</SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            <Calendar accessibilityLabel="Pick a date" onValueChange={setSelectedDate} value={selectedDate} />

            <Table accessibilityLabel="Representative data table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Plan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Ada Lovelace</TableCell>
                  <TableCell>{plan ?? 'none'}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </div>
      </Screen>
    </BeeUIProvider>
  );
}
EOF

  # Real-Chromium interaction + automated accessibility evidence, run against
  # `vite preview`'s production build (not the dev server) by the `verify`
  # action below. Installed as this app's own devDependency (no monorepo
  # fallback) so this is genuine clean-consumer evidence per
  # docs/beeui-1.0-evidence-classes.md.
  cat > verify-consumer.mjs <<'EOF'
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';

const base = `http://localhost:${process.env.BEEUI_WEB_CONSUMER_PORT ?? 4500}`;
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForSelector('text=BeeUI Vite + react-native-web consumer smoke');

// Form control.
await page.getByPlaceholder('Project name').fill('Hive Enterprise');

// Checkbox, keyboard-focusable and clickable.
await page.getByText('Enable notifications').click();

// Select — open, choose an item, prove the value propagated into the Table.
await page.getByLabel('Plan').click();
await page.getByRole('option', { name: 'Enterprise' }).click();
const planCellText = await page.getByRole('cell', { name: 'enterprise' }).innerText();
if (planCellText.trim() !== 'enterprise') {
  throw new Error(`Select did not propagate its value into the Table, got: ${planCellText}`);
}

// Tooltip — keyboard focus (not just hover) must reveal it.
await page.getByRole('button', { name: 'Hover for tooltip' }).first().focus();
await page.waitForSelector('text=Representative Tooltip content.', { timeout: 5000 });

// Dialog — open, Escape closes (keyboard dismissal).
await page.getByRole('button', { name: 'Open dialog' }).first().click();
await page.waitForSelector('text=Vite RN Web dialog');
await page.keyboard.press('Escape');
await page.waitForSelector('text=Vite RN Web dialog', { state: 'hidden' });

// Sheet — open, dismiss.
await page.getByRole('button', { name: 'Open sheet' }).first().click();
await page.waitForSelector('text=Representative Sheet');
await page.getByRole('button', { name: 'Dismiss' }).first().click();
await page.waitForSelector('text=Representative Sheet', { state: 'hidden' });

// Calendar — select a day by its full accessible date name.
const dayCell = page.getByRole('cell', { name: /15, \d{4}/ });
await dayCell.waitFor({ state: 'visible', timeout: 5000 });
await dayCell.click();

// Table renders with real table semantics.
await page.waitForSelector('role=table');

const axeResults = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  .analyze();
const seriousOrCritical = axeResults.violations.filter(
  (violation) => violation.impact === 'serious' || violation.impact === 'critical',
);
if (seriousOrCritical.length > 0) {
  console.error('axe-core found serious/critical violations:', JSON.stringify(seriousOrCritical, null, 2));
  process.exitCode = 1;
}

await browser.close();

if (errors.length > 0) {
  console.error('Console/page errors detected during interaction:', errors);
  process.exit(1);
}

if (process.exitCode !== 1) {
  console.log('OK: independent Vite + react-native-web consumer — forms, overlays, Select, Tooltip, Sheet, Table, Calendar all interact correctly with no console errors and no serious/critical axe violations.');
}
EOF
}

prepare_consumer() {
  local fingerprint existing_fingerprint need_clean=0
  fingerprint="$(compute_fingerprint)"

  if is_truthy "${BEEUI_WEB_CONSUMER_CLEAN:-}"; then
    need_clean=1
  elif [ ! -d "${APP_DIR}" ]; then
    need_clean=1
  else
    existing_fingerprint="$(cat "${FINGERPRINT_FILE}" 2>/dev/null || true)"
    if [ "${existing_fingerprint}" != "${fingerprint}" ]; then
      need_clean=1
    fi
  fi

  pack_beeui

  if [ "${need_clean}" -eq 1 ]; then
    echo "::group::Create fresh independent Vite + react-native-web consumer"
    rm -rf "${APP_DIR}"
    mkdir -p "${APP_DIR}"

    cat > "${APP_DIR}/package.json" <<'EOF'
{
  "name": "beeui-web-consumer-smoke",
  "private": true,
  "version": "0.0.0",
  "type": "module"
}
EOF

    write_app_sources

    cd "${APP_DIR}"
    echo "::group::Install BeeUI tarballs and Web runtime/tooling dependencies"
    npm install --save-exact \
      "${CORE_TARBALL}" \
      "${TOKENS_TARBALL}" \
      "${UI_TARBALL}" \
      "${RUNTIME_DEPS[@]}"
    npm install --save-exact -D "${DEV_DEPS[@]}"
    echo "::endgroup::"

    printf '%s' "${fingerprint}" > "${FINGERPRINT_FILE}"
    echo "::endgroup::"
  else
    echo "Reusing existing Web consumer at ${APP_DIR} (environment fingerprint unchanged)"
    write_app_sources
    cd "${APP_DIR}"

    echo "::group::Reinstall BeeUI tarballs into existing consumer"
    rm -rf node_modules/@beeui
    npm install --save-exact \
      "${CORE_TARBALL}" \
      "${TOKENS_TARBALL}" \
      "${UI_TARBALL}"
    echo "::endgroup::"
  fi

  if node -e "require.resolve('expo')" >/dev/null 2>&1; then
    echo "Web consumer unexpectedly resolves the Expo runtime; it must stay independent of the Showcase's Expo path."
    exit 1
  fi
}

build_consumer() {
  test -d "${APP_DIR}" || { echo "Web consumer is missing; run prepare first."; exit 1; }
  cd "${APP_DIR}"
  npx vite build
  test -s dist/index.html
}

verify_consumer() {
  test -d "${APP_DIR}" || { echo "Web consumer is missing; run prepare first."; exit 1; }
  test -f "${APP_DIR}/dist/index.html" || { echo "Production build is missing; run build first."; exit 1; }
  cd "${APP_DIR}"

  npx vite preview --port "${PREVIEW_PORT}" --strictPort >"${WORK_ROOT}/preview.log" 2>&1 &
  # Intentionally not `local`: the EXIT trap below runs after this function
  # returns, so it needs a script-global variable to still see the pid.
  PREVIEW_PID=$!
  # Cleanup fires on both normal exit and failure (e.g. the interaction
  # script below throwing), so a failed run never leaves an orphaned preview
  # server holding the port for the next invocation.
  trap 'kill "${PREVIEW_PID}" >/dev/null 2>&1 || true' EXIT

  local ready=0
  for _ in $(seq 1 40); do
    if curl -s -o /dev/null "http://localhost:${PREVIEW_PORT}/"; then
      ready=1
      break
    fi
    sleep 0.5
  done
  if [ "${ready}" -ne 1 ]; then
    echo "vite preview did not become ready on port ${PREVIEW_PORT}:"
    cat "${WORK_ROOT}/preview.log" || true
    exit 1
  fi

  BEEUI_WEB_CONSUMER_PORT="${PREVIEW_PORT}" node verify-consumer.mjs
}

case "${ACTION}" in
  prepare)
    prepare_consumer
    ;;
  build)
    build_consumer
    ;;
  verify)
    verify_consumer
    ;;
  all)
    prepare_consumer
    build_consumer
    verify_consumer
    ;;
  *)
    echo "Unknown action: ${ACTION}. Expected prepare, build, verify, or all."
    exit 2
    ;;
esac
