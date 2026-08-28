import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildGuardRules,
  collectComponentSourceFiles,
  EXCEPTION_MARKER,
  isTypedReaderImplementationFile,
  MIN_EXCEPTION_RATIONALE_LENGTH,
  runTokenConsumptionGuard,
  scanSourceText,
  TYPED_READER_IMPLEMENTATION_RELATIVE_PATH,
} from '../check-semantic-token-consumption.mjs';
import { loadCanonicalTokens, readableTokenNamespaces, readableVariablePrefixes } from '../generate-tokens.mjs';

const source = loadCanonicalTokens();
const { rules } = buildGuardRules(source);

function scan(text) {
  return scanSourceText('fixture.tsx', text, rules);
}

function ruleIds(violations) {
  return violations.map((violation) => violation.ruleId);
}

test('raw hex color literal fails', () => {
  const violations = scan('const styles = { backgroundColor: "#ff0000" };\n');
  assert.deepEqual(ruleIds(violations), ['raw-hex-color']);
});

test('short and alpha hex forms are all caught', () => {
  const violations = scan('const a = "#fff"; const b = "#fff0"; const c = "#11223344";\n');
  assert.deepEqual(ruleIds(violations), ['raw-hex-color', 'raw-hex-color', 'raw-hex-color']);
});

test('raw rgb()/rgba()/hsl()/hsla() literal fails where in scope', () => {
  const violations = scan(
    [
      'const a = "background-color: rgb(255, 0, 0);";',
      'const b = "color: rgba(0,0,0,0.5)";',
      'const c = "color: hsl(0 0% 0%)";',
      'const d = "color: hsla(0 0% 0% / 50%)";',
    ].join('\n'),
  );
  assert.deepEqual(ruleIds(violations), [
    'raw-rgb-hsl-color',
    'raw-rgb-hsl-color',
    'raw-rgb-hsl-color',
    'raw-rgb-hsl-color',
  ]);
});

test('private primitive consumption fails — numeric-shade family', () => {
  const violations = scan('const cls = "bg-neutral-500";\n');
  assert.deepEqual(ruleIds(violations), ['private-primitive-utility']);
});

test('private primitive violation reports the full identifier, not a truncated prefix', () => {
  // "neutral" is itself a private family name and a prefix of "neutral-500". Regex
  // alternation is first-match-wins, so the identifier list must be sorted longest-first —
  // otherwise this reports match text "bg-neutral" instead of the real "bg-neutral-500".
  const violations = scan('const cls = "bg-neutral-500";\n');
  assert.equal(violations.length, 1);
  assert.equal(violations[0].match, 'bg-neutral-500');
  assert.match(violations[0].message, /"bg-neutral-500"/);
});

test('private primitive consumption fails — named leaf', () => {
  const violations = scan('const cls = "bg-danger-emphasis text-feedback-success";\n');
  assert.deepEqual(ruleIds(violations), ['private-primitive-utility', 'private-primitive-utility']);
});

test('private primitives pointer/reference fails', () => {
  const violations = scan('const ref = "#/primitives/danger/default";\n');
  assert.ok(violations.some((violation) => violation.ruleId === 'private-primitive-pointer'));
});

test("Tailwind's own default numeric palette scale fails even outside BeeUI primitives", () => {
  // "sky" is not a BeeUI primitive family at all, but it is a numbered Tailwind default
  // color scale — no BeeUI public semantic token ever ends in a bare numeric shade.
  const violations = scan('const cls = "bg-sky-500";\n');
  assert.deepEqual(ruleIds(violations), ['palette-scale-utility']);
});

test('unsupported raw CSS-variable access fails when a typed path already exists — colors', () => {
  const violations = scan('const style = { outlineColor: "var(--color-primary)" };\n');
  assert.deepEqual(ruleIds(violations), ['raw-css-variable-access']);
  assert.match(violations[0].message, /useBeeToken\('colors\.<key>'\)/);
});

test('unsupported raw CSS-variable access fails — chart namespace', () => {
  const violations = scan('const style = { stroke: "var(--chart-series-1)" };\n');
  assert.deepEqual(ruleIds(violations), ['raw-css-variable-access']);
  assert.match(violations[0].message, /useBeeToken\('chart\.<key>'\)/);
  assert.match(violations[0].message, /chartColorVariable\(\)/);
});

