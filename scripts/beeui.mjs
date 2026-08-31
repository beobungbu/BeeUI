#!/usr/bin/env node
// Repository-local dev entry point. `pnpm beeui -- <command>` delegates to the
// same CLI engine shipped as the publishable `@beeui/cli` package
// (packages/cli/src/beeui.mjs) so the repo-local and published code paths
// never fork (#209). This file only exists so `pnpm beeui` keeps working
// without requiring a build step during development.
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { checkNodeVersion, main } from '../packages/cli/src/beeui.mjs';

export { checkNodeVersion, main };

function resolveRealFileUrl(filePath) {
  try {
    return pathToFileURL(realpathSync(filePath)).href;
  } catch {
    return pathToFileURL(filePath).href;
  }
}

const entry = process.argv[1] ? resolveRealFileUrl(process.argv[1]) : null;
if (entry === import.meta.url) process.exitCode = await main();
