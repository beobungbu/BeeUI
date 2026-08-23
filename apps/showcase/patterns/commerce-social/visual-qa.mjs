import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

const showcaseRoot = resolve(process.cwd());
const appPath = join(showcaseRoot, 'App.tsx');
const outputDir = join(tmpdir(), 'beeui-commerce-social-visual-qa');
const originalApp = readFileSync(appPath, 'utf8');
const require = createRequire(import.meta.url);
const playwrightPath = resolve(showcaseRoot, '../visual-regression/node_modules/@playwright/test');

const qaApp = `import './global.css';

import { BeeUIProvider } from '@beeui/ui';
import * as React from 'react';
import { Uniwind } from 'uniwind';
import {
  CartScreen,
  CheckoutScreen,
  MessagesScreen,
  NotificationsScreen,
  OrderDetailScreen,
  OrdersScreen,
  PostDetailScreen,
  ProductDetailScreen,
  ProductFeedScreen,
  ProductSearchScreen,
  SocialFeedScreen,
  UserProfileScreen,
} from './patterns/commerce-social';
import { cartItems, orders, products } from './patterns/commerce-social/fixtures/commerce-fixtures';

const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
const requestedTheme = params.get('theme') === 'dark' ? 'dark' : 'light';
if (typeof window !== 'undefined') Uniwind.setTheme(requestedTheme);

const longTitle = 'A deliberately very long premium product title that must wrap cleanly without crushing prices, ratings, variants, or actions';
const stressProduct = {
  ...products[0]!,
  id: 'visual-stress-product',
  name: longTitle,
  subtitle: 'An unusually long subtitle used to verify mobile wrapping and content hierarchy under realistic stress',
  description: 'This intentionally long description repeats enough production-like detail to validate paragraph wrapping, vertical rhythm, and action separation across narrow and wide layouts without depending on truncation or fixed heights. '.repeat(3),
  availability: 'Temporarily unavailable in several regions · back-order timing may vary by destination',
  shipping: 'Tracked international delivery with a long returns-policy explanation that still needs to remain readable on narrow screens.',
  variants: ['Extra Small / Short', 'Medium / Regular', 'Large / Long', 'Extra Large / Extended', 'Limited Edition / Collector Finish'],
};
const zeroVariantProduct = { ...stressProduct, id: 'visual-zero-variant', variants: [] };
const manyCartItems = Array.from({ length: 8 }, (_, index) => ({
  ...cartItems[index % cartItems.length]!,
  id: 'visual-cart-' + index,
  quantity: index === 7 ? 128 : index + 1,
  product: { ...cartItems[index % cartItems.length]!.product, name: index === 0 ? longTitle : cartItems[index % cartItems.length]!.product.name },
}));
const manyOrder = {
  ...orders[0]!,
  id: 'visual-order-many',
  number: 'ORDER-2026-VERY-LONG-IDENTIFIER-0000001048',
  itemCount: manyCartItems.length,
  items: manyCartItems,
};

function AppScreen() {
  const screen = params.get('screen') ?? 'product-feed';
  const state = params.get('state') ?? 'default';
  if (screen === 'product-feed') return <ProductFeedScreen loading={state === 'loading'} />;
  if (screen === 'product-search') return <ProductSearchScreen initialQuery={state === 'empty' ? 'not-found-anywhere' : ''} mode={state === 'loading' ? 'loading' : 'results'} />;
  if (screen === 'product-detail') return <ProductDetailScreen product={state === 'zero' ? zeroVariantProduct : state === 'stress' ? stressProduct : undefined} />;
  if (screen === 'cart') return <CartScreen empty={state === 'empty'} items={state === 'many' ? manyCartItems : state === 'one' ? manyCartItems.slice(0, 1) : undefined} />;
  if (screen === 'checkout') return <CheckoutScreen status={state === 'processing' ? 'processing' : state === 'problem' ? 'problem' : 'ready'} />;
  if (screen === 'orders') return <OrdersScreen empty={state === 'empty'} />;
  if (screen === 'order-detail') return <OrderDetailScreen order={state === 'many' ? manyOrder : undefined} />;
  if (screen === 'social-feed') return <SocialFeedScreen mode={state === 'empty' ? 'empty' : state === 'loading' ? 'loading' : 'feed'} />;
  if (screen === 'post-detail') return <PostDetailScreen />;
  if (screen === 'notifications') return <NotificationsScreen empty={state === 'empty'} />;
  if (screen === 'user-profile') return <UserProfileScreen />;
  return <MessagesScreen empty={state === 'empty'} />;
}

export default function App() {
  return <BeeUIProvider><AppScreen /></BeeUIProvider>;
}
`;

function serve(root) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.hbc': 'application/octet-stream' };
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    let filePath = join(root, decodeURIComponent(url.pathname));
    if (url.pathname === '/' || !existsSync(filePath)) filePath = join(root, 'index.html');
    try {
      response.setHeader('content-type', types[extname(filePath)] ?? 'application/octet-stream');
      response.end(readFileSync(filePath));
    } catch (error) {
      response.statusCode = 500;
      response.end(String(error));
    }
  });
  return new Promise((resolvePromise) => server.listen(0, '127.0.0.1', () => resolvePromise(server)));
}

