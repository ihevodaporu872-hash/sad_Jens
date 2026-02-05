import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// Create a simple test PDF for upload
const createTestPdf = (): Buffer => {
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 24 Tf
100 700 Td
(Test PDF) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
306
%%EOF`;
  return Buffer.from(pdf);
};

test.describe('PDF Viewer (SimplePDF Integration)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pdf');
    await page.waitForLoadState('networkidle');
  });

  test('should load PDF page with viewer container', async ({ page }) => {
    // Check main viewer container exists
    const viewer = page.locator('.pdf-viewer');
    await expect(viewer).toBeVisible({ timeout: 15000 });

    await page.screenshot({ path: 'e2e/screenshots/pdf-page-loaded.png', fullPage: true });
  });

  test('should have toolbar with header', async ({ page }) => {
    const toolbar = page.locator('.pdf-toolbar');
    await expect(toolbar).toBeVisible();

    // Check header content
    await expect(page.locator('.pdf-toolbar-header h2')).toBeVisible();
    await expect(page.locator('.pdf-toolbar-header h2')).toContainText('PDF Viewer');
  });

  test('should have Upload PDF button', async ({ page }) => {
    const uploadBtn = page.locator('.pdf-upload-btn');
    await expect(uploadBtn).toBeVisible();
    await expect(uploadBtn).toContainText('Upload PDF');
  });

  test('should have file input for PDF files', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept=".pdf,application/pdf"]');
    await expect(fileInput).toBeAttached();
  });

  test('should have SimplePDF iframe', async ({ page }) => {
    // SimplePDF embeds as iframe
    const iframe = page.locator('iframe[title="SimplePDF"]');
    await expect(iframe).toBeVisible({ timeout: 15000 });
  });

  test('SimplePDF iframe should have correct source', async ({ page }) => {
    const iframe = page.locator('iframe[title="SimplePDF"]');
    await expect(iframe).toBeVisible({ timeout: 15000 });

    const src = await iframe.getAttribute('src');
    expect(src).toContain('simplepdf.com');
  });

  test('should have PDF container', async ({ page }) => {
    const container = page.locator('.pdf-container');
    await expect(container).toBeVisible();

    // Check container has reasonable size
    const box = await container.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  test('upload button is present and clickable', async ({ page }) => {
    const uploadBtn = page.locator('.pdf-upload-btn');
    await expect(uploadBtn).toBeVisible();

    // Get bounding box to verify it's rendered properly
    const box = await uploadBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(50);
    expect(box!.height).toBeGreaterThan(20);
  });

  test('can prepare PDF file for upload', async ({ page }) => {
    // Create test PDF
    const testPdfPath = path.join(__dirname, 'test-document.pdf');
    fs.writeFileSync(testPdfPath, createTestPdf());

    try {
      // Verify file was created
      expect(fs.existsSync(testPdfPath)).toBe(true);

      // File input exists
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeAttached();

      // Can set input files (this tests the file input mechanism)
      await fileInput.setInputFiles(testPdfPath);

      // Wait briefly
      await page.waitForTimeout(2000);

      // Take screenshot
      await page.screenshot({ path: 'e2e/screenshots/pdf-after-file-select.png', fullPage: true });
    } finally {
      if (fs.existsSync(testPdfPath)) {
        fs.unlinkSync(testPdfPath);
      }
    }
  });

  test('page structure is correct', async ({ page }) => {
    // Main viewer container
    await expect(page.locator('.pdf-viewer')).toBeVisible();

    // Toolbar
    await expect(page.locator('.pdf-toolbar')).toBeVisible();

    // Toolbar header
    await expect(page.locator('.pdf-toolbar-header')).toBeVisible();

    // Toolbar actions
    await expect(page.locator('.pdf-toolbar-actions')).toBeVisible();

    // Upload button
    await expect(page.locator('.pdf-upload-btn')).toBeVisible();

    // Container with iframe
    await expect(page.locator('.pdf-container')).toBeVisible();
  });

  test('SimplePDF iframe loads editor UI', async ({ page }) => {
    const iframe = page.locator('iframe[title="SimplePDF"]');
    await expect(iframe).toBeVisible({ timeout: 15000 });

    // Wait for iframe content to fully load
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'e2e/screenshots/simplepdf-editor.png', fullPage: true });
  });
});
