import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// Real-layout geometry for text-bearing controls consumers measured as
// broken: a text field whose fixed line box clips scaled glyphs, a
// SegmentedControl that splits a narrow row equally and breaks labels
// mid-word, an IconButton whose `size` loses a class merge, and a wrapped
// Button label that hugs the start edge. Fixture:
// `src/controls-sizing-fixture.tsx` (`?fixture=controls-sizing`).

function restrictToOneProject(testInfo: TestInfo) {
  const metadata = testInfo.project.metadata as VisualProjectMetadata;
  // Geometry here is theme-independent; the fixture sets its own widths.
  test.skip(
    metadata.visualTheme !== 'light' || metadata.visualViewport !== 'mobile',
    'control geometry is theme-independent',
  );
}

async function openFixture(page: Page) {
  await page.goto('/?fixture=controls-sizing', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');
  await expect(page.getByTestId('controls-sizing-fixture')).toBeVisible();
}

// Native Dynamic Type scales text (font size and its paired line height) but
// not layout geometry (control heights stay in dp/pt). The Web analogue is to
// scale only the semantic typography tokens and leave `--spacing-*` alone —
// unlike a root font-size override, which scales every rem-based control
// height in lockstep and so can never expose a line box that fails to follow
// the text.
const ACCESSIBILITY_LARGE_FONT_SCALE = 2.14;
const TYPOGRAPHY_ROLES = ['caption', 'label', 'body', 'heading', 'title', 'display'] as const;

async function scaleTypographyTokens(page: Page, scale: number) {
  await page.evaluate(
    ({ roles, factor }) => {
      const root = document.documentElement;
      const computed = getComputedStyle(root);
      for (const role of roles) {
        for (const name of [`--text-${role}`, `--text-${role}--line-height`]) {
          const base = computed.getPropertyValue(name).trim();
          const match = /^([\d.]+)rem$/.exec(base);
          if (!match) throw new Error(`${name} is not a rem token: "${base}"`);
          root.style.setProperty(name, `${Number(match[1]) * factor}rem`);
        }
      }
    },
    { roles: TYPOGRAPHY_ROLES, factor: scale },
  );
}

type FieldMetrics = {
  contentHeight: number;
  fontSize: number;
  glyphHeight: number;
  height: number;
  lineHeight: number;
};

async function measureField(page: Page, testId: string): Promise<FieldMetrics> {
  return page.getByTestId(testId).evaluate((node) => {
    const input = node as HTMLInputElement;
    const style = getComputedStyle(input);
    const context = document.createElement('canvas').getContext('2d');
    if (!context) throw new Error('2d canvas unavailable');
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const metrics = context.measureText(input.value);
    const fontSize = Number.parseFloat(style.fontSize);
    // The font's own ascent + descent: the box every glyph of the face,
    // including stacked Vietnamese diacritics and descenders, is designed to
    // fit. `actualBoundingBox*` of this exact string is folded in too, in
    // case a glyph exceeds the face's nominal metrics.
    const glyphHeight = Math.max(
      metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent,
      metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
    );
    const lineHeight = style.lineHeight === 'normal' ? glyphHeight : Number.parseFloat(style.lineHeight);
    const contentHeight =
      input.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom);
    return {
      contentHeight,
      fontSize,
      glyphHeight,
      height: input.getBoundingClientRect().height,
      lineHeight,
    };
  });
}

const FIELD_IDS = ['sizing-input-sm', 'sizing-input-md', 'sizing-input-lg', 'sizing-search-input'] as const;

