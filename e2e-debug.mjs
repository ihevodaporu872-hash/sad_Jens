import { chromium } from '@playwright/test';

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => errors.push('[' + msg.type() + '] ' + msg.text()));
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

  console.log('Opening page...\n');
  await page.goto('http://localhost:5173/excel', { timeout: 30000 });
  await page.waitForTimeout(8000);

  console.log('=== #root CONTENT ===');
  const rootHtml = await page.locator('#root').innerHTML();
  console.log(rootHtml.substring(0, 3000) || '(empty)');

  console.log('\n=== ALL CONSOLE OUTPUT ===');
  errors.slice(0, 20).forEach(e => console.log(e));

  await browser.close();
}

debug().catch(console.error);
