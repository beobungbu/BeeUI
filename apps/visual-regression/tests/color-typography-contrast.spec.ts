import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// Consumer-shaped colour and typography checks, measured the way an outside consumer
// measures them: computed styles in a real browser, WCAG 2.x relative-luminance contrast
// against the effective (alpha-composited) background, in every canonical theme. The
// fixture puts no colour class on any ancestor except the page background, so text that
// falls back to the document colour renders black on the dark surface and fails here.

const WCAG_AA_NORMAL_TEXT = 4.5;

type Measurement = {
  color: string;
  background: string;
  contrast: number;
  fontSize: string;
  lineHeight: string;
};

async function gotoFixture(page: Page, testInfo: TestInfo) {
  const metadata = testInfo.project.metadata as VisualProjectMetadata;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/?fixture=color-typography&theme=${metadata.visualTheme}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');
  await expect(page.getByTestId('color-typography-fixture')).toBeVisible();
  return metadata;
}

/**
 * Finds the element that directly owns `text` inside `scopeTestId` and measures its
 * computed typography plus its WCAG contrast over the composited ancestor backgrounds.
 */
function measureText(page: Page, scopeTestId: string, text: string): Promise<Measurement> {
  return page.evaluate(
    ({ scopeTestId: scopeId, text: wanted }) => {
      const scope = document.querySelector(`[data-testid="${scopeId}"]`);
      if (!scope) throw new Error(`Missing scope ${scopeId}`);

      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      const parts: Text[] = [];
      while (walker.nextNode()) parts.push(walker.currentNode as Text);
      const owner = parts
        .map((node) => node.parentElement)
        .find((element) => element?.textContent?.trim() === wanted);
      if (!owner) throw new Error(`No element in ${scopeId} renders "${wanted}"`);

      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('2d canvas unavailable');

      // Canvas resolves every CSS colour syntax Chromium can compute (rgb, oklab,
      // color-mix output) to 8-bit sRGB with straight alpha.
      const toRgba = (value: string): [number, number, number, number] => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = '#000000';
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
        return [r, g, b, a / 255];
      };
      const over = (
        top: [number, number, number, number],
        bottom: [number, number, number],
      ): [number, number, number] => [
        top[0] * top[3] + bottom[0] * (1 - top[3]),
        top[1] * top[3] + bottom[1] * (1 - top[3]),
        top[2] * top[3] + bottom[2] * (1 - top[3]),
      ];
      const luminance = ([r, g, b]: [number, number, number]) => {
        const channel = (value: number) => {
          const srgb = value / 255;
          return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };

      const chain: Element[] = [];
      for (let node: Element | null = owner; node; node = node.parentElement) chain.push(node);
      // The browser canvas behind an unpainted document is white.
      let background: [number, number, number] = [255, 255, 255];
      for (const element of chain.reverse()) {
        background = over(toRgba(getComputedStyle(element).backgroundColor), background);
      }

      const style = getComputedStyle(owner);
      const foreground = over(toRgba(style.color), background);
      const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      const round = (value: number) => Math.round(value);

      return {
        color: `rgb(${foreground.map(round).join(', ')})`,
        background: `rgb(${background.map(round).join(', ')})`,
        contrast: Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
      };
    },
    { scopeTestId, text },
  );
}

