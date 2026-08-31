#!/usr/bin/env node
// react-native-builder-bob's "typescript" target runs `tsc --emitDeclarationOnly`
// over src/. tsc does not re-emit hand-written ambient `.d.ts` files that are
// already *inputs* to the project (e.g. src/components/overlay-transport.d.ts,
// a `.ts`-priority shim so Metro's platform-extension resolution still picks the
// real `.web.tsx`/`.native.tsx` runtime while TypeScript gets a matching
// type-only module — see that file's own header comment). Those shims are still
// referenced by relative imports in the *compiled* declarations of the files
// that use them (e.g. overlay-runtime.d.ts exports
// `OverlayRuntimeProviderProps.transport: OverlayTransport`), so a consumer's
// type-checker needs the shim itself on disk next to the emitted tree, or
// resolving that type fails with "Cannot find module './overlay-transport'".
//
// This copies every hand-written `.d.ts` file under src/ verbatim into both
// typescript build variants, mirroring its path relative to src/. Generic by
// design: it does not hardcode which files are shims, so it keeps working if
// more platform-shadowing `.d.ts` files are added later.
//
// It also prunes a related build artifact (#202 packed-inventory audit): bob's
// "module"/"commonjs" babel targets glob every `*.ts`/`*.tsx` file under src/,
// which also matches these same ambient `*.d.ts` shims (a `.d.ts` file's name
// still ends in `.ts`). Babel has no types to strip from a type-only module,
// so it "compiles" each shim into a near-empty `<name>.d.js` (+ `.d.js.map`)
// under dist/module and dist/commonjs — dead output nothing imports (the real
// runtime resolution for these components is their `.native`/`.web` sibling,
// never the shim) that only exists because of this glob overlap. Left in
// place it would ship as unreviewable junk in every packed tarball, so it is
// deleted here, after the real typescript-target shim copy above.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(PACKAGE_DIR, 'src');
const TYPESCRIPT_OUTPUT_DIRS = [
  path.join(PACKAGE_DIR, 'dist', 'typescript', 'commonjs'),
  path.join(PACKAGE_DIR, 'dist', 'typescript', 'module'),
];
const BABEL_OUTPUT_DIRS = [path.join(PACKAGE_DIR, 'dist', 'commonjs'), path.join(PACKAGE_DIR, 'dist', 'module')];

function findDeclarationFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findDeclarationFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

const shims = findDeclarationFiles(SRC_DIR);

for (const typesDir of TYPESCRIPT_OUTPUT_DIRS) {
  if (!fs.existsSync(typesDir)) {
    throw new Error(
      `copy-type-shims: expected the typescript build output at ${path.relative(PACKAGE_DIR, typesDir)}. Run the "typescript" react-native-builder-bob target before this script.`,
    );
  }
  for (const shim of shims) {
    const relativePath = path.relative(SRC_DIR, shim);
    const destination = path.join(typesDir, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(shim, destination);
  }
}

console.log(
  `copy-type-shims: copied ${shims.length} hand-written .d.ts file(s) into dist/typescript/{commonjs,module}.`,
);

let pruned = 0;
for (const babelDir of BABEL_OUTPUT_DIRS) {
  if (!fs.existsSync(babelDir)) continue;
  for (const shim of shims) {
    const relativeDts = path.relative(SRC_DIR, shim);
    const relativeStem = relativeDts.slice(0, -'.d.ts'.length);
    for (const suffix of ['.d.js', '.d.js.map']) {
      const junkPath = path.join(babelDir, `${relativeStem}${suffix}`);
      if (fs.existsSync(junkPath)) {
        fs.rmSync(junkPath);
        pruned += 1;
      }
    }
  }
}

console.log(
  `copy-type-shims: pruned ${pruned} babel-compiled .d.js/.d.js.map artifact(s) from dist/{commonjs,module}.`,
);