test('unsupported raw CSS-variable access fails — radius namespace', () => {
  const violations = scan('const style = { borderRadius: "var(--radius-md)" };\n');
  assert.deepEqual(ruleIds(violations), ['raw-css-variable-access']);
  assert.match(violations[0].message, /useBeeToken\('radius\.<key>'\)/);
  assert.match(violations[0].message, /radiusVariable\(\)/);
});

test('unsupported raw CSS-variable access fails — motion-duration namespace', () => {
  const violations = scan('const style = { transitionDuration: "var(--motion-duration-normal)" };\n');
  assert.deepEqual(ruleIds(violations), ['raw-css-variable-access']);
  assert.match(violations[0].message, /useBeeToken\('motion\.<key>'\)/);
  assert.match(violations[0].message, /motionDurationVariable\(\)/);
});

test('a non-token var(--...) with no typed reader passes — layout/z-index vars', () => {
  const violations = scan('const style = { zIndex: "var(--z-40)", top: "var(--layer-overlay)" };\n');
  assert.deepEqual(violations, []);
});

test('direct useCSSVariable() call with a readable-namespace literal fails', () => {
  const violations = scan("const raw = useCSSVariable('--color-primary');\n");
  assert.deepEqual(ruleIds(violations), ['typed-reader-bypass-call']);
  assert.match(violations[0].message, /useBeeToken\('colors\.<key>'\)/);
});

test('direct Uniwind.getCSSVariable() call with a readable-namespace literal fails', () => {
  const violations = scan("const raw = Uniwind.getCSSVariable('--radius-md');\n");
  assert.deepEqual(ruleIds(violations), ['typed-reader-bypass-call']);
  assert.match(violations[0].message, /getBeeToken\('radius\.<key>'\)/);
});

test('a useCSSVariable() call for a non-readable namespace is not flagged by the bypass rule', () => {
  // "--layer-overlay" has no typed reader category (see readableTokenNamespaces()), so
  // calling Uniwind's raw read API with it is not a typed-reader bypass.
  const violations = scan("const raw = useCSSVariable('--layer-overlay');\n");
  assert.deepEqual(violations, []);
});

test('brand-specific styling branch fails', () => {
  const violations = scan("if (brand === 'violet') { doSomething(); }\n");
  assert.deepEqual(ruleIds(violations), ['brand-literal-branch']);
});

test('a switch/case brand-name branch fails', () => {
  const violations = scan(
    ["switch (brand) {", "  case 'violet':", '    return violetIcon;', '  default:', '    return icon;', '}'].join(
      '\n',
    ),
  );
  assert.deepEqual(ruleIds(violations), ['brand-literal-branch']);
  assert.equal(violations[0].line, 2);
});

test('an unrelated switch/case literal that is not a brand name passes', () => {
  const violations = scan(
    ["switch (status) {", "  case 'foo':", '    return 1;', '  default:', '    return 0;', '}'].join('\n'),
  );
  assert.deepEqual(violations, []);
});

test('normal semantic class/token consumption passes', () => {
  const violations = scan(
    'const cls = "bg-primary text-primary-foreground border-border-strong active:bg-primary-pressed";\n',
  );
  assert.deepEqual(violations, []);
});

test('legitimate content strings and numbers pass', () => {
  const violations = scan(
    [
      'const label = "Order #12345 costs $19.99";',
      'const layout = "px-4 gap-2 rounded-md z-50 h-control-default";',
      'const count = items.length + 1;',
    ].join('\n'),
  );
  assert.deepEqual(violations, []);
});

test('a documented exception with a real rationale passes', () => {
  const violations = scan(
    `const legacy = "#ff00ff"; // ${EXCEPTION_MARKER}: matches a third-party SDK color we cannot theme\n`,
  );
  assert.deepEqual(violations, []);
});

