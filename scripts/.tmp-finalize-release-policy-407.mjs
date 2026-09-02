import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const VERSION = '20260902.0.0';
const RC_VERSION = '20260902.0.0-rc.N';

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function write(relative, content) {
  fs.writeFileSync(path.join(ROOT, relative), content.endsWith('\n') ? content : `${content}\n`);
}

// #407 supersedes the old package-version examples for the current BeeUI 1.0
// product milestone. Keep the two-channel dist-tag model, but make every
// operational version example agree with the owner-selected date version.
{
  const relative = 'docs/dist-tag-policy.md';
  let content = read(relative);
  content = content.replaceAll('`1.0.0-rc.N`', `\`${RC_VERSION}\``);
  content = content.replaceAll('`1.0.0-rc.1`', '`20260902.0.0-rc.1`');
  content = content.replaceAll('`1.0.0-rc.2`', '`20260902.0.0-rc.2`');
  content = content.replaceAll('`1.0.0`', `\`${VERSION}\``);
  content = content.replaceAll('`rc.1`, `rc.2`, …', '`rc.1`, `rc.2`, …');
  content = content.replace(
    '## Prerelease versioning\n',
    `## Prerelease versioning\n\n> **2026-09-02 owner decision (#407):** BeeUI 1.0 remains the product milestone name, while npm artifacts use the date-version label \`20260902\`, encoded as SemVer \`${VERSION}\`. If a prerelease is needed for this release line, use \`${RC_VERSION}\`. This supersedes the earlier operational \`1.0.0[-rc.N]\` package-version examples.\n\n`,
  );
  write(relative, content);
}

{
  const relative = 'docs/release.md';
  let content = read(relative);
  content = content.replace(
    'This document defines what a BeeUI `0.x` release candidate means and separates automated package/compile proof from runtime/device proof.',
    `This document defines BeeUI release-candidate evidence and separates automated package/compile proof from runtime/device proof. The BeeUI 1.0 product milestone uses the owner-selected date-version label \`20260902\`, encoded as the npm-compatible lockstep SemVer \`${VERSION}\` (#407).`,
  );
  content = content.replace(
    '## Versioning policy\n\nAll BeeUI packages use one lockstep version matching the workspace root.\n\nDuring `0.x`:\n\n- patch releases must not intentionally break documented public behavior;\n- minor releases may change documented APIs while the foundation stabilizes;\n- intentional breaking changes require changelog/migration notes;\n- package versions must not drift;\n- packed manifests must not expose unresolved `workspace:*` dependency ranges.',
    `## Versioning policy\n\nAll BeeUI packages and the CLI use one lockstep version matching the workspace root. For the current BeeUI 1.0 product milestone, the owner-selected date-version label \`20260902\` is represented as npm SemVer \`${VERSION}\`. A prerelease, if needed, uses \`${RC_VERSION}\`; stable publication uses \`${VERSION}\`.\n\n- package versions must not drift;\n- intentional breaking changes require changelog/migration notes;\n- packed manifests must not expose unresolved \`workspace:*\` dependency ranges;\n- the product milestone name (\`BeeUI 1.0\`) and npm package version are separate concepts; release instructions must use the exact package version recorded in the approved candidate rather than deriving \`1.0.0\` from the milestone name.`,
  );
  write(relative, content);
}

{
  const relative = 'docs/consumer-compatibility-report.md';
  let content = read(relative);
  content = content.replace(
    `candidate version \`${VERSION}\` today — the eventual \`1.0.0\` candidate is owner-gated at`,
    `candidate version \`${VERSION}\` today — publication of that exact version is owner-gated at`,
  );
  write(relative, content);
}

console.log(`Reconciled operational release policy to ${VERSION}.`);