function expectReadable(measurement: Measurement, label: string) {
  expect(
    measurement.contrast,
    `${label}: ${measurement.color} on ${measurement.background} is ${measurement.contrast}:1`,
  ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
}

test('a className typography step sets its own size and keeps the foreground colour', async ({ page }, testInfo) => {
  await gotoFixture(page, testInfo);

  const caption = await measureText(page, 'typography-caption-class', 'Caption through the className step');
  expect(caption.fontSize).toBe('12px');
  expect(caption.lineHeight).toBe('16px');
  expectReadable(caption, 'Text className="text-caption"');
});

test('avatar fallback initials scale with the avatar size', async ({ page }, testInfo) => {
  await gotoFixture(page, testInfo);

  const expected = { sm: '12px', md: '14px', lg: '16px', xl: '18px' } as const;
  for (const [size, fontSize] of Object.entries(expected)) {
    const initials = size.toUpperCase();
    const measured = await measureText(page, `avatar-${size}`, initials);
    expect(measured.fontSize, `Avatar size="${size}"`).toBe(fontSize);
  }
});

test('table body cells and caption keep a readable foreground in every theme', async ({ page }, testInfo) => {
  await gotoFixture(page, testInfo);

  expectReadable(await measureText(page, 'color-table', 'Customer'), 'TableHead');
  expectReadable(await measureText(page, 'color-table-plain-cell', 'Alpha Store'), 'plain TableCell');
  expectReadable(await measureText(page, 'color-table-mixed-cell', 'Row 2'), 'TableCell with mixed text children');
  expectReadable(await measureText(page, 'color-table-selected-cell', 'Beta Market'), 'TableCell in a selected row');
  expectReadable(await measureText(page, 'color-table-caption', 'Recent transactions'), 'TableCaption');
});

test('stepper step titles, including the current one, meet AA contrast', async ({ page }, testInfo) => {
  await gotoFixture(page, testInfo);

  expectReadable(await measureText(page, 'stepper-current', 'Payment'), 'current StepperItem title');
  expectReadable(await measureText(page, 'stepper-complete', 'Cart'), 'complete StepperItem title');
  expectReadable(await measureText(page, 'stepper-upcoming', 'Receipt'), 'upcoming StepperItem title');
});

// Metro's development server can hand the app its stylesheet after the first render.
// This reproduces that ordering against the exported build: the stylesheet link is
// removed from the document and attached only once the fixture has rendered. Accent
// colours resolved by reading stylesheet rules at first render come out empty (and log
// Uniwind's "no color was found" warning in development) and never recover; colours
// that reference the theme variables resolve as soon as the stylesheet arrives.
test('accent colours resolve when the stylesheet arrives after the first render', async ({ page }, testInfo) => {
  const metadata = testInfo.project.metadata as VisualProjectMetadata;
  await page.route(
    (url) => url.pathname === '/',
    async (route) => {
      const response = await route.fetch();
      const html = await response.text();
      const stylesheet = /<link rel="stylesheet" href="([^"]+)">/.exec(html);
      if (!stylesheet) throw new Error('Exported index.html has no stylesheet link');
      const lateStylesheet = `<script>
        (function attachWhenRendered() {
          if (!document.querySelector('[data-testid="accent-spinner"]')) {
            return setTimeout(attachWhenRendered, 20);
          }
          setTimeout(function () {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = ${JSON.stringify(stylesheet[1])};
            document.head.appendChild(link);
          }, 150);
        })();
      </script>`;
      const body = html
        .replace(/<link rel="preload"[^>]*as="style">/, '')
        .replace(stylesheet[0], lateStylesheet);
      await route.fulfill({ response, body });
    },
  );

  await page.goto(`/?fixture=color-typography&theme=${metadata.visualTheme}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByTestId('accent-spinner')).toBeAttached();
  await expect
    .poll(() => page.evaluate(() => document.styleSheets.length > 1 && getComputedStyle(document.documentElement).getPropertyValue('--color-primary') !== ''))
    .toBe(true);
  // Give every stylesheet observer (Uniwind re-reads rules on an idle callback) time to settle.
  await page.waitForTimeout(500);

  const colors = await page.evaluate(() => {
    const probe = document.createElement('div');
    const fixture = document.querySelector('[data-testid="color-typography-fixture"]');
    if (!fixture) throw new Error('Missing fixture root');
    probe.style.color = 'var(--color-primary)';
    fixture.appendChild(probe);
    const primary = getComputedStyle(probe).color;
    probe.remove();

    const spinner = document.querySelector('[data-testid="accent-spinner"]');
    const arcs = Array.from(spinner?.querySelectorAll('circle') ?? []).map((circle) => getComputedStyle(circle).stroke);
    const switchRoot = document.querySelector('[data-testid="accent-switch"]');
    const switchBackgrounds = Array.from(switchRoot?.querySelectorAll('div') ?? []).map(
      (element) => getComputedStyle(element).backgroundColor,
    );
    return { primary, arcs, switchBackgrounds };
  });

  expect(colors.arcs.length).toBeGreaterThan(0);
  for (const arc of colors.arcs) expect(arc, 'Spinner arc stroke').toBe(colors.primary);
  expect(colors.switchBackgrounds, 'Switch on-track colour').toContain(colors.primary);
});