test('a blank exception rationale fails and the underlying violation still fails', () => {
  const violations = scan(`const legacy = "#ff00ff"; // ${EXCEPTION_MARKER}:\n`);
  assert.deepEqual(ruleIds(violations).sort(), ['blank-exception-rationale', 'raw-hex-color']);
});

test('a too-short exception rationale fails and the underlying violation still fails', () => {
  const violations = scan(`const legacy = "#ff00ff"; // ${EXCEPTION_MARKER}: no\n`);
  assert.deepEqual(ruleIds(violations).sort(), ['blank-exception-rationale', 'raw-hex-color']);
  assert.ok(
    MIN_EXCEPTION_RATIONALE_LENGTH > 'no'.length,
    'fixture rationale must be shorter than the enforced minimum',
  );
});

test('an exception only suppresses the line it is written on', () => {
  const violations = scan(
    [
      'const a = "#ff00ff";',
      `const b = "#00ff00"; // ${EXCEPTION_MARKER}: vendor asset color pinned by contract`,
    ].join('\n'),
  );
  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 1);
});

test('a "//" inside a string is not mistaken for a comment, and a real trailing comment is not scanned', () => {
  const violations = scan(
    [
      'const url = "https://example.com/#ff00ff-not-a-color-because-not-in-css-context";',
      '// #ff00ff mentioned only in a comment, never flagged',
      'const ok = "bg-primary"; // see https://example.com for rationale, not an exception marker',
    ].join('\n'),
  );
  // The URL fixture is intentionally still flagged: the guard is text-based, not a full
  // parser, and "#ff00ff" is indistinguishable from a real hex literal once inside a
  // string. What this test actually protects is the second and third lines: a `//` inside
  // a string must not truncate scanning early, and a same-line trailing comment (with no
  // exception marker) must not itself be scanned for violations.
  assert.deepEqual(ruleIds(violations), ['raw-hex-color']);
});

test('classification automatically follows canonical metadata changes — new private leaf is caught', () => {
  const mutated = structuredClone(source);
  mutated.primitives.neutral['777'] = {
    $value: { colorSpace: 'srgb', components: [0.1, 0.1, 0.1], hex: '#1a1a1a' },
  };
  const { rules: mutatedRules } = buildGuardRules(mutated);
  const violations = scanSourceText('fixture.tsx', 'const cls = "bg-neutral-777";\n', mutatedRules);
  assert.deepEqual(ruleIds(violations), ['private-primitive-utility']);
});

test('classification automatically follows canonical metadata changes — declassifying a group stops flagging its named leaves', () => {
  const mutated = structuredClone(source);
  mutated.$extensions['com.beeui'].privateTokenGroups = [];
  const { rules: mutatedRules } = buildGuardRules(mutated);
  // "danger-emphasis" is a named (non-numeric) leaf, so it is only caught by the
  // metadata-derived private-primitive-utility rule, never by the numeric palette-scale
  // fallback. With no private groups declared, no rule can see it anymore.
  const violations = scanSourceText('fixture.tsx', 'const cls = "bg-danger-emphasis";\n', mutatedRules);
  assert.deepEqual(violations, []);
});

test('a documented escape-hatch exception on a readable-namespace violation passes', () => {
  const violations = scan(
    [
      "const raw = useCSSVariable('--color-primary'); " +
        `// ${EXCEPTION_MARKER}: reviewed one-off vendor SDK bridge, see issue #999`,
    ].join('\n'),
  );
  assert.deepEqual(violations, []);
});

test('readable-namespace classification is derived from canonical metadata, not hand-maintained — includes colors/chart/radius/motionDuration', () => {
  const namespaces = readableTokenNamespaces(source);
  const categories = namespaces.map((namespace) => namespace.readerCategory).sort();
  assert.deepEqual(categories, ['chart', 'colors', 'motion', 'radius']);
  assert.deepEqual(
    readableVariablePrefixes(source).sort(),
    ['--chart-', '--color-', '--motion-duration-', '--radius-'].sort(),
  );
});

