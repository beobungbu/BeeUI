import fs from 'node:fs';
import path from 'node:path';

import { ROOT_DIR } from '../public-site-contract-lib.mjs';

const DOC_DIR = 'apps/docs/src/content/docs/start';
const REQUIRED_DOCS = ['index.md', 'expo.md', 'bare-react-native.md', 'web.md', 'provider-safe-area.md'];

// Each starter's CSS entry: where the file lives at build time, the directory it is read from
// at build time, and the directory the package manager installs into. Tailwind resolves
// `@source` relative to the CSS file, so those last two together decide whether a glob points
// at a real node_modules tree. All three differ per starter: the bare starter copies
// `src-overrides/global.css` to `app/global.css` before installing in `app/`, and the web
// starter keeps its entry one level below its install root in `src/`.
const STARTER_STYLE_ENTRIES = [
  {
    css: 'examples/expo-package-consumer/global.css',
    cssRuntimeDir: 'examples/expo-package-consumer',
    installDir: 'examples/expo-package-consumer',
    doc: 'expo.md',
  },
  {
    css: 'examples/bare-rn-consumer/src-overrides/global.css',
    cssRuntimeDir: 'examples/bare-rn-consumer/app',
    installDir: 'examples/bare-rn-consumer/app',
    doc: 'bare-react-native.md',
  },
  {
    css: 'examples/web-consumer/src/global.css',
    cssRuntimeDir: 'examples/web-consumer/src',
    installDir: 'examples/web-consumer',
    doc: 'web.md',
  },
];

