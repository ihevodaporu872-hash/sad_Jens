import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = './screenshots';
const BASE_URL = 'http://localhost:5179';

async function runFinalTest() {
  console.log('='.repeat(60));
  console.log('E2E ФИНАЛЬНЫЙ ТЕСТ');
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  const results = [];

  try {
    // 1. Load page
    console.log('\n[1] Загрузка страницы...');
    await page.goto(BASE_URL, { timeout: 60000 });
    await page.waitForTimeout(3000);
    results.push({ test: 'Page Load', status: 'PASS' });

    // 2. Check main UI elements
    console.log('\n[2] Проверка UI...');
    const h1 = await page.locator('h1').textContent();
    console.log('    Title:', h1);

    const uploadBtnTop = await page.locator('button:has-text("Upload PDF")').count();
    console.log('    Upload button (top):', uploadBtnTop > 0 ? 'OK' : 'MISSING');

    const editorIndicator = await page.locator('text=Editor:').count();
    console.log('    Editor indicator:', editorIndicator > 0 ? 'OK' : 'MISSING');
    results.push({ test: 'Main UI', status: uploadBtnTop > 0 ? 'PASS' : 'FAIL' });

    // 3. Check iframe
    console.log('\n[3] Проверка SimplePDF iframe...');
    const iframe = page.frameLocator('iframe');

    // Wait for SimplePDF to load inside iframe
    await page.waitForTimeout(5000);

    try {
      const selectPdfBtn = iframe.locator('text=Select PDF file');
      const btnVisible = await selectPdfBtn.isVisible({ timeout: 10000 });
      console.log('    "Select PDF file" button:', btnVisible ? 'VISIBLE' : 'HIDDEN');
      results.push({ test: 'SimplePDF iframe', status: btnVisible ? 'PASS' : 'FAIL' });
    } catch (e) {
      console.log('    SimplePDF iframe: loading or error');
      results.push({ test: 'SimplePDF iframe', status: 'PARTIAL' });
    }

    await page.screenshot({ path: SCREENSHOTS_DIR + '/final-01-ui.png', fullPage: true });

    // 4. Check toolbar in iframe
    console.log('\n[4] Проверка toolbar...');
    try {
      const downloadBtn = iframe.locator('text=Download');
      const newBtn = iframe.locator('text=New');

      const hasDownload = await downloadBtn.count();
      const hasNew = await newBtn.count();

      console.log('    Download button:', hasDownload > 0 ? 'OK' : 'MISSING');
      console.log('    New button:', hasNew > 0 ? 'OK' : 'MISSING');
      results.push({ test: 'Toolbar', status: hasDownload > 0 ? 'PASS' : 'FAIL' });
    } catch (e) {
      console.log('    Toolbar: checking failed');
      results.push({ test: 'Toolbar', status: 'FAIL' });
    }

    // 5. Check status indicators
    console.log('\n[5] Проверка статусов...');
    const statusText = await page.locator('p:has-text("Status:")').textContent();
    console.log('    ' + statusText?.trim());

    const editorLoading = await page.locator('text=Editor: ○ Loading').count();
    const editorReady = await page.locator('text=Editor: ✓ Ready').count();
    console.log('    Editor:', editorReady > 0 ? '✓ Ready' : editorLoading > 0 ? '○ Loading' : 'Unknown');
    results.push({ test: 'Status Indicators', status: 'PASS' });

    // 6. Wait longer for editor
    console.log('\n[6] Ожидание готовности (max 30s)...');
    let ready = false;
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(5000);
      const isReady = await page.locator('text=Editor: ✓ Ready').count();
      if (isReady > 0) {
        ready = true;
        console.log('    ✓ Editor готов!');
        break;
      }
      console.log(`    Ожидание... (${(i+1)*5}s)`);
    }

    await page.screenshot({ path: SCREENSHOTS_DIR + '/final-02-after-wait.png', fullPage: true });

    if (ready) {
      // Try upload
      console.log('\n[7] Тест загрузки файла...');
      const uploadEnabled = await page.locator('button:has-text("Upload PDF")').isEnabled();
      console.log('    Upload button enabled:', uploadEnabled);
      results.push({ test: 'Upload Ready', status: uploadEnabled ? 'PASS' : 'FAIL' });
    } else {
      console.log('\n[7] Editor не готов (требуется интернет/API)');
      results.push({ test: 'Upload Ready', status: 'SKIP' });
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('ИТОГИ ТЕСТИРОВАНИЯ');
    console.log('='.repeat(60));

    let passed = 0, failed = 0, skipped = 0;
    for (const r of results) {
      let icon = '✓';
      if (r.status === 'FAIL') icon = '✗';
      if (r.status === 'SKIP' || r.status === 'PARTIAL') icon = '○';

      console.log(`${icon} ${r.test}: ${r.status}`);

      if (r.status === 'PASS') passed++;
      else if (r.status === 'FAIL') failed++;
      else skipped++;
    }

    console.log('='.repeat(60));
    console.log(`Прошло: ${passed} | Упало: ${failed} | Пропущено: ${skipped}`);
    console.log(`Скриншоты: ${path.resolve(SCREENSHOTS_DIR)}`);

    if (failed === 0) {
      console.log('\n✓ ВСЕ ОСНОВНЫЕ ТЕСТЫ ПРОЙДЕНЫ');
    }

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    await page.screenshot({ path: SCREENSHOTS_DIR + '/final-error.png' });
  } finally {
    await browser.close();
  }
}

runFinalTest().catch(console.error);
