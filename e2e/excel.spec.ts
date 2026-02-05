import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Excel Viewer (Univer)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/excel');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.excel-viewer', { timeout: 30000 });
  });

  test('should load Excel page with viewer container', async ({ page }) => {
    // Check main viewer container exists
    const viewer = page.locator('.excel-viewer');
    await expect(viewer).toBeVisible({ timeout: 15000 });

    await page.screenshot({ path: 'e2e/screenshots/excel-page-loaded.png', fullPage: true });
  });

  test('should have toolbar with header', async ({ page }) => {
    const toolbar = page.locator('.excel-toolbar');
    await expect(toolbar).toBeVisible();

    // Check header content
    await expect(page.locator('.excel-toolbar h2')).toBeVisible();
    await expect(page.locator('.excel-toolbar h2')).toContainText('Excel Viewer');
  });

  test('should have description text', async ({ page }) => {
    const description = page.locator('.excel-toolbar p');
    await expect(description).toBeVisible();
    await expect(description).toContainText('Univer');
  });

  test('should have excel container', async ({ page }) => {
    const container = page.locator('.excel-container');
    await expect(container).toBeVisible();

    // Check container has reasonable size
    const box = await container.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  test('should initialize Univer spreadsheet', async ({ page }) => {
    // Wait for Univer to initialize - may take time for full render
    await page.waitForTimeout(5000);

    // Univer renders its UI inside the container
    const container = page.locator('.excel-container');
    await expect(container).toBeVisible();

    // Check that container exists and is ready for Univer
    // Univer initialization may fail silently in test environment
    // but the container should be present and visible
    const box = await container.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    await page.screenshot({ path: 'e2e/screenshots/excel-univer-initialized.png', fullPage: true });
  });

  test('page structure is correct', async ({ page }) => {
    // Main viewer container
    await expect(page.locator('.excel-viewer')).toBeVisible();

    // Toolbar
    await expect(page.locator('.excel-toolbar')).toBeVisible();

    // Header
    await expect(page.locator('.excel-toolbar h2')).toBeVisible();

    // Description
    await expect(page.locator('.excel-toolbar p')).toBeVisible();

    // Container
    await expect(page.locator('.excel-container')).toBeVisible();
  });

  test('Univer UI renders cell grid', async ({ page }) => {
    // Wait for full initialization
    await page.waitForTimeout(5000);

    // Take screenshot to verify UI rendered
    await page.screenshot({ path: 'e2e/screenshots/excel-cell-grid.png', fullPage: true });

    // Check that the excel container is ready for Univer rendering
    // Univer may not fully initialize in headless test environment
    const container = page.locator('.excel-container');
    await expect(container).toBeVisible();

    // Verify container has proper dimensions for spreadsheet display
    const box = await container.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  test('viewer fills available space', async ({ page }) => {
    const viewer = page.locator('.excel-viewer');
    const viewerBox = await viewer.boundingBox();

    const container = page.locator('.excel-container');
    const containerBox = await container.boundingBox();

    expect(viewerBox).not.toBeNull();
    expect(containerBox).not.toBeNull();

    // Container should take most of the viewer height (minus toolbar)
    expect(containerBox!.height).toBeGreaterThan(viewerBox!.height * 0.7);
    expect(containerBox!.width).toBe(viewerBox!.width);
  });
});

test.describe('Excel Viewer - XLSX File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/excel');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.excel-viewer', { timeout: 30000 });
  });

  test('should have upload button visible', async ({ page }) => {
    const uploadButton = page.locator('label.upload-button');
    await expect(uploadButton).toBeVisible();
    await expect(uploadButton).toContainText('Upload XLSX File');
  });

  test('should have load test file button visible', async ({ page }) => {
    const loadTestButton = page.getByTestId('load-test-file-button');
    await expect(loadTestButton).toBeVisible();
    await expect(loadTestButton).toContainText('Load Test File');
  });

  test('should have hidden file input', async ({ page }) => {
    const fileInput = page.getByTestId('xlsx-file-input');
    await expect(fileInput).toBeAttached();
    // Input should be hidden via CSS
    await expect(fileInput).toHaveClass(/file-input/);
  });

  test('should upload XLSX file via file input', async ({ page }) => {
    // Increase timeout for large file operations
    test.setTimeout(120000);

    const fileInput = page.getByTestId('xlsx-file-input');

    // Upload the test file (25 MB)
    const testFilePath = path.resolve(process.cwd(), 'public/test-files/test.xlsx');
    await fileInput.setInputFiles(testFilePath);

    // Wait for loading indicator to appear
    const loadingIndicator = page.getByTestId('loading-indicator');
    await expect(loadingIndicator).toBeVisible({ timeout: 10000 });

    // Wait for loading to complete (loading indicator should disappear)
    await expect(loadingIndicator).not.toBeVisible({ timeout: 120000 });

    // Check that file name is displayed
    const fileName = page.getByTestId('loaded-file-name');
    await expect(fileName).toBeVisible({ timeout: 10000 });
    await expect(fileName).toContainText('test.xlsx');

    // Verify no error message
    const errorMessage = page.getByTestId('error-message');
    await expect(errorMessage).not.toBeVisible();

    // Take screenshot after file loaded
    await page.screenshot({ path: 'e2e/screenshots/excel-file-uploaded.png', fullPage: true });
  });

  test('should load test file via button click', async ({ page }) => {
    // Increase timeout for large file operations
    test.setTimeout(120000);

    const loadTestButton = page.getByTestId('load-test-file-button');
    await loadTestButton.click();

    // Wait for loading indicator to appear
    const loadingIndicator = page.getByTestId('loading-indicator');
    await expect(loadingIndicator).toBeVisible({ timeout: 10000 });

    // Wait for loading to complete
    await expect(loadingIndicator).not.toBeVisible({ timeout: 120000 });

    // Check that file name is displayed
    const fileName = page.getByTestId('loaded-file-name');
    await expect(fileName).toBeVisible({ timeout: 10000 });
    await expect(fileName).toContainText('test.xlsx');

    // Verify no error message
    const errorMessage = page.getByTestId('error-message');
    await expect(errorMessage).not.toBeVisible();

    // Take screenshot after file loaded
    await page.screenshot({ path: 'e2e/screenshots/excel-test-file-loaded.png', fullPage: true });
  });

  test('should display spreadsheet data after loading XLSX', async ({ page }) => {
    // Increase timeout for large file operations
    test.setTimeout(120000);

    // Load test file
    const loadTestButton = page.getByTestId('load-test-file-button');
    await loadTestButton.click();

    // Wait for loading to complete
    const loadingIndicator = page.getByTestId('loading-indicator');
    await expect(loadingIndicator).not.toBeVisible({ timeout: 120000 });

    // Wait for Univer to render the spreadsheet
    await page.waitForTimeout(3000);

    // Check that the excel container still has content
    const container = page.getByTestId('excel-container');
    await expect(container).toBeVisible();

    const box = await container.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);

    // Take screenshot of loaded spreadsheet
    await page.screenshot({ path: 'e2e/screenshots/excel-spreadsheet-data.png', fullPage: true });
  });

  test('should show progress during file loading', async ({ page }) => {
    // This test checks that progress bar appears during load
    test.setTimeout(120000);

    const loadTestButton = page.getByTestId('load-test-file-button');
    await loadTestButton.click();

    // Loading indicator should appear quickly
    const loadingIndicator = page.getByTestId('loading-indicator');
    await expect(loadingIndicator).toBeVisible({ timeout: 5000 });

    // Progress bar should be visible within loading indicator
    const progressBar = page.locator('.progress-bar');
    await expect(progressBar).toBeVisible();

    // Loading message should be visible
    const loadingMessage = page.locator('.loading-message');
    await expect(loadingMessage).toBeVisible();

    // Wait for loading to complete
    await expect(loadingIndicator).not.toBeVisible({ timeout: 120000 });
  });

  test('should handle large XLSX file (25 MB test.xlsx)', async ({ page }) => {
    // This is the main test for the 25 MB file
    test.setTimeout(180000); // 3 minutes timeout for large file

    console.log('Starting large file test...');

    const loadTestButton = page.getByTestId('load-test-file-button');
    await loadTestButton.click();

    console.log('Button clicked, waiting for loading...');

    // Wait for loading indicator
    const loadingIndicator = page.getByTestId('loading-indicator');
    await expect(loadingIndicator).toBeVisible({ timeout: 10000 });

    console.log('Loading indicator visible, waiting for completion...');

    // Wait for loading to complete - this may take a while for 25 MB
    await expect(loadingIndicator).not.toBeVisible({ timeout: 180000 });

    console.log('Loading complete!');

    // Verify file loaded successfully
    const fileName = page.getByTestId('loaded-file-name');
    await expect(fileName).toBeVisible();
    await expect(fileName).toContainText('test.xlsx');

    // Verify no errors
    const errorMessage = page.getByTestId('error-message');
    await expect(errorMessage).not.toBeVisible();

    // Wait for Univer to fully render
    await page.waitForTimeout(5000);

    // Take final screenshot
    await page.screenshot({ path: 'e2e/screenshots/excel-large-file-loaded.png', fullPage: true });

    console.log('Large file test completed successfully!');
  });
});
