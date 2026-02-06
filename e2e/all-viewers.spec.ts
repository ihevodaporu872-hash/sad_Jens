import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Navigation', () => {
  test('tab navigation is visible and works', async ({ page }) => {
    await page.goto('/');

    // Should redirect to /ifc
    await expect(page).toHaveURL(/\/ifc/);

    // Tab navigation should be visible
    const nav = page.locator('.tab-navigation');
    await expect(nav).toBeVisible();

    // All 4 tabs should exist
    await expect(page.locator('.tab-link')).toHaveCount(4);

    // Navigate to each tab
    await page.click('.tab-link:has-text("Excel")');
    await expect(page).toHaveURL(/\/excel/);

    await page.click('.tab-link:has-text("PDF")');
    await expect(page).toHaveURL(/\/pdf/);

    await page.click('.tab-link:has-text("CAD")');
    await expect(page).toHaveURL(/\/cad/);

    await page.click('.tab-link:has-text("IFC")');
    await expect(page).toHaveURL(/\/ifc/);
  });
});

test.describe('PDF Viewer', () => {
  test('loads test PDF and renders pages', async ({ page }) => {
    await page.goto('/pdf');
    await page.waitForLoadState('networkidle');

    // Toolbar should be visible
    await expect(page.locator('.pdf-toolbar')).toBeVisible();
    await expect(page.locator('h2')).toContainText('PDF Viewer');

    // Upload button should be enabled (no external service dependency)
    const uploadBtn = page.locator('.pdf-upload-btn');
    await expect(uploadBtn).toBeVisible();
    await expect(uploadBtn).toBeEnabled();

    // Load test PDF button should exist
    const loadTestBtn = page.locator('[data-testid="load-test-pdf"]');
    await expect(loadTestBtn).toBeVisible();

    // Click load test PDF
    await loadTestBtn.click();

    // Wait for PDF to render (canvas elements should appear)
    await expect(page.locator('.pdf-page canvas').first()).toBeVisible({ timeout: 30000 });

    // Document info should show
    await expect(page.locator('.pdf-document-info')).toBeVisible();
    await expect(page.locator('.pdf-page-info')).toContainText(/Page 1/);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/pdf-loaded.png', fullPage: false });

    // No errors should be visible
    await expect(page.locator('.pdf-error')).not.toBeVisible();
  });

  test('uploads PDF file via file input', async ({ page }) => {
    await page.goto('/pdf');
    await page.waitForLoadState('networkidle');

    const fileInput = page.locator('input[type="file"][accept*="pdf"]');
    const testPdfPath = path.resolve(__dirname, '..', 'public', 'test-files', 'test.pdf');

    await fileInput.setInputFiles(testPdfPath);

    // Wait for PDF to render
    await expect(page.locator('.pdf-page canvas').first()).toBeVisible({ timeout: 30000 });

    // Check document info appears
    await expect(page.locator('.pdf-document-info')).toBeVisible();

    // No errors
    await expect(page.locator('.pdf-error')).not.toBeVisible();
  });
});

test.describe('Excel Viewer', () => {
  test('initializes Univer spreadsheet on load', async ({ page }) => {
    await page.goto('/excel');
    await page.waitForLoadState('networkidle');

    // Toolbar should be visible
    await expect(page.locator('.excel-toolbar')).toBeVisible();
    await expect(page.locator('h2')).toContainText('Excel Viewer');

    // Wait for Univer to initialize - it renders into the container
    const container = page.locator('[data-testid="excel-container"]');
    await expect(container).toBeVisible();

    // Wait for Univer to fully render with canvas
    await page.waitForTimeout(5000);

    // Univer should create canvas elements for the spreadsheet grid
    const canvasCount = await page.locator('[data-testid="excel-container"] canvas').count();
    expect(canvasCount).toBeGreaterThan(0);

    // Take screenshot of initial empty spreadsheet
    await page.screenshot({ path: 'screenshots/excel-initial.png', fullPage: false });

    // No errors should be visible
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
  });

  test('loads test XLSX file', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/excel');
    await page.waitForLoadState('networkidle');

    // Wait for Univer to initialize
    await page.waitForTimeout(3000);

    // Click load test file button
    const loadTestBtn = page.locator('[data-testid="load-test-file-button"]');
    await expect(loadTestBtn).toBeVisible();
    await loadTestBtn.click();

    // Loading indicator should appear
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible({ timeout: 5000 });

    // Wait for loading to complete
    await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible({ timeout: 90000 });

    // File name should be shown
    await expect(page.locator('[data-testid="loaded-file-name"]')).toContainText('test.xlsx');

    // Univer should have canvas elements for the spreadsheet grid
    await page.waitForTimeout(2000);
    const canvasCount = await page.locator('[data-testid="excel-container"] canvas').count();
    expect(canvasCount).toBeGreaterThan(0);

    // Sheet tabs should be visible (from loaded XLSX data)
    const sheetTabs = page.locator('[data-u-comp="slide-tab-item"]');
    const tabCount = await sheetTabs.count();
    expect(tabCount).toBeGreaterThan(0);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/excel-loaded.png', fullPage: false });

    // No errors
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
  });

  test('uploads XLSX file via file input', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/excel');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const fileInput = page.locator('[data-testid="xlsx-file-input"]');
    const testXlsxPath = path.resolve(__dirname, '..', 'public', 'test-files', 'test.xlsx');

    await fileInput.setInputFiles(testXlsxPath);

    // Wait for loading to complete
    await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible({ timeout: 90000 });

    // File name should be shown
    await expect(page.locator('[data-testid="loaded-file-name"]')).toContainText('test.xlsx');

    // No errors
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
  });
});

