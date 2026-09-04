import fs from 'node:fs';
import path from 'node:path';

import { ROOT_DIR } from '../public-site-contract-lib.mjs';

const DOCS_CONTENT_DIR = 'apps/docs/src/content/docs';

// Starlight renders the frontmatter `title` as the page's `<h1>`. A page that also opens with a
// body `# Title` therefore ships two `<h1>` elements and stacks its own title twice at the top.
// 125 of 151 pages did, across two generators and 22 hand-authored files, while `start/`,
// `learn/` and `reference/` were already correct — so the convention existed and nothing
// enforced it. Verified against the live build before this guard was written:
//
//   $ curl -s https://beeui-dev.beemvp.com/docs/components/accordion/ | grep -o '<h1[^>]*>'
//   <h1 id="_top" class="astro-2p6agra2">  <h1 id="accordion">
function markdownFiles(absDir) {
  return fs.readdirSync(absDir, { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(absDir, entry.name);
    if (entry.isDirectory()) return markdownFiles(next);
    return /\.mdx?$/u.test(entry.name) ? [next] : [];
  });
}

// A `# ` line inside a fenced block is sample content, not a heading.
function bodyHeadingLines(body) {
  const found = [];
  let fenced = false;
  body.split('\n').forEach((line, index) => {
    if (/^\s*(?:```|~~~)/u.test(line)) fenced = !fenced;
    else if (!fenced && /^# /u.test(line)) found.push({ line: index + 1, text: line });
  });
  return found;
}

export function collectViolations(rootDir = ROOT_DIR) {
  const violations = [];
  for (const file of markdownFiles(path.join(rootDir, DOCS_CONTENT_DIR))) {
    const relative = path.relative(rootDir, file).replaceAll(path.sep, '/');
    const source = fs.readFileSync(file, 'utf8');
    const frontmatter = /^---\n([\s\S]*?)\n---\n/u.exec(source);
    if (!frontmatter) {
      violations.push(`${relative} has no frontmatter, so Starlight cannot render its title.`);
      continue;
    }
    if (!/^title:\s*\S/mu.test(frontmatter[1])) {
      violations.push(`${relative} has no frontmatter title.`);
    }
    for (const heading of bodyHeadingLines(source.slice(frontmatter[0].length))) {
      violations.push(
        `${relative}: body heading "${heading.text.trim()}" duplicates the frontmatter title as a ` +
        'second h1. Starlight already renders the title; start the body at "## ".',
      );
    }
  }
  return violations;
}