test('classification automatically follows canonical metadata changes — declassifying radius as runtimeOverridable stops flagging var(--radius-*)', () => {
  const mutated = structuredClone(source);
  mutated.tokens.radius.$extensions['com.beeui'].runtimeOverridable = false;
  const { rules: mutatedRules } = buildGuardRules(mutated);
  const violations = scanSourceText(
    'fixture.tsx',
    'const style = { borderRadius: "var(--radius-md)" };\n',
    mutatedRules,
  );
  assert.deepEqual(violations, []);
  // colors is unaffected by the radius flag — it stays flagged.
  const colorViolations = scanSourceText(
    'fixture.tsx',
    'const style = { outlineColor: "var(--color-primary)" };\n',
    mutatedRules,
  );
  assert.deepEqual(ruleIds(colorViolations), ['raw-css-variable-access']);
});

test('isTypedReaderImplementationFile matches only the exact sanctioned adapter file', () => {
  assert.equal(isTypedReaderImplementationFile(TYPED_READER_IMPLEMENTATION_RELATIVE_PATH), true);
  assert.equal(isTypedReaderImplementationFile('packages/ui/src/components/button.tsx'), false);
  assert.equal(
    isTypedReaderImplementationFile('packages/ui/src/components/other/use-bee-token.ts'),
    false,
  );
});

test('the sanctioned use-bee-token.ts implementation is exempted from the typed-reader-bypass-call rule, but nothing else in its directory is', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-token-guard-exempt-'));
  try {
    const componentsDir = path.join(tmpRoot, 'packages/ui/src/components');
    fs.mkdirSync(componentsDir, { recursive: true });
    fs.writeFileSync(
      path.join(componentsDir, 'use-bee-token.ts'),
      [
        "import { Uniwind, useCSSVariable } from 'uniwind';",
        'export function useBeeToken(path) {',
        "  const raw = useCSSVariable('--color-primary');",
        '  return raw;',
        '}',
        'export function getBeeToken(path) {',
        "  return Uniwind.getCSSVariable('--radius-md');",
        '}',
      ].join('\n'),
    );
    // A sibling file in the SAME directory using the same raw calls is still flagged —
    // the exemption is by exact file path, never a directory-level ignore.
    fs.writeFileSync(
      path.join(componentsDir, 'other-component.tsx'),
      "const raw = useCSSVariable('--color-primary');\n",
    );

    const { violations } = runTokenConsumptionGuard({ rootDir: tmpRoot, source });
    const byFile = new Map();
    for (const violation of violations) {
      byFile.set(violation.file, [...(byFile.get(violation.file) ?? []), violation.ruleId]);
    }

    assert.equal(byFile.has(path.join('packages/ui/src/components', 'use-bee-token.ts')), false);
    assert.deepEqual(byFile.get(path.join('packages/ui/src/components', 'other-component.tsx')), [
      'typed-reader-bypass-call',
    ]);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('file collection excludes generated output, declaration files, and test/story files', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-token-guard-'));
  try {
    const srcDir = path.join(tmpRoot, 'packages/ui/src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'button.tsx'), 'export const Button = () => null;\n');
    fs.writeFileSync(path.join(srcDir, 'button.d.ts'), 'export declare const Button: unknown;\n');
    fs.writeFileSync(path.join(srcDir, 'button.test.tsx'), 'test("noop", () => {});\n');
    fs.writeFileSync(path.join(srcDir, 'button.stories.tsx'), 'export const Story = {};\n');
    fs.mkdirSync(path.join(srcDir, '__tests__'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, '__tests__', 'button.fixture.tsx'), 'export const x = "#ff0000";\n');
    fs.mkdirSync(path.join(tmpRoot, 'apps/showcase/patterns'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRoot, 'apps/showcase/patterns', 'not-in-scope.tsx'),
      'export const x = "#ff0000";\n',
    );

    const files = collectComponentSourceFiles(tmpRoot);
    assert.deepEqual(files, [path.join(srcDir, 'button.tsx')]);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('the real packages/ui tree passes with no unexplained violations', () => {
  const { violations, filesScanned } = runTokenConsumptionGuard();
  assert.ok(filesScanned > 0, 'expected packages/ui/src component sources to scan');
  assert.deepEqual(
    violations.map((violation) => `${violation.file}:${violation.line}:${violation.column} ${violation.message}`),
    [],
  );
});
