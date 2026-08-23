#!/usr/bin/env node
import { REPO_ROOT, loadRegistry, publicItems } from './registry-lib.mjs';

try {
  const registry = await loadRegistry({ repoRoot: REPO_ROOT });
  const supported = publicItems(registry);
  if (supported.length < 6) throw new Error(`phase-1 registry must expose at least 6 public components; found ${supported.length}`);
  if (!supported.includes('button')) throw new Error("phase-1 registry must expose mandatory 'button' component");
  process.stdout.write(`BeeUI registry verified: schema v${registry.schemaVersion}, ${registry.items.length} total items, ${supported.length} public components (${supported.join(', ')}).\n`);
} catch (error) {
  process.stderr.write(`BeeUI registry verification failed: ${error.message}\n`);
  process.exitCode = 1;
}
