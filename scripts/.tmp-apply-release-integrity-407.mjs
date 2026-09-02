import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const VERSION = '20260902.0.0';

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function write(relative, content) {
  fs.writeFileSync(path.join(ROOT, relative), content.endsWith('\n') ? content : `${content}\n`);
}

function replaceRequired(relative, from, to) {
  const current = read(relative);
  if (current.includes(to)) return;
  if (!current.includes(from)) throw new Error(`${relative}: expected text not found: ${from.slice(0, 120)}`);
  write(relative, current.replace(from, to));
}

const packageFiles = [
  'package.json',
  'packages/core/package.json',
  'packages/tokens/package.json',
  'packages/ui/package.json',
  'packages/cli/package.json',
];

for (const relative of packageFiles) {
  const json = JSON.parse(read(relative));
  json.version = VERSION;
  if (relative === 'package.json') {
    json.scripts.lint = 'eslint packages/ui/src apps/demo/src --max-warnings=0';
    json.scripts['release-control-plane:check'] = 'node ./scripts/check-release-control-plane.mjs';
    json.scripts['release-control-plane:test'] = 'node --test ./scripts/__tests__/release-control-plane.test.mjs';
    if (!json.scripts.typecheck.includes('pnpm release-control-plane:check')) {
      json.scripts.typecheck = json.scripts.typecheck.replace(
        'pnpm hygiene:check &&',
        'pnpm hygiene:check && pnpm release-control-plane:check && pnpm lint &&',
      );
    }
    if (!json.scripts.test.includes('pnpm release-control-plane:test')) {
      json.scripts.test = json.scripts.test.replace(
        'pnpm tokens:test &&',
        'pnpm release-control-plane:test && pnpm tokens:test &&',
      );
    }
  }
  write(relative, JSON.stringify(json, null, 2));
}

replaceRequired(
  'docs/architecture.md',
  'BeeUI does not claim browser-style focus trapping or unsupported native roles. Focus, keyboard, VoiceOver/TalkBack, native sheet interaction, and destructive-confirmation interaction remain runtime/device release concerns where not automated.',
  'On Web, Dialog owns and tests browser-style Tab focus trapping, initial focus, and focus restoration. On native, BeeUI relies on native modal/accessibility behavior and does not claim DOM focus-trap semantics or unsupported native roles. Native focus, keyboard, VoiceOver/TalkBack, native sheet interaction, and destructive-confirmation interaction remain runtime/device release concerns where not automated.',
);

for (const relative of ['docs/dist-tag-policy.md', 'docs/consumer-compatibility-report.md']) {
  let content = read(relative);
  content = content.replaceAll('"currentVersion": "0.1.0"', `"currentVersion": "${VERSION}"`);
  content = content.replaceAll('"candidateVersion": "0.1.0"', `"candidateVersion": "${VERSION}"`);
  content = content.replaceAll('candidate version `0.1.0` today', `candidate version \`${VERSION}\` today`);
  write(relative, content);
}

const releaseNote = `> **Release-integrity note (#407, 2026-09-02):** this document preserves historical evidence for candidate \`5cb061f\`. Those tarballs encode the former \`0.1.0\` package version. The owner-selected date-version label is \`20260902\`, represented in npm-compatible SemVer as \`${VERSION}\`. The visual verification harness was stabilized after \`5cb061f\` at \`18a6833\`. Therefore \`5cb061f\` MUST NOT be published as the current package set. A new immutable candidate must be stamped after #407 lands and the exact new head is green.\n\n`;
for (const relative of ['docs/rc-candidate.md', 'docs/rc-ci-matrix.md']) {
  const content = read(relative);
  if (!content.startsWith('> **Release-integrity note (#407')) write(relative, releaseNote + content);
}

