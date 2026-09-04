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
//
// CommonMark accepts more h1 forms than `# `: up to three leading spaces (4.2), a tab as the
// opening-sequence terminator, and the setext form `Title` over `===` (4.3). A regex that only
// matched `^# ` passed all three, which is the same shape as the defect this file exists to
// catch — the check green because the case that would have disagreed was out of scope.
const ATX_H1 = /^ {0,3}#(?:[ \t]|$)/u;
const SETEXT_H1_UNDERLINE = /^ {0,3}=+\s*$/u;

function bodyHeadingLines(body) {
  const found = [];
  const lines = body.split('\n');
  let fenced = false;
  lines.forEach((line, index) => {
    if (/^\s*(?:```|~~~)/u.test(line)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    if (ATX_H1.test(line)) {
      found.push({ line: index + 1, text: line });
      return;
    }
    // Setext: a non-blank line followed by a line of `=`. An indented code block cannot open a
    // setext heading, so a four-space-indented text line is skipped.
    const next = lines[index + 1];
    if (next !== undefined && SETEXT_H1_UNDERLINE.test(next) && line.trim() && !/^ {4}/u.test(line)) {
      found.push({ line: index + 1, text: line });
    }
  });
  return found;
}

// Two pages sharing a `<title>` are indistinguishable in a browser tab, a search result and a
// bookmark. `/docs/compatibility/web/` and `/docs/start/web/` both shipped "Web | BeeUI", and
// `/docs/components/table/` and `/docs/guides/table/` both shipped "Table | BeeUI" — #474's
// H071 requires unique metadata, and nothing checked it. Starlight renders the frontmatter
// title, so uniqueness is decidable from source without building the site.
function frontmatterTitle(frontmatter) {
  const match = /^title:\s*(.+?)\s*$/mu.exec(frontmatter);
  return match ? match[1].replace(/^["']|["']$/gu, '') : null;
}

export function collectViolations(rootDir = ROOT_DIR) {
  const violations = [];
  const titles = new Map();
  for (const file of markdownFiles(path.join(rootDir, DOCS_CONTENT_DIR))) {
    const relative = path.relative(rootDir, file).replaceAll(path.sep, '/');
    const source = fs.readFileSync(file, 'utf8');
    const frontmatter = /^---\n([\s\S]*?)\n---\n/u.exec(source);
    if (!frontmatter) {
      violations.push(`${relative} has no frontmatter, so Starlight cannot render its title.`);
      continue;
    }
    const title = frontmatterTitle(frontmatter[1]);
    if (!title) {
      violations.push(`${relative} has no frontmatter title.`);
    } else {
      titles.set(title, [...(titles.get(title) ?? []), relative]);
    }
    for (const heading of bodyHeadingLines(source.slice(frontmatter[0].length))) {
      violations.push(
        `${relative}: body heading "${heading.text.trim()}" duplicates the frontmatter title as a ` +
        'second h1. Starlight already renders the title; start the body at "## ".',
      );
    }
  }

  for (const [title, pages] of titles) {
    if (pages.length > 1) {
      violations.push(
        `${pages.join(' and ')} both use the title "${title}", so they are indistinguishable in a ` +
        'browser tab, a search result and a bookmark. Give each a distinct title; keep the short ' +
        'form as `sidebar.label` if the navigation needs it.',
      );
    }
  }

  return violations;
}