const screens = ['product-feed','product-search','product-detail','cart','checkout','orders','order-detail','social-feed','post-detail','notifications','user-profile','messages'];
const viewportCases = [
  { width: 390, height: 844, theme: 'light' },
  { width: 390, height: 844, theme: 'dark' },
  { width: 430, height: 932, theme: 'light' },
  { width: 430, height: 932, theme: 'dark' },
  { width: 1280, height: 900, theme: 'light' },
];
const stressCases = [
  ['product-detail', 'stress'], ['product-detail', 'zero'],
  ['cart', 'one'], ['cart', 'many'], ['cart', 'empty'],
  ['checkout', 'processing'], ['checkout', 'problem'],
  ['orders', 'empty'], ['order-detail', 'many'],
  ['notifications', 'empty'], ['messages', 'empty'],
];

let server;
let browser;
try {
  writeFileSync(appPath, qaApp);
  rmSync(outputDir, { force: true, recursive: true });
  execFileSync('pnpm', ['exec', 'expo', 'export', '--platform', 'web', '--output-dir', outputDir], { cwd: showcaseRoot, stdio: 'inherit' });
  execFileSync('pnpm', ['--dir', '../visual-regression', 'exec', 'playwright', 'install', 'chromium'], { cwd: showcaseRoot, stdio: 'inherit' });

  const { chromium } = require(playwrightPath);
  server = await serve(outputDir);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  browser = await chromium.launch({ headless: true });
  const failures = [];
  const summaries = [];

  async function inspect(screen, state, viewport, theme) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    const url = `http://127.0.0.1:${port}/?screen=${encodeURIComponent(screen)}&state=${encodeURIComponent(state)}&theme=${theme}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid$="-screen"]').first().waitFor({ state: 'visible' });
    await page.evaluate(async () => {
      if ('fonts' in document) await document.fonts.ready;
      await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
    });
    const metrics = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const elements = [...document.querySelectorAll('*')];
      const visible = elements.filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      });
      const overflow = visible.filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.left < -1 || (rect.right > viewportWidth + 1 && !['auto', 'scroll'].includes(style.overflowX));
      }).slice(0, 8).map((element) => ({ tag: element.tagName, text: (element.textContent ?? '').trim().slice(0, 80), rect: element.getBoundingClientRect().toJSON() }));
      const interactive = visible.filter((element) => ['button','radio','checkbox','link'].includes(element.getAttribute('role') ?? '') || element.tagName === 'BUTTON');
      const touchMin = interactive.reduce((min, element) => {
        const rect = element.getBoundingClientRect();
        return Math.min(min, rect.width, rect.height);
      }, Number.POSITIVE_INFINITY);
      const bodyStyle = getComputedStyle(document.body);
      return {
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth,
        overflow,
        interactiveCount: interactive.length,
        minInteractiveDimension: Number.isFinite(touchMin) ? Math.round(touchMin * 10) / 10 : null,
        bodyBackground: bodyStyle.backgroundColor,
        bodyColor: bodyStyle.color,
        fullHeight: document.documentElement.scrollHeight,
      };
    });
    const screenshot = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 45 });
    await page.close();
    if (metrics.scrollWidth > metrics.viewportWidth + 1 || metrics.overflow.length > 0) {
      failures.push({ screen, state, viewport, theme, metrics });
    }
    return { screen, state, viewport: `${viewport.width}x${viewport.height}`, theme, screenshotBytes: screenshot.length, ...metrics };
  }

  for (const viewport of viewportCases) {
    const caseResults = [];
    for (const screen of screens) caseResults.push(await inspect(screen, 'default', viewport, viewport.theme));
    summaries.push({ viewport: `${viewport.width}x${viewport.height}`, theme: viewport.theme, screens: caseResults.length, maxHeight: Math.max(...caseResults.map((item) => item.fullHeight)), minInteractiveDimension: Math.min(...caseResults.map((item) => item.minInteractiveDimension ?? 999)), screenshotBytes: caseResults.reduce((sum, item) => sum + item.screenshotBytes, 0), overflowScreens: caseResults.filter((item) => item.overflow.length || item.scrollWidth > item.viewportWidth + 1).map((item) => item.screen) });
  }

  const stressResults = [];
  for (const [screen, state] of stressCases) stressResults.push(await inspect(screen, state, { width: 390, height: 844 }, 'light'));
  for (const [screen, state] of stressCases) stressResults.push(await inspect(screen, state, { width: 430, height: 932 }, 'dark'));

  console.log('VISUAL_QA_SUMMARY ' + JSON.stringify(summaries));
  console.log('VISUAL_QA_STRESS ' + JSON.stringify(stressResults.map(({ screen, state, viewport, theme, fullHeight, minInteractiveDimension, screenshotBytes, overflow }) => ({ screen, state, viewport, theme, fullHeight, minInteractiveDimension, screenshotBytes, overflowCount: overflow.length }))));
  if (failures.length) {
    console.error('VISUAL_QA_FAILURES ' + JSON.stringify(failures));
    process.exitCode = 1;
  }
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolvePromise) => server.close(resolvePromise));
  writeFileSync(appPath, originalApp);
  rmSync(outputDir, { force: true, recursive: true });
}