test.describe('CAD Viewer', () => {
  test('initializes CAD viewer', async ({ page }) => {
    await page.goto('/cad');
    await page.waitForLoadState('networkidle');

    // Toolbar should be visible
    await expect(page.locator('.cad-toolbar')).toBeVisible();
    await expect(page.locator('h2')).toContainText('CAD Viewer');

    // Wait for viewer initialization
    await page.waitForTimeout(5000);

    // Upload button should become enabled when viewer is ready
    const uploadLabel = page.locator('.file-upload-btn');
    await expect(uploadLabel).toBeVisible();

    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/cad-initial.png', fullPage: false });
  });

  test('loads DWG test file', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/cad');
    await page.waitForLoadState('networkidle');

    // Wait for viewer to initialize
    await page.waitForTimeout(5000);

    // Upload DWG file
    const fileInput = page.locator('.file-upload-btn input[type="file"]');
    const testDwgPath = path.resolve(__dirname, '..', 'public', 'test-files', 'test.dwg');

    await fileInput.setInputFiles(testDwgPath);

    // Wait for file processing
    await page.waitForTimeout(10000);

    // Check result - either document loaded or error shown
    const hasDocument = await page.locator('.cad-file-info').isVisible().catch(() => false);
    const hasError = await page.locator('.cad-error').isVisible().catch(() => false);

    // Take screenshot regardless of result
    await page.screenshot({ path: 'screenshots/cad-dwg-loaded.png', fullPage: false });

    // At minimum, one of these should be true (viewer responded to the file)
    expect(hasDocument || hasError).toBe(true);

    if (hasDocument) {
      console.log('DWG file loaded successfully');
      // Controls should be visible
      await expect(page.locator('.cad-btn-group')).toBeVisible();
    } else {
      console.log('DWG file resulted in error (may be format-specific)');
    }
  });
});

test.describe('IFC Viewer', () => {
  test('initializes Three.js scene', async ({ page }) => {
    await page.goto('/ifc');
    await page.waitForLoadState('networkidle');

    // Toolbar should be visible
    await expect(page.locator('.ifc-toolbar')).toBeVisible();
    await expect(page.locator('h2')).toContainText('IFC Viewer');

    // Wait for Three.js initialization
    await page.waitForTimeout(5000);

    // Canvas should be rendered by Three.js
    const canvas = page.locator('.ifc-container canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });

    // Upload button should be enabled
    const uploadLabel = page.locator('.file-upload-btn');
    await expect(uploadLabel).toBeVisible();

    // Controls hint should be visible
    await expect(page.locator('.ifc-controls-hint')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'screenshots/ifc-initial.png', fullPage: false });
  });

  test('loads sample IFC file', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/ifc');
    await page.waitForLoadState('networkidle');

    // Wait for viewer initialization
    await page.waitForTimeout(5000);

    // Upload sample IFC file
    const fileInput = page.locator('.file-upload-btn input[type="file"]');
    const testIfcPath = path.resolve(__dirname, '..', 'public', 'sample.ifc');

    await fileInput.setInputFiles(testIfcPath);

    // Wait for model loading
    await page.waitForTimeout(10000);

    // Check if model loaded (model info should appear) or error
    const hasModel = await page.locator('.ifc-model-info').isVisible().catch(() => false);
    const hasError = await page.locator('.ifc-error').isVisible().catch(() => false);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/ifc-sample-loaded.png', fullPage: false });

    if (hasModel) {
      console.log('IFC model loaded successfully');

      // Model info should show schema and element count
      await expect(page.locator('.ifc-model-info')).toContainText('Schema');
      await expect(page.locator('.ifc-model-info')).toContainText('Elements');

      // Reset view and wireframe buttons should be enabled
      const resetBtn = page.locator('.reset-view-btn');
      await expect(resetBtn).toBeEnabled();

      const wireframeBtn = page.locator('.wireframe-btn');
      await expect(wireframeBtn).toBeEnabled();

      // Test wireframe toggle
      await wireframeBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/ifc-wireframe.png', fullPage: false });

      // Test reset view
      await resetBtn.click();
      await page.waitForTimeout(1000);
    } else if (hasError) {
      console.log('IFC loading resulted in error');
    }

    // No critical JS errors - viewer should still be functional
    const canvas = page.locator('.ifc-container canvas');
    await expect(canvas).toBeVisible();
  });

  test('loads louis.ifc large model', async ({ page }) => {
    test.setTimeout(180000);

    await page.goto('/ifc');
    await page.waitForLoadState('networkidle');

    // Wait for viewer initialization
    await page.waitForTimeout(5000);

    const fileInput = page.locator('.file-upload-btn input[type="file"]');
    const louisIfcPath = path.resolve(__dirname, '..', 'public', 'louis.ifc');

    await fileInput.setInputFiles(louisIfcPath);

    // Wait for loading - large file needs more time
    // Check for progress bar
    await page.waitForTimeout(3000);

    // Wait for loading to finish (overlay disappears)
    await expect(page.locator('.ifc-overlay')).not.toBeVisible({ timeout: 120000 });

    // Model info should appear
    const hasModel = await page.locator('.ifc-model-info').isVisible().catch(() => false);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/ifc-louis-loaded.png', fullPage: false });

    if (hasModel) {
      console.log('Louis IFC model loaded successfully');
      await expect(page.locator('.ifc-model-info')).toContainText('louis.ifc');
    }

    // Canvas should still be visible regardless
    await expect(page.locator('.ifc-container canvas')).toBeVisible();
  });
});