// An `@source` glob that resolves above the install root scans a directory that does not
// exist, and Tailwind reports nothing: the build succeeds and ships without BeeUI's classes.
// Two of the three starters shipped `../node_modules/...` while installing in the CSS file's
// own directory, and every other check passed the whole time — measured on the Expo starter,
// the emitted CSS went from 15,996 to 36,200 bytes once the globs resolved, and `bg-muted`,
// `bg-destructive`, `text-muted-foreground` and `rounded-md` appeared for the first time.
function workspacePackageDirs(rootDir) {
  const dirs = new Map();
  for (const entry of fs.readdirSync(path.join(rootDir, 'packages'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = path.join(rootDir, 'packages', entry.name, 'package.json');
    if (!fs.existsSync(manifest)) continue;
    dirs.set(JSON.parse(fs.readFileSync(manifest, 'utf8')).name, path.join('packages', entry.name));
  }
  return dirs;
}

export function collectStarterSourceGlobViolations(rootDir = ROOT_DIR, docs = null) {
  const violations = [];
  const packageDirs = workspacePackageDirs(rootDir);

  for (const entry of STARTER_STYLE_ENTRIES) {
    const cssPath = path.join(rootDir, entry.css);
    const cssDir = path.resolve(rootDir, entry.cssRuntimeDir);
    const installDir = path.resolve(rootDir, entry.installDir);
    // CSS accepts either quote, so matching only `'…'` left a double-quoted glob unchecked here
    // and invisible to the page comparison below.
    const globs = [...fs.readFileSync(cssPath, 'utf8').matchAll(/@source\s+['"]([^'"]+)['"]/gu)].map(([, glob]) => glob);

    if (!globs.length) {
      violations.push(`${entry.css} declares no @source glob, so Tailwind never scans BeeUI's own source.`);
      continue;
    }

    for (const glob of globs) {
      // Resolved from where the CSS file is read at build time, not where it is committed.
      const resolved = path.resolve(cssDir, glob);
      if (resolved !== installDir && !resolved.startsWith(`${installDir}${path.sep}`)) {
        violations.push(
          `${entry.css} declares @source '${glob}', which resolves to ${path.relative(rootDir, resolved)} — ` +
          `outside ${entry.installDir}, where this starter installs. Tailwind would scan nothing and ship no BeeUI classes.`,
        );
        continue;
      }

      // Containment is not enough: a glob that stays inside the install root and still points at
      // nothing — a typo'd package name, an invented path — fails in the same silent way.
      // node_modules is absent at check time, so the target is resolved against the workspace
      // package the glob names, which is what npm installs there.
      const [nodeModules, scope, name, ...rest] = path.relative(installDir, resolved).split(path.sep);
      if (nodeModules !== 'node_modules') {
        violations.push(`${entry.css} declares @source '${glob}', which does not point into this starter's node_modules.`);
        continue;
      }
      const packageName = scope?.startsWith('@') ? `${scope}/${name}` : scope;
      const subPath = (scope?.startsWith('@') ? rest : [name, ...rest]).filter(Boolean);
      const packageDir = packageDirs.get(packageName);
      if (!packageDir) {
        violations.push(
          `${entry.css} declares @source '${glob}', but "${packageName}" is not a workspace package. ` +
          'Tailwind scans nothing and reports nothing when the path does not exist.',
        );
        continue;
      }
      if (!fs.existsSync(path.join(rootDir, packageDir, ...subPath))) {
        violations.push(
          `${entry.css} declares @source '${glob}', but ${path.join(packageDir, ...subPath)} does not exist in ` +
          `${packageName}. Tailwind scans nothing and reports nothing when the path does not exist.`,
        );
      }
    }

    // The page reproduces this block and calls it verbatim. Checking only that each fixture glob
    // appears on the page leaves the other direction open: a page carrying both correct globs
    // plus a stale extra one — the exact shape just removed from these starters — passed.
    const page = docs?.[entry.doc];
    if (page) {
      const fixtureSet = [...new Set(globs)].sort();
      // Without the optional `;` a stale glob quoted in prose rather than in a fenced block was
      // invisible to this comparison, which is the one direction it was added to close.
      const pageSet = [...new Set([...page.matchAll(/@source\s+['"]([^'"]+)['"]/gu)].map(([, glob]) => glob))].sort();
      if (fixtureSet.join('\n') !== pageSet.join('\n')) {
        violations.push(
          `${entry.doc} reproduces @source globs [${pageSet.join(', ') || 'none'}] but ${entry.css} declares ` +
          `[${fixtureSet.join(', ')}]. The page teaches a stylesheet the starter does not ship.`,
        );
      }
    }
  }
  return violations;
}

export function collectViolations(rootDir = ROOT_DIR) {
  const violations = [];
  const docs = Object.fromEntries(
    REQUIRED_DOCS.map((name) => [name, fs.readFileSync(path.join(rootDir, DOC_DIR, name), 'utf8')]),
  );

  for (const [name, text] of Object.entries(docs)) {
    if (/content pending|intentionally stubs?|follow-up docs content issue/i.test(text)) {
      violations.push(`${name} still contains launch-blocking stub/pending copy.`);
    }
    if (!text.includes('/docs/') && name !== 'provider-safe-area.md') {
      violations.push(`${name} must use canonical /docs/ links after the public-site base migration.`);
    }
  }

  const index = docs['index.md'];
  for (const required of ['examples/expo-package-consumer', 'examples/bare-rn-consumer', 'examples/web-consumer', 'Package boundary', 'Source ownership']) {
    if (!index.includes(required)) violations.push(`index.md is missing onboarding decision contract ${JSON.stringify(required)}.`);
  }

  const expo = docs['expo.md'];
  for (const required of ['bash setup.sh', 'bash bundle.sh', 'npx expo start', "@import '@beemvp/beeui-tokens/theme.css';", 'withUniwindConfig']) {
    if (!expo.includes(required)) violations.push(`expo.md is missing executable fixture detail ${JSON.stringify(required)}.`);
  }
  const expoCss = fs.readFileSync(path.join(rootDir, 'examples/expo-package-consumer/global.css'), 'utf8');
  for (const required of ["@import 'tailwindcss';", "@import 'uniwind';", "@import '@beemvp/beeui-tokens/theme.css';"]) {
    if (!expoCss.includes(required) || !expo.includes(required)) violations.push(`Expo styling contract drifted for ${JSON.stringify(required)}.`);
  }
  const expoMetro = fs.readFileSync(path.join(rootDir, 'examples/expo-package-consumer/metro.config.js'), 'utf8');
  for (const required of ['withUniwindConfig', "cssEntryFile: './global.css'"]) {
    if (!expoMetro.includes(required) || !expo.includes(required)) violations.push(`Expo Metro contract drifted for ${JSON.stringify(required)}.`);
  }

  const bare = docs['bare-react-native.md'];
  for (const required of ['examples/bare-rn-consumer', 'bash setup.sh', 'bash bundle.sh', 'Metro bundling']) {
    if (!bare.includes(required)) violations.push(`bare-react-native.md is missing ${JSON.stringify(required)}.`);
  }

  const web = docs['web.md'];
  for (const required of ['examples/web-consumer', 'bash setup.sh', 'npm run build', 'React Native Web']) {
    if (!web.includes(required)) violations.push(`web.md is missing ${JSON.stringify(required)}.`);
  }

  const provider = docs['provider-safe-area.md'];
  for (const required of ['Nested BeeUIProvider behavior', 'Overlay scopes', 'Toast scope', "edges={['top', 'left', 'right']}"]) {
    if (!provider.includes(required)) violations.push(`provider-safe-area.md is missing ${JSON.stringify(required)}.`);
  }

  violations.push(...collectStarterSourceGlobViolations(rootDir, docs));

  return violations;
}
