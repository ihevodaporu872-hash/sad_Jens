import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the real test.dwg file (555 KB) - AC1032 format (AutoCAD 2018)
const TEST_DWG_PATH = path.resolve(__dirname, '../public/test-files/test.dwg');

test.describe('CAD Viewer DWG Loading', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console errors for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[BROWSER ERROR] ${msg.text()}`);
      }
    });

    page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    // Navigate to CAD page
    await page.goto('/cad');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.cad-viewer', { timeout: 30000 });
  });

  test('should display initial viewer state correctly', async ({ page }) => {
    const viewer = page.locator('.cad-viewer');
    await expect(viewer).toBeVisible({ timeout: 15000 });

    // Verify toolbar
    await expect(page.locator('.cad-toolbar')).toBeVisible();
    await expect(page.locator('.cad-toolbar-header h2')).toContainText('CAD Viewer');

    // Verify upload button
    const uploadBtn = page.locator('.file-upload-btn');
    await expect(uploadBtn).toBeVisible();
    await expect(uploadBtn).toContainText('Upload DWG/DXF');

    // Verify file input accepts DWG/DXF
    await expect(page.locator('input[type="file"][accept=".dwg,.dxf"]')).toBeAttached();

    // Verify drop zone and container
    await expect(page.locator('.cad-drop-zone')).toBeVisible();
    await expect(page.locator('.cad-container')).toBeVisible();

    await page.screenshot({
      path: 'e2e/screenshots/cad-dwg-initial.png',
      fullPage: true
    });
  });

  test('should successfully load test.dwg file', async ({ page }) => {
    test.setTimeout(120000);

    // Wait for viewer to initialize
    await expect(page.locator('.cad-viewer')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify worker files are accessible before uploading
    const workerResponse = await page.evaluate(async () => {
      try {
        const resp = await fetch('/assets/libredwg-parser-worker.js', { method: 'HEAD' });
        return { status: resp.status, ok: resp.ok };
      } catch (e) {
        return { status: 0, ok: false, error: String(e) };
      }
    });
    console.log('[TEST] Worker file check:', JSON.stringify(workerResponse));
    expect(workerResponse.ok).toBe(true);

    // Upload the test.dwg file
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles(TEST_DWG_PATH);

    // Wait for loading to complete (either success or error)
    // The loading overlay should disappear
    await page.waitForFunction(() => {
      const overlay = document.querySelector('.cad-overlay:not(.cad-error):not(.cad-empty-state):not(.cad-drag-overlay)');
      return !overlay;
    }, { timeout: 60000 });

    await page.screenshot({
      path: 'e2e/screenshots/cad-dwg-after-upload.png',
      fullPage: true
    });

    // Check if there's an error
    const errorOverlay = page.locator('.cad-overlay.cad-error');
    const hasError = await errorOverlay.isVisible();

    if (hasError) {
      const errorMessage = await page.locator('.cad-error-message').textContent();
      console.log('[TEST] DWG load error:', errorMessage);
    }

    // Document should load successfully - controls hint should be visible
    const controlsHint = page.locator('.cad-controls-hint');
    await expect(controlsHint).toBeVisible({ timeout: 30000 });

    // Verify hints text
    await expect(controlsHint).toContainText('Scroll: Zoom');
    await expect(controlsHint).toContainText('Click + drag: Pan');

    // Verify container has meaningful size
    const container = page.locator('.cad-container');
    const box = await container.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(200);
    expect(box!.height).toBeGreaterThan(200);

    await page.screenshot({
      path: 'e2e/screenshots/cad-dwg-loaded.png',
      fullPage: true
    });
  });

  test('should show all toolbar controls after loading', async ({ page }) => {
    test.setTimeout(120000);

    await expect(page.locator('.cad-viewer')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Upload the test.dwg file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_DWG_PATH);

    // Wait for document to load
    const controlsHint = page.locator('.cad-controls-hint');
    await expect(controlsHint).toBeVisible({ timeout: 60000 });

    // Verify all control buttons
    const expectedButtons = ['Pan', 'Zoom', 'Window', 'Fit', 'Previous', 'Regen'];
    for (const buttonText of expectedButtons) {
      const btn = page.locator('.cad-btn', { hasText: buttonText });
      await expect(btn).toBeVisible();
      await expect(btn).toBeEnabled();
    }

    // Verify file info is shown
    await expect(page.locator('.cad-file-info')).toBeVisible();

    await page.screenshot({
      path: 'e2e/screenshots/cad-dwg-all-controls.png',
      fullPage: true
    });
  });

  test('should test zoom and pan controls', async ({ page }) => {
    test.setTimeout(120000);

    await expect(page.locator('.cad-viewer')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_DWG_PATH);

    await expect(page.locator('.cad-controls-hint')).toBeVisible({ timeout: 60000 });

    // Test Pan
    const panBtn = page.locator('.cad-btn', { hasText: 'Pan' });
    await panBtn.click();
    await page.waitForTimeout(300);

    // Test Zoom
    const zoomBtn = page.locator('.cad-btn', { hasText: 'Zoom' });
    await zoomBtn.click();
    await page.waitForTimeout(300);

    // Test Fit
    const fitBtn = page.locator('.cad-btn', { hasText: 'Fit' });
    await fitBtn.click();
    await page.waitForTimeout(500);

    // Test Regen
    const regenBtn = page.locator('.cad-btn', { hasText: 'Regen' });
    await regenBtn.click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'e2e/screenshots/cad-dwg-controls-tested.png',
      fullPage: true
    });
  });

  test('complete E2E flow with test.dwg', async ({ page }) => {
    test.setTimeout(120000);

    // Collect all console errors during the test
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Step 1: Navigate fresh to avoid singleton conflicts from previous tests
    await page.goto('/cad');
    await page.waitForLoadState('domcontentloaded');

    // Step 1b: Verify initial state
    await expect(page.locator('.cad-viewer')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.file-upload-btn')).toBeVisible();

    // Wait for viewer to fully initialize (empty state or upload button enabled)
    await page.waitForFunction(() => {
      const emptyState = document.querySelector('.cad-empty-state');
      const spinner = document.querySelector('.cad-spinner');
      return emptyState !== null || spinner === null;
    }, { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Dismiss any existing error from previous state
    const dismissBtn = page.locator('.cad-retry-btn');
    if (await dismissBtn.isVisible()) {
      await dismissBtn.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: 'e2e/screenshots/cad-dwg-e2e-step1-initial.png',
      fullPage: true
    });

    // Step 2: Upload test.dwg
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_DWG_PATH);

    // Step 3: Wait for document to load successfully
    const controlsHint = page.locator('.cad-controls-hint');
    await expect(controlsHint).toBeVisible({ timeout: 60000 });

    await page.screenshot({
      path: 'e2e/screenshots/cad-dwg-e2e-step2-loaded.png',
      fullPage: true
    });

    // Step 4: Verify no error overlay
    const errorOverlay = page.locator('.cad-overlay.cad-error');
    await expect(errorOverlay).not.toBeVisible();

    // Step 5: Test all controls
    const panBtn = page.locator('.cad-btn', { hasText: 'Pan' });
    const zoomBtn = page.locator('.cad-btn', { hasText: 'Zoom' });
    const fitBtn = page.locator('.cad-btn', { hasText: 'Fit' });
    const windowBtn = page.locator('.cad-btn', { hasText: 'Window' });
    const previousBtn = page.locator('.cad-btn', { hasText: 'Previous' });
    const regenBtn = page.locator('.cad-btn', { hasText: 'Regen' });

    await panBtn.click();
    await page.waitForTimeout(300);
    await zoomBtn.click();
    await page.waitForTimeout(300);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await windowBtn.click();
    await page.waitForTimeout(300);
    await previousBtn.click();
    await page.waitForTimeout(300);
    await regenBtn.click();
    await page.waitForTimeout(500);
    await fitBtn.click();
    await page.waitForTimeout(500);

    // Verify hints
    await expect(controlsHint).toContainText('Scroll: Zoom');
    await expect(controlsHint).toContainText('Click + drag: Pan');

    await page.screenshot({
      path: 'e2e/screenshots/cad-dwg-e2e-final.png',
      fullPage: true
    });

    // Log any errors that occurred
    if (consoleErrors.length > 0) {
      console.log('[TEST] Console errors during E2E:', consoleErrors);
    }

    console.log('[TEST] E2E test completed successfully - document loaded and all controls tested');
  });
});