write(
  'docs/release-integrity-20260902.md',
  `# Release integrity — 2026-09-02\n\nTracker: #407\n\n## Package version authority\n\nThe owner-selected date-version label is \`20260902\`. npm requires package versions to use SemVer syntax, so BeeUI encodes that label as the lockstep package version **\`${VERSION}\`**.\n\nThe following manifests are mechanically kept in lockstep:\n\n- workspace root\n- \`@beemvp/beeui-core\`\n- \`@beemvp/beeui-tokens\`\n- \`@beemvp/beeui-ui\`\n- \`@beemvp/beeui-cli\`\n\n## Candidate identity vs verification-harness identity\n\nThe historical immutable artifact candidate remains \`5cb061f\`; it produced the retained hashes documented in \`docs/rc-candidate.md\`. The Web visual verification harness was subsequently stabilized at \`18a6833\` without changing package source. These are separate identities and must not be conflated.\n\nThe package-version change to \`${VERSION}\` means the historical \`5cb061f\` tarballs are evidence only; they are not publication candidates for the current package set. After #407 lands and required owner/device gates are satisfied, stamp a new immutable candidate and rerun the exact-candidate matrix.\n\n## Release naming authority\n\nOperational release targets are only:\n\n- \`@beemvp/beeui-core\`\n- \`@beemvp/beeui-tokens\`\n- \`@beemvp/beeui-ui\`\n- \`@beemvp/beeui-cli\`\n\nThe superseded legacy scope is historical-only and is rejected from release-critical tracked files by \`pnpm release-control-plane:check\`.\n\n## Static analysis\n\nA focused ESLint layer checks React Hooks across reusable UI source and the production demo. Existing intentional structural-dependency exceptions are documented locally; actionable dependency omissions are fixed rather than globally disabled.\n`,
);

for (const entry of fs.readdirSync(path.join(ROOT, '.github/workflows'))) {
  if (!entry.endsWith('.yml') && !entry.endsWith('.yaml')) continue;
  const relative = `.github/workflows/${entry}`;
  let content = read(relative);
  content = content.replaceAll(
    'uses: actions/cache@v6',
    'uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6',
  );
  content = content.replaceAll(
    '# Fork PRs must never run on our self-hosted runners: pull_request from a\n    # fork gets a read-only, secret-less token, but the attacker-controlled\n    # checkout would still execute arbitrary code directly on our\n    # infrastructure. Push/schedule events are always same-repo.',
    '# Public-repo policy: this full verification path is intentionally limited to\n    # same-repository PRs. Fork PRs stay outside it; push/schedule events are\n    # always same-repo.',
  );
  content = content.replaceAll(
    '# Fork PRs must never run on our self-hosted runners: pull_request from a\n      # fork gets a read-only, secret-less token, but the attacker-controlled\n      # checkout would still execute arbitrary code directly on our\n      # infrastructure. Push/schedule events are always same-repo.',
    '# Public-repo policy: this full verification path is intentionally limited to\n      # same-repository PRs. Fork PRs stay outside it; push/schedule events are\n      # always same-repo.',
  );
  write(relative, content);
}

replaceRequired(
  'apps/demo/src/services/async-lifecycle.ts',
  "      });\n    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is caller-supplied by design (mirrors useEffect's own contract).\n  }, []);",
  "      });\n  }, []);",
);

replaceRequired(
  'packages/ui/src/components/use-bee-token.ts',
  "  // eslint-disable-next-line react-hooks/rules-of-hooks -- `variable` is derived\n  // deterministically from `path` on every render, so this hook is always\n  // called; only *which* CSS variable name it subscribes to can change.\n  const raw = useCSSVariable(variable);",
  '  const raw = useCSSVariable(variable);',
);

replaceRequired(
  'packages/ui/src/components/tooltip-shared.tsx',
  '    [clearOpenTimer, closeDelay, setOpen],',
  '    [clearCloseTimer, clearOpenTimer, closeDelay, setOpen],',
);

replaceRequired(
  'packages/ui/src/components/toast.tsx',
  '  }, [toast.id]);',
  '  }, [announcement, toast.id]);',
);

replaceRequired(
  'packages/ui/src/components/dropdown-menu.tsx',
  '    React.useEffect(() => group.registerValue(value), [group.registerValue, value]);',
  '    const registerValue = group.registerValue;\n    React.useEffect(() => registerValue(value), [registerValue, value]);',
);

