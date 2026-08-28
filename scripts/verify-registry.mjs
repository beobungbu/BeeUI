#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT, loadRegistry, publicItems } from './registry-lib.mjs';

function sorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

try {
  const registry = await loadRegistry({ repoRoot: REPO_ROOT });
  const supported = publicItems(registry);
  if (!supported.includes('button')) {
    throw new Error("registry must expose mandatory 'button' component");
  }

  // The package barrel is the authoritative public component-source surface.
  // Every exported `./components/<module>` must have exactly one public registry
  // component item with the same module name, and the registry must not claim a
  // public component that is absent from the package barrel. This prevents the
  // registry from silently drifting when a component is added (or removed).
  const publicIndex = await readFile(path.join(REPO_ROOT, 'packages/ui/src/index.ts'), 'utf8');
  const exportedModules = sorted(
    [...publicIndex.matchAll(/from ['"]\.\/components\/([^'"]+)['"]/g)].map((match) => match[1]),
  );
  const registryComponents = sorted(
    registry.items
      .filter((item) => item.public && item.type === 'component')
      .map((item) => item.name),
  );
  const missing = exportedModules.filter((name) => !registryComponents.includes(name));
  const extra = registryComponents.filter((name) => !exportedModules.includes(name));

  if (missing.length || extra.length) {
    const details = [
      missing.length ? `missing registry entries: ${missing.join(', ')}` : null,
      extra.length ? `registry-only public components: ${extra.join(', ')}` : null,
    ].filter(Boolean).join('; ');
    throw new Error(`public component coverage drift (${details})`);
  }

  process.stdout.write(
    `BeeUI registry verified: schema v${registry.schemaVersion}, ${registry.items.length} total items, ${registryComponents.length} public components + ${supported.length - registryComponents.length} other public entries (${supported.join(', ')}).\n`,
  );
} catch (error) {
  process.stderr.write(`BeeUI registry verification failed: ${error.message}\n`);
  process.exitCode = 1;
}
