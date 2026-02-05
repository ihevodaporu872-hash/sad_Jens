import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = './screenshots';
const BASE_URL = 'http://localhost:5179';

// Create a simple PDF for testing
const SAMPLE_PDF_PATH = './test-sample.pdf';

async function createSamplePdf() {
  // Minimal valid PDF
  const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000052 00000 n
0000000101 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
178
%%EOF`;

  fs.writeFileSync(SAMPLE_PDF_PATH, pdfContent);
  console.log('Created test PDF:', SAMPLE_PDF_PATH);
}

async function runUploadTest() {
  console.log('='.repeat(60));
  console.log('E2E ТЕСТ ЗАГРУЗКИ PDF');
  console.log('='.repeat(60));

  await createSamplePdf();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // 1. Load page
    console.log('\n[1] Загрузка страницы...');
    await page.goto(BASE_URL, { timeout: 60000 });

    // 2. Wait for editor to be ready
    console.log('\n[2] Ожидание готовности редактора...');
    await page.waitForSelector('text=Editor: ✓ Ready', { timeout: 30000 });
    console.log('    ✓ Editor ready');
    await page.screenshot({ path: SCREENSHOTS_DIR + '/upload-01-editor-ready.png', fullPage: true });

    // 3. Check upload button is now enabled
    console.log('\n[3] Проверка кнопки Upload...');
    const uploadBtn = page.locator('button:has-text("Upload PDF")');
    const isEnabled = await uploadBtn.isEnabled();
    console.log('    Upload button enabled:', isEnabled);

    // 4. Upload file
    console.log('\n[4] Загрузка PDF файла...');
    const fileInput = page.locator('input[type="file"]');

    // Set file to input
    await fileInput.setInputFiles(path.resolve(SAMPLE_PDF_PATH));
    console.log('    ✓ Файл выбран');

    // 5. Wait for document to load
    console.log('\n[5] Ожидание загрузки документа...');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: SCREENSHOTS_DIR + '/upload-02-after-upload.png', fullPage: true });

    // Check status
    const docLoaded = await page.locator('text=Document: ✓ Loaded').count();
    console.log('    Document loaded:', docLoaded > 0 ? 'YES' : 'NO');

    const statusText = await page.locator('p:has-text("Status:")').textContent();
    console.log('    Status:', statusText);

    // 6. Final result
    console.log('\n' + '='.repeat(60));
    if (docLoaded > 0) {
      console.log('✓ ТЕСТ ЗАГРУЗКИ PDF УСПЕШЕН');
    } else {
      console.log('⚠ Документ не загружен (возможно SimplePDF API проблема)');
    }
    console.log('='.repeat(60));

    console.log('\nСкриншоты сохранены в:', path.resolve(SCREENSHOTS_DIR));

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    await page.screenshot({ path: SCREENSHOTS_DIR + '/upload-error.png' });
  } finally {
    await browser.close();
    // Cleanup
    if (fs.existsSync(SAMPLE_PDF_PATH)) {
      fs.unlinkSync(SAMPLE_PDF_PATH);
    }
  }
}

runUploadTest().catch(console.error);