replaceRequired(
  'packages/ui/src/components/select.tsx',
  "    React.useEffect(() => {\n      root.registerItem({\n        disabled: disabled === true,\n        focus: () => internalRef.current?.focus?.(),\n        id,\n        order,\n        textValue: resolvedTextValue,\n        value,\n      });\n      return () => root.unregisterItem(id);\n    }, [disabled, id, order, resolvedTextValue, root.registerItem, root.unregisterItem, value]);",
  "    const registerItem = root.registerItem;\n    const unregisterItem = root.unregisterItem;\n    React.useEffect(() => {\n      registerItem({\n        disabled: disabled === true,\n        focus: () => internalRef.current?.focus?.(),\n        id,\n        order,\n        textValue: resolvedTextValue,\n        value,\n      });\n      return () => unregisterItem(id);\n    }, [disabled, id, order, registerItem, resolvedTextValue, unregisterItem, value]);",
);

replaceRequired(
  'packages/ui/src/components/overlay-runtime.tsx',
  "    () => (hostRectOverride ? finiteRect(hostRectOverride) : null),\n    [hostRectOverride?.height, hostRectOverride?.width, hostRectOverride?.x, hostRectOverride?.y],",
  "    () => (hostRectOverride ? finiteRect(hostRectOverride) : null),\n    // Intentionally track scalar geometry rather than caller object identity: a new\n    // object with identical coordinates must not retire/restart native measurement.\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n    [hostRectOverride?.height, hostRectOverride?.width, hostRectOverride?.x, hostRectOverride?.y],",
);

write(
  'scripts/check-release-control-plane.mjs',
  `#!/usr/bin/env node\n\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport { fileURLToPath } from 'node:url';\n\nconst ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');\nexport const EXPECTED_VERSION = '${VERSION}';\nexport const EXPECTED_PACKAGE_NAMES = new Map([\n  ['packages/core/package.json', '@beemvp/beeui-core'],\n  ['packages/tokens/package.json', '@beemvp/beeui-tokens'],\n  ['packages/ui/package.json', '@beemvp/beeui-ui'],\n  ['packages/cli/package.json', '@beemvp/beeui-cli'],\n]);\n\nconst OPERATIONAL_RELEASE_FILES = [\n  'docs/release.md',\n  'docs/dist-tag-policy.md',\n  'docs/consumer-compatibility-report.md',\n  'docs/rc-candidate.md',\n  'docs/rc-ci-matrix.md',\n  'docs/registry-cli.md',\n  'docs/package-compatibility-report.md',\n];\n\nfunction walkFiles(directory) {\n  if (!fs.existsSync(directory)) return [];\n  const files = [];\n  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {\n    const absolute = path.join(directory, entry.name);\n    if (entry.isDirectory()) files.push(...walkFiles(absolute));\n    else files.push(absolute);\n  }\n  return files;\n}\n\nexport function collectReleaseControlPlaneViolations(rootDir = ROOT_DIR) {\n  const violations = [];\n  const rootManifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));\n  if (rootManifest.version !== EXPECTED_VERSION) violations.push(\`package.json: expected version \${EXPECTED_VERSION}, found \${rootManifest.version}\`);\n\n  for (const [relative, expectedName] of EXPECTED_PACKAGE_NAMES) {\n    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, relative), 'utf8'));\n    if (manifest.name !== expectedName) violations.push(\`\${relative}: expected name \${expectedName}, found \${manifest.name}\`);\n    if (manifest.version !== EXPECTED_VERSION) violations.push(\`\${relative}: expected version \${EXPECTED_VERSION}, found \${manifest.version}\`);\n  }\n\n  const workflowFiles = walkFiles(path.join(rootDir, '.github/workflows')).filter(\n    (file) => !path.basename(file).startsWith('release-integrity-407-bootstrap'),\n  );\n  const releaseFiles = [\n    ...workflowFiles,\n    ...walkFiles(path.join(rootDir, 'scripts')).filter(\n      (file) => !file.endsWith('check-release-control-plane.mjs') && !file.includes(\`\${path.sep}__tests__\${path.sep}\`) && !path.basename(file).startsWith('.tmp-apply-release-integrity-407'),\n    ),\n    ...OPERATIONAL_RELEASE_FILES.map((relative) => path.join(rootDir, relative)).filter(fs.existsSync),\n    ...EXPECTED_PACKAGE_NAMES.keys().map((relative) => path.join(rootDir, relative)),\n  ];\n  const legacyScope = '@' + 'beeui/';\n  for (const file of new Set(releaseFiles)) {\n    const content = fs.readFileSync(file, 'utf8');\n    if (content.includes(legacyScope)) violations.push(\`\${path.relative(rootDir, file)}: contains superseded legacy package scope\`);\n  }\n  return violations;\n}\n\nconst isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);\nif (isCli) {\n  const violations = collectReleaseControlPlaneViolations();\n  if (violations.length > 0) {\n    console.error('Release control-plane check failed:');\n    for (const violation of violations) console.error(\`- \${violation}\`);\n    process.exitCode = 1;\n  } else {\n    console.log(\`Release control-plane check passed (lockstep \${EXPECTED_VERSION}, current package scope only).\`);\n  }\n}\n`,
);

