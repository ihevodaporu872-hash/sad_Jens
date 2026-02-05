import { chromium } from '@playwright/test';
import fs from 'fs';

const SCREENSHOTS_DIR = './screenshots';
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function testCad() {
  console.log('=== CAD VIEWER E2E TEST ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    console.log('1. Opening CAD page...');
    await page.goto('http://localhost:5173/cad', { timeout: 30000 });
    await page.waitForTimeout(5000);

    // Screenshot
    await page.screenshot({ path: SCREENSHOTS_DIR + '/cad-initial.png', fullPage: true });
    console.log('   Screenshot saved: cad-initial.png');

    // Check elements
    console.log('\n2. Checking page elements...');
    
    const hasTitle = await page.locator('h2').count() > 0;
    const title = hasTitle ? await page.locator('h2').first().textContent() : 'NOT FOUND';
    console.log('   Title: ' + title);

    const hasContainer = await page.locator('.cad-container').count() > 0;
    console.log('   CAD container: ' + (hasContainer ? 'OK' : 'MISSING'));

    const hasUploadBtn = await page.locator('text=Upload DWG/DXF').count() > 0;
    console.log('   Upload button: ' + (hasUploadBtn ? 'OK' : 'MISSING'));

    const hasToolbar = await page.locator('.cad-toolbar').count() > 0;
    console.log('   Toolbar: ' + (hasToolbar ? 'OK' : 'MISSING'));

    // Check for errors
    console.log('\n3. Browser console errors:');
    if (errors.length === 0) {
      console.log('   No errors');
    } else {
      errors.slice(0, 5).forEach(e => console.log('   - ' + e.substring(0, 100)));
    }

    // Summary
    console.log('\n=== RESULT ===');
    const passed = hasContainer && hasUploadBtn && hasToolbar;
    console.log(passed ? '[PASS] CAD Viewer loaded successfully' : '[FAIL] CAD Viewer has issues');

  } catch (error) {
    console.error('\nTest error:', error.message);
    await page.screenshot({ path: SCREENSHOTS_DIR + '/cad-error.png' });
  } finally {
    await browser.close();
  }
}

testCad().catch(console.error);
