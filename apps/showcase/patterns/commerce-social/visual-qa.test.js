const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('renders commerce and social visual QA matrix in Chromium', () => {
  execFileSync(process.execPath, [path.resolve(__dirname, 'visual-qa.mjs')], {
    cwd: path.resolve(__dirname, '../..'),
    env: process.env,
    stdio: 'inherit',
  });
}, 240000);
