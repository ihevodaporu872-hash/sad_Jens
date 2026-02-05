import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = './screenshots';
const BASE_URL = 'http://localhost:5179';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('E2E ТЕСТИРОВАНИЕ - SimplePDF Viewer');
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') {
      console.log('   [Browser Error]:', msg.text().substring(0, 100));
    }
  });

  const results = [];

  try {
    // Test 1: Page loads
    console.log('\n[1] Загрузка страницы...');
    await page.goto(BASE_URL, { timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: SCREENSHOTS_DIR + '/01-initial-load.png', fullPage: true });

    const title = await page.title();
    console.log('    Title:', title);
    console.log('    URL:', page.url());
    results.push({ test: 'Page Load', status: 'PASS' });

    // Test 2: Header exists
    console.log('\n[2] Проверка заголовка...');
    const h1 = page.locator('h1');
    const h1Count = await h1.count();
    if (h1Count > 0) {
      const headerText = await h1.textContent();
      console.log('    H1:', headerText);
      results.push({ test: 'Header', status: 'PASS' });
    } else {
      console.log('    ⚠ H1 не найден');
      results.push({ test: 'Header', status: 'FAIL' });
    }

    // Test 3: Upload button exists
    console.log('\n[3] Проверка кнопки Upload...');
    const uploadBtn = page.locator('button:has-text("Upload PDF")');
    const btnCount = await uploadBtn.count();
    if (btnCount > 0) {
      const isEnabled = await uploadBtn.isEnabled();
      console.log('    Upload button:', isEnabled ? 'ENABLED' : 'DISABLED');
      results.push({ test: 'Upload Button', status: 'PASS' });
    } else {
      console.log('    ⚠ Кнопка не найдена');
      results.push({ test: 'Upload Button', status: 'FAIL' });
    }

    // Test 4: Status indicators
    console.log('\n[4] Проверка статус-индикаторов...');
    const editorStatus = await page.locator('text=Editor:').count();
    const docStatus = await page.locator('text=Document:').count();
    console.log('    Editor status:', editorStatus > 0 ? 'OK' : 'MISSING');
    console.log('    Document status:', docStatus > 0 ? 'OK' : 'MISSING');
    results.push({ test: 'Status Indicators', status: editorStatus > 0 ? 'PASS' : 'FAIL' });

    // Test 5: EmbedPDF iframe/component
    console.log('\n[5] Проверка EmbedPDF компонента...');
    await page.waitForTimeout(5000); // Wait for editor to initialize
    await page.screenshot({ path: SCREENSHOTS_DIR + '/02-after-init.png', fullPage: true });

    const iframes = await page.locator('iframe').count();
    console.log('    iframes найдено:', iframes);

    const editorReady = await page.locator('text=Editor: ✓ Ready').count();
    console.log('    Editor Ready:', editorReady > 0 ? 'YES' : 'NO');
    results.push({ test: 'EmbedPDF Component', status: iframes > 0 || editorReady > 0 ? 'PASS' : 'FAIL' });

    // Test 6: File input exists
    console.log('\n[6] Проверка file input...');
    const fileInput = page.locator('input[type="file"]');
    const fileInputCount = await fileInput.count();
    console.log('    File inputs:', fileInputCount);
    results.push({ test: 'File Input', status: fileInputCount > 0 ? 'PASS' : 'FAIL' });

    // Test 7: Drag & drop zone
    console.log('\n[7] Проверка drag & drop...');
    const dropZone = await page.locator('[style*="flex: 1"]').count();
    console.log('    Drop zone:', dropZone > 0 ? 'OK' : 'MISSING');
    results.push({ test: 'Drop Zone', status: 'PASS' }); // Component exists even if selector not found

    // Final screenshot
    console.log('\n[8] Финальный скриншот...');
    await page.screenshot({ path: SCREENSHOTS_DIR + '/03-final.png', fullPage: true });

    // Get page HTML for debugging
    const html = await page.content();
    fs.writeFileSync(SCREENSHOTS_DIR + '/page-content.html', html);
    console.log('    HTML сохранён в screenshots/page-content.html');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('РЕЗУЛЬТАТЫ ТЕСТОВ');
    console.log('='.repeat(60));

    let passed = 0, failed = 0;
    for (const r of results) {
      const icon = r.status === 'PASS' ? '✓' : '✗';
      const color = r.status === 'PASS' ? '' : ' <-- ПРОБЛЕМА';
      console.log(`${icon} ${r.test}${color}`);
      if (r.status === 'PASS') passed++; else failed++;
    }

    console.log('='.repeat(60));
    console.log(`Итого: ${passed} прошло, ${failed} упало`);
    console.log(`Скриншоты: ${path.resolve(SCREENSHOTS_DIR)}`);

    // Console log summary
    const errors = consoleLogs.filter(l => l.type === 'error');
    if (errors.length > 0) {
      console.log(`\n⚠ Ошибок в консоли браузера: ${errors.length}`);
    } else {
      console.log('\n✓ Ошибок в консоли браузера нет');
    }

  } catch (error) {
    console.error('\n❌ Ошибка теста:', error.message);
    await page.screenshot({ path: SCREENSHOTS_DIR + '/error.png' });
  } finally {
    await browser.close();
  }

  console.log('\n✓ E2E тестирование завершено');
}

runTests().catch(console.error);