test.describe('Input and SearchInput line box follows the text size', () => {
  test('keeps the unscaled field heights and line boxes', async ({ page }, testInfo) => {
    restrictToOneProject(testInfo);
    await openFixture(page);

    const expected: Record<(typeof FIELD_IDS)[number], { height: number; lineHeight: number }> = {
      'sizing-input-sm': { height: 36, lineHeight: 20 },
      'sizing-input-md': { height: 44, lineHeight: 24 },
      'sizing-input-lg': { height: 48, lineHeight: 24 },
      'sizing-search-input': { height: 44, lineHeight: 24 },
    };
    for (const id of FIELD_IDS) {
      const metrics = await measureField(page, id);
      expect(metrics.height, `${id} height`).toBeCloseTo(expected[id].height, 0);
      expect(metrics.lineHeight, `${id} line-height`).toBeCloseTo(expected[id].lineHeight, 0);
    }
  });

  test('grows the line box with the text at accessibility-large scale instead of clipping glyphs', async ({
    page,
  }, testInfo) => {
    restrictToOneProject(testInfo);
    await openFixture(page);

    const baseline = Object.fromEntries(
      await Promise.all(FIELD_IDS.map(async (id) => [id, await measureField(page, id)] as const)),
    ) as Record<(typeof FIELD_IDS)[number], FieldMetrics>;

    await scaleTypographyTokens(page, ACCESSIBILITY_LARGE_FONT_SCALE);

    for (const id of FIELD_IDS) {
      const scaled = await measureField(page, id);
      // The scale really reached the field's text.
      expect(scaled.fontSize, `${id} font size`).toBeCloseTo(
        baseline[id].fontSize * ACCESSIBILITY_LARGE_FONT_SCALE,
        0,
      );
      // The line box and the field's content box are never shorter than the
      // glyphs they must show.
      expect(scaled.lineHeight, `${id} line box vs glyph extents`).toBeGreaterThanOrEqual(scaled.glyphHeight);
      expect(scaled.contentHeight, `${id} content box vs glyph extents`).toBeGreaterThanOrEqual(
        scaled.glyphHeight - 0.5,
      );
      // The line box scales with the text rather than staying pinned.
      expect(scaled.lineHeight / baseline[id].lineHeight, `${id} line box scale`).toBeCloseTo(
        ACCESSIBILITY_LARGE_FONT_SCALE,
        1,
      );
    }
  });
});

test('Input paints its placeholder in the theme muted-foreground colour', async ({ page }, testInfo) => {
  restrictToOneProject(testInfo);
  await openFixture(page);

  const colours = await page.getByTestId('sizing-placeholder-input').evaluate((node) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--color-muted-foreground)';
    node.parentElement?.appendChild(probe);
    const expected = getComputedStyle(probe).color;
    probe.remove();
    return { expected, placeholder: getComputedStyle(node, '::placeholder').color };
  });
  expect(colours.placeholder).toBe(colours.expected);
});

type WordBreak = { segment: string; word: string; lines: number };

// For every word of every visible label text node under `testId`, the number
// of distinct line boxes the word's glyphs occupy. A word that wraps
// mid-word ("thù / ng") spans two lines.
async function wordsSplitAcrossLines(page: Page, testIds: readonly string[]): Promise<WordBreak[]> {
  return page.evaluate((ids) => {
    const broken: { segment: string; word: string; lines: number }[] = [];
    for (const id of ids) {
      const root = document.querySelector(`[data-testid="${id}"]`);
      if (!root) throw new Error(`missing ${id}`);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.parentElement?.closest('[aria-hidden="true"]')) continue;
        const text = node.textContent ?? '';
        for (const match of text.matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          const tops = new Set(
            Array.from(range.getClientRects())
              .filter((rect) => rect.width > 0)
              .map((rect) => Math.round(rect.top)),
          );
          if (tops.size !== 1) broken.push({ segment: id, word: match[0], lines: tops.size });
        }
      }
    }
    return broken;
  }, testIds);
}

async function segmentsOutsideControl(page: Page, controlId: string, segmentIds: readonly string[]) {
  const control = await page.getByTestId(controlId).boundingBox();
  if (!control) throw new Error(`missing ${controlId}`);
  const outside: string[] = [];
  for (const id of segmentIds) {
    const box = await page.getByTestId(id).boundingBox();
    if (!box) throw new Error(`missing ${id}`);
    if (box.x < control.x - 0.5 || box.x + box.width > control.x + control.width + 0.5) outside.push(id);
  }
  return outside;
}

const NARROW_SEGMENTS = ['sizing-segment-chai', 'sizing-segment-loc', 'sizing-segment-thung'] as const;
const WIDE_SEGMENTS = ['sizing-segment-light', 'sizing-segment-dark', 'sizing-segment-system'] as const;

