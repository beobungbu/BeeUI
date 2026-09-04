#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fencedJson(file, tag, rootDir = ROOT_DIR) {
  const markdown = fs.readFileSync(path.join(rootDir, file), 'utf8');
  const match = new RegExp('```json ' + tag + '\\n([\\s\\S]*?)\\n```').exec(markdown);
  if (!match) throw new Error(`${file} is missing machine block ${tag}.`);
  return JSON.parse(match[1]);
}

export function readPublicGuideData(rootDir = ROOT_DIR) {
  const compatibility = fencedJson('docs/compatibility-matrix.md', 'compatibility-matrix', rootDir);
  const distribution = fencedJson('docs/dist-tag-policy.md', 'dist-tag-policy', rootDir);
  const rootPackage = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  return { compatibility, distribution, version: rootPackage.version };
}

function renderCompatibility(data) {
  const c = data.compatibility;
  return `---\ntitle: Current tested versions\ndescription: Machine-sourced BeeUI compatibility snapshot.\n---\n\n# Current tested versions\n\nThis page is generated from the machine-checked snapshot in [\`docs/compatibility-matrix.md\`](https://github.com/beobungbu/BeeUI/blob/main/docs/compatibility-matrix.md). These are the **tested/pinned points**, not permission to widen a peer range beyond the package manifests.\n\n| Surface | Tested / pinned |\n| --- | --- |\n| Node | \`${c.node.repo}\` |\n| pnpm | \`${c.node.pnpm}\` |\n| React | \`${c.react}\` |\n| React DOM | \`${c.reactDom}\` |\n| React Native | \`${c.reactNative}\` |\n| React Native Web | \`${c.reactNativeWeb}\` |\n| Expo SDK | \`${c.expoSdkRange}\` |\n| Tailwind CSS | \`${c.tailwindcss}\` |\n| Uniwind | \`${c.uniwind}\` |\n| react-native-safe-area-context | \`${c.safeAreaContext.ui}\` (UI dev), \`${c.safeAreaContext.showcase}\` (Showcase) |\n| react-native-teleport | \`${c.teleport.ui}\` (UI dev), \`${c.teleport.showcase}\` (Showcase) |\n\n## Evidence scope\n\nBeeUI distinguishes type/contract checks, bundle or native compile checks, browser interaction, and simulator/emulator/device runtime evidence. A stronger-sounding claim is never inferred from a weaker class. Current stable support centers on RN 0.86.x; RN 0.87 is outside the stable promise because retained native compatibility evidence found an upstream Android incompatibility.\n\nFor peer ranges and optional native dependencies, inspect [\`packages/ui/package.json\`](https://github.com/beobungbu/BeeUI/blob/main/packages/ui/package.json) and the [full compatibility authority](https://github.com/beobungbu/BeeUI/blob/main/docs/compatibility-matrix.md).\n`;
}

function renderRelease(data) {
  const p = data.distribution;
  return `---\ntitle: Current release status\ndescription: Machine-sourced BeeUI version, publication and channel status.\n---\n\n# Current release status\n\n| Field | Current contract |\n| --- | --- |\n| Workspace/package version | \`${data.version}\` |\n| Published to npm | **${p.published ? 'yes' : 'no'}** |\n| Stable target | \`${p.candidateStableVersion}\` |\n| Stable dist-tag | \`${p.stableDistTag}\` |\n| Prerelease dist-tag | \`${p.prereleaseDistTag}\` |\n| Release environment | \`${p.releaseEnvironment}\` |\n\nThis page is generated from [\`docs/dist-tag-policy.md\`](https://github.com/beobungbu/BeeUI/blob/main/docs/dist-tag-policy.md) plus the root workspace manifest. Release-ready means the repository has the engineering controls required to produce/verify artifacts; it does **not** mean an npm package, CLI, Git tag or GitHub Release exists. Publication remains an explicit owner action.\n\nDate-version labels such as \`${data.version}\` identify the current candidate workspace state. Prerelease/stable channels remain governed by the canonical distribution policy rather than historical RC evidence.\n`;
}

export function generatePublicGuideData({ rootDir = ROOT_DIR } = {}) {
  const data = readPublicGuideData(rootDir);
  const compatibilityOut = path.join(rootDir, 'apps/docs/src/content/docs/compatibility/current.md');
  const releaseOut = path.join(rootDir, 'apps/docs/src/content/docs/guides/current-release.md');
  fs.writeFileSync(compatibilityOut, renderCompatibility(data));
  fs.writeFileSync(releaseOut, renderRelease(data));
  return data;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = generatePublicGuideData();
  console.log(`Generated public compatibility/release data for ${data.version}.`);
}