write(
  'scripts/__tests__/release-control-plane.test.mjs',
  `import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport os from 'node:os';\nimport path from 'node:path';\nimport test from 'node:test';\nimport { collectReleaseControlPlaneViolations, EXPECTED_PACKAGE_NAMES, EXPECTED_VERSION } from '../check-release-control-plane.mjs';\n\nfunction createFixture() {\n  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-release-control-plane-'));\n  fs.mkdirSync(path.join(root, '.github/workflows'), { recursive: true });\n  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });\n  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });\n  fs.writeFileSync(path.join(root, 'package.json'), \`\${JSON.stringify({ version: EXPECTED_VERSION })}\\n\`);\n  for (const [relative, name] of EXPECTED_PACKAGE_NAMES) {\n    const file = path.join(root, relative);\n    fs.mkdirSync(path.dirname(file), { recursive: true });\n    fs.writeFileSync(file, \`\${JSON.stringify({ name, version: EXPECTED_VERSION })}\\n\`);\n  }\n  for (const doc of ['release.md', 'dist-tag-policy.md', 'consumer-compatibility-report.md', 'rc-candidate.md', 'rc-ci-matrix.md', 'registry-cli.md', 'package-compatibility-report.md']) {\n    fs.writeFileSync(path.join(root, 'docs', doc), 'current @beemvp package release guidance\\n');\n  }\n  return root;\n}\n\ntest('accepts lockstep version and current release scope', () => {\n  const root = createFixture();\n  assert.deepEqual(collectReleaseControlPlaneViolations(root), []);\n  fs.rmSync(root, { recursive: true, force: true });\n});\n\ntest('rejects version drift and legacy release scope', () => {\n  const root = createFixture();\n  const corePath = path.join(root, 'packages/core/package.json');\n  const core = JSON.parse(fs.readFileSync(corePath, 'utf8'));\n  core.version = '0.1.0';\n  fs.writeFileSync(corePath, \`\${JSON.stringify(core)}\\n\`);\n  fs.writeFileSync(path.join(root, 'docs/release.md'), \`publish \${'@' + 'beeui/core'}\\n\`);\n  const violations = collectReleaseControlPlaneViolations(root);\n  assert.ok(violations.some((entry) => entry.includes('packages/core/package.json: expected version')));\n  assert.ok(violations.some((entry) => entry.includes('docs/release.md: contains superseded legacy package scope')));\n  fs.rmSync(root, { recursive: true, force: true });\n});\n`,
);

write(
  'eslint.config.mjs',
  `import tsParser from '@typescript-eslint/parser';\nimport reactHooks from 'eslint-plugin-react-hooks';\n\nexport default [\n  { ignores: ['**/dist/**', '**/node_modules/**', '**/.expo/**'] },\n  {\n    files: ['packages/ui/src/**/*.{ts,tsx}', 'apps/demo/src/**/*.{ts,tsx}'],\n    languageOptions: {\n      parser: tsParser,\n      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },\n    },\n    plugins: { 'react-hooks': reactHooks },\n    rules: {\n      'react-hooks/rules-of-hooks': 'error',\n      'react-hooks/exhaustive-deps': 'error',\n    },\n  },\n];\n`,
);

console.log(`Applied release-integrity #407 migration for ${VERSION}.`);