test.describe('SegmentedControl sizes segments from their labels', () => {
  test('breaks labels only at word boundaries in a narrow container at normal text size', async ({
    page,
  }, testInfo) => {
    restrictToOneProject(testInfo);
    await openFixture(page);

    await expect.poll(() => wordsSplitAcrossLines(page, NARROW_SEGMENTS)).toEqual([]);
    expect(await segmentsOutsideControl(page, 'sizing-segmented-narrow', NARROW_SEGMENTS)).toEqual([]);
  });

  test('keeps word-boundary wrapping inside the control at large text', async ({ page }, testInfo) => {
    restrictToOneProject(testInfo);
    await openFixture(page);

    // Browser text-size preference: rem-based text, padding and the narrow
    // container all grow together.
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '24px';
    });
    await expect
      .poll(() => wordsSplitAcrossLines(page, [...NARROW_SEGMENTS, ...WIDE_SEGMENTS]), { message: '1.5x root' })
      .toEqual([]);
    expect(await segmentsOutsideControl(page, 'sizing-segmented-narrow', NARROW_SEGMENTS)).toEqual([]);
    expect(await segmentsOutsideControl(page, 'sizing-segmented-wide', WIDE_SEGMENTS)).toEqual([]);

    // Native accessibility-large: only the text grows. The three-option theme
    // control still fits one word per line and wraps between words.
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '';
    });
    await scaleTypographyTokens(page, ACCESSIBILITY_LARGE_FONT_SCALE);
    await expect
      .poll(() => wordsSplitAcrossLines(page, WIDE_SEGMENTS), { message: `${ACCESSIBILITY_LARGE_FONT_SCALE}x text` })
      .toEqual([]);
    expect(await segmentsOutsideControl(page, 'sizing-segmented-wide', WIDE_SEGMENTS)).toEqual([]);
    // The 192px pack-size row cannot fit even one word per line at this size;
    // the segments must still stay inside the control rather than overflow it.
    await expect
      .poll(() => segmentsOutsideControl(page, 'sizing-segmented-narrow', NARROW_SEGMENTS))
      .toEqual([]);
  });
});

test.describe('IconButton honours its size', () => {
  test('renders the square control size for every size step', async ({ page }, testInfo) => {
    restrictToOneProject(testInfo);
    await openFixture(page);

    const expected = {
      'sizing-icon-button-default': 44,
      'sizing-icon-button-sm': 36,
      'sizing-icon-button-md': 44,
      'sizing-icon-button-lg': 48,
    } as const;
    for (const [id, size] of Object.entries(expected)) {
      const box = await page.getByTestId(id).boundingBox();
      if (!box) throw new Error(`missing ${id}`);
      expect({ id, width: Math.round(box.width), height: Math.round(box.height) }).toEqual({
        id,
        width: size,
        height: size,
      });
    }
  });
});

type LineOffsets = { lines: number; maxOffset: number };

// Horizontal distance between the centre of each rendered line of the
// button's label and the centre of the button.
async function labelLineOffsets(page: Page, buttonId: string): Promise<LineOffsets> {
  return page.getByTestId(buttonId).evaluate((button) => {
    const buttonBox = button.getBoundingClientRect();
    const center = buttonBox.left + buttonBox.width / 2;
    const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
    const rects: DOMRect[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      rects.push(...Array.from(range.getClientRects()).filter((rect) => rect.width > 0));
    }
    const byLine = new Map<number, { left: number; right: number }>();
    for (const rect of rects) {
      const top = Math.round(rect.top);
      const line = byLine.get(top);
      byLine.set(top, {
        left: Math.min(line?.left ?? rect.left, rect.left),
        right: Math.max(line?.right ?? rect.right, rect.right),
      });
    }
    let maxOffset = 0;
    for (const line of byLine.values()) {
      maxOffset = Math.max(maxOffset, Math.abs((line.left + line.right) / 2 - center));
    }
    return { lines: byLine.size, maxOffset };
  });
}

test.describe('Button label alignment', () => {
  for (const id of ['sizing-button-wrapped-string', 'sizing-button-wrapped-label']) {
    test(`centres every line of a wrapped label (${id})`, async ({ page }, testInfo) => {
      restrictToOneProject(testInfo);
      await openFixture(page);

      const offsets = await labelLineOffsets(page, id);
      expect(offsets.lines, 'the fixture label must actually wrap').toBeGreaterThanOrEqual(2);
      // react-native-web text is `white-space: pre-wrap`, so a line's
      // trailing space still takes part in centring: allow half a space
      // (~2px at label size). A start-aligned wrapped line is off by tens of px.
      expect(offsets.maxOffset).toBeLessThanOrEqual(3);
    });
  }
});
