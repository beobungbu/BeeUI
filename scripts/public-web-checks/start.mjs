import fs from 'node:fs';
import path from 'node:path';

import { ROOT_DIR } from '../public-site-contract-lib.mjs';

const DOC_DIR = 'apps/docs/src/content/docs/start';
const REQUIRED_DOCS = ['index.md', 'expo.md', 'bare-react-native.md', 'web.md', 'provider-safe-area.md'];

export function collectViolations(rootDir = ROOT_DIR) {
  const violations = [];
  const docs = Object.fromEntries(
    REQUIRED_DOCS.map((name) => [name, fs.readFileSync(path.join(rootDir, DOC_DIR, name), 'utf8')]),
  );

  for (const [name, text] of Object.entries(docs)) {
    if (/content pending|intentionally stubs?|follow-up docs content issue/i.test(text)) {
      violations.push(`${name} still contains launch-blocking stub/pending copy.`);
    }
    if (!text.includes('/docs/') && name !== 'provider-safe-area.md') {
      violations.push(`${name} must use canonical /docs/ links after the public-site base migration.`);
    }
  }

  const index = docs['index.md'];
  for (const required of ['examples/expo-package-consumer', 'examples/bare-rn-consumer', 'examples/web-consumer', 'Package boundary', 'Source ownership']) {
    if (!index.includes(required)) violations.push(`index.md is missing onboarding decision contract ${JSON.stringify(required)}.`);
  }

  const expo = docs['expo.md'];
  for (const required of ['bash setup.sh', 'bash bundle.sh', 'npx expo start', "@import '@beemvp/beeui-tokens/theme.css';", 'withUniwindConfig']) {
    if (!expo.includes(required)) violations.push(`expo.md is missing executable fixture detail ${JSON.stringify(required)}.`);
  }
  const expoCss = fs.readFileSync(path.join(rootDir, 'examples/expo-package-consumer/global.css'), 'utf8');
  for (const required of ["@import 'tailwindcss';", "@import 'uniwind';", "@import '@beemvp/beeui-tokens/theme.css';"]) {
    if (!expoCss.includes(required) || !expo.includes(required)) violations.push(`Expo styling contract drifted for ${JSON.stringify(required)}.`);
  }
  const expoMetro = fs.readFileSync(path.join(rootDir, 'examples/expo-package-consumer/metro.config.js'), 'utf8');
  for (const required of ['withUniwindConfig', "cssEntryFile: './global.css'"]) {
    if (!expoMetro.includes(required) || !expo.includes(required)) violations.push(`Expo Metro contract drifted for ${JSON.stringify(required)}.`);
  }

  const bare = docs['bare-react-native.md'];
  for (const required of ['examples/bare-rn-consumer', 'bash setup.sh', 'bash bundle.sh', 'Metro bundling']) {
    if (!bare.includes(required)) violations.push(`bare-react-native.md is missing ${JSON.stringify(required)}.`);
  }

  const web = docs['web.md'];
  for (const required of ['examples/web-consumer', 'bash setup.sh', 'npm run build', 'React Native Web']) {
    if (!web.includes(required)) violations.push(`web.md is missing ${JSON.stringify(required)}.`);
  }

  const provider = docs['provider-safe-area.md'];
  for (const required of ['Nested BeeUIProvider behavior', 'Overlay scopes', 'Toast scope', "edges={['top', 'left', 'right']}"]) {
    if (!provider.includes(required)) violations.push(`provider-safe-area.md is missing ${JSON.stringify(required)}.`);
  }

  return violations;
}
