import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the real test PDF file (630 KB)
const TEST_PDF_PATH = path.resolve(__dirname, '../public/test-files/test.pdf');

test.describe('PDF Viewer - Upload test.pdf', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the PDF page
    await page.goto('/pdf');
    await page.waitForLoadState('domcontentloaded');

    // Wait for the PDF viewer container to appear
    await page.waitForSelector('.pdf-viewer', { timeout: 30000 });
  });

  test('should open /pdf page and display viewer', async ({ page }) => {
    // Verify PDF viewer is visible
    const viewer = page.locator('.pdf-viewer');
    await expect(viewer).toBeVisible({ timeout: 15000 });

    // Verify toolbar is visible
    const toolbar = page.locator('.pdf-toolbar');
    await expect(toolbar).toBeVisible();

    // Verify upload button exists
    const uploadBtn = page.locator('.pdf-upload-btn');
    await expect(uploadBtn).toBeVisible();

    // Screenshot of initial state
    await page.screenshot({
      path: 'e2e/screenshots/pdf-viewer-initial.png',
      fullPage: true
    });
  });

  test('should have SimplePDF iframe loaded', async ({ page }) => {
    // Wait for SimplePDF iframe to be ready
    const iframe = page.locator('iframe[title="SimplePDF"]');
    await expect(iframe).toBeVisible({ timeout: 20000 });

    // Verify iframe has SimplePDF source
    const src = await iframe.getAttribute('src');
    expect(src).toContain('simplepdf.com');

    // Wait for iframe to fully load
    await page.waitForTimeout(5000);

    // Take screenshot
    await page.screenshot({
      path: 'e2e/screenshots/pdf-simplepdf-iframe.png',
      fullPage: true
    });
  });

  test('should load test.pdf via file input', async ({ page }) => {
    // Wait for SimplePDF iframe to appear
    const iframe = page.locator('iframe[title="SimplePDF"]');
    await expect(iframe).toBeVisible({ timeout: 20000 });

    // Get file input element
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();

    // Upload the test.pdf file
    await fileInput.setInputFiles(TEST_PDF_PATH);

    // Wait for processing
    await page.waitForTimeout(5000);

    // Take screenshot after file selection
    await page.screenshot({
      path: 'e2e/screenshots/pdf-test-file-selected.png',
      fullPage: true
    });

    // Verify iframe is still visible
    await expect(iframe).toBeVisible();
  });

  test('iframe should be properly sized for PDF display', async ({ page }) => {
    // Wait for iframe
    const iframe = page.locator('iframe[title="SimplePDF"]');
    await expect(iframe).toBeVisible({ timeout: 20000 });

    // Check PDF container has proper dimensions
    const container = page.locator('.pdf-container');
    const box = await container.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(300);
    expect(box!.height).toBeGreaterThan(200);

    // Check iframe dimensions
    const iframeBox = await iframe.boundingBox();
    expect(iframeBox).not.toBeNull();
    expect(iframeBox!.width).toBeGreaterThan(100);
    expect(iframeBox!.height).toBeGreaterThan(100);

    // Screenshot showing sized iframe
    await page.screenshot({
      path: 'e2e/screenshots/pdf-iframe-sized.png',
      fullPage: true
    });
  });

  test('complete workflow: open page, load test.pdf, verify iframe, screenshot', async ({ page }) => {
    console.log('Starting PDF viewer complete workflow test...');

    // Step 1: Verify page loads with PDF viewer
    const viewer = page.locator('.pdf-viewer');
    await expect(viewer).toBeVisible({ timeout: 15000 });
    console.log('Step 1: PDF viewer container visible');

    // Step 2: Verify SimplePDF iframe is present
    const iframe = page.locator('iframe[title="SimplePDF"]');
    await expect(iframe).toBeVisible({ timeout: 20000 });
    console.log('Step 2: SimplePDF iframe visible');

    // Step 3: Verify iframe has SimplePDF source
    const iframeSrc = await iframe.getAttribute('src');
    expect(iframeSrc).toContain('simplepdf.com');
    console.log('Step 3: Iframe source verified (simplepdf.com)');

    // Step 4: Upload test.pdf file
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles(TEST_PDF_PATH);
    console.log('Step 4: test.pdf file uploaded');

    // Step 5: Wait for PDF processing
    await page.waitForTimeout(5000);
    console.log('Step 5: Waited for PDF processing');

    // Step 6: Verify iframe is still displaying (PDF is in iframe)
    await expect(iframe).toBeVisible();
    console.log('Step 6: Iframe still visible after PDF load');

    // Step 7: Take final screenshot
    await page.screenshot({
      path: 'e2e/screenshots/pdf-workflow-complete.png',
      fullPage: true
    });
    console.log('Step 7: Screenshot saved to e2e/screenshots/pdf-workflow-complete.png');

    console.log('PDF viewer complete workflow test PASSED!');
  });
});
