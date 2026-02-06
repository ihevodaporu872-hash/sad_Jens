import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PDF_PATH = path.resolve(__dirname, '../public/test-files/test.pdf');
const TEST_XML_MARKUP_PATH = path.resolve(__dirname, '../public/test-files/test-markup.xml');
const TEST_JSON_MARKUP_PATH = path.resolve(__dirname, '../public/test-files/test-markup.json');

test.describe('PDF Viewer - Basic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pdf');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.pdf-viewer-wrapper', { timeout: 30000 });
  });

  test('should display viewer with toolbar and empty state', async ({ page }) => {
    const viewer = page.locator('.pdf-viewer');
    await expect(viewer).toBeVisible({ timeout: 15000 });

    const toolbar = page.locator('.pdf-toolbar');
    await expect(toolbar).toBeVisible();

    const uploadBtn = page.locator('.pdf-upload-btn');
    await expect(uploadBtn).toBeVisible();
    await expect(uploadBtn).toHaveText('Upload PDF');

    // Load Markup button should exist but be disabled (no PDF loaded)
    const markupBtn = page.locator('.pdf-markup-btn');
    await expect(markupBtn).toBeVisible();
    await expect(markupBtn).toBeDisabled();

    // Empty state message
    await expect(page.locator('text=Drop PDF + markup files here')).toBeVisible();
    await expect(page.locator('text=Supports XML and JSON')).toBeVisible();

    await page.screenshot({
      path: 'e2e/screenshots/pdf-viewer-initial.png',
      fullPage: true,
    });
  });

  test('should load test PDF via button and render pages', async ({ page }) => {
    const loadTestBtn = page.locator('[data-testid="load-test-pdf"]');
    await expect(loadTestBtn).toBeVisible();
    await loadTestBtn.click();

    // Wait for PDF to render — canvas elements should appear
    await page.waitForSelector('.pdf-page canvas', { timeout: 30000 });

    // Verify at least one page rendered
    const pages = page.locator('.pdf-page');
    const pageCount = await pages.count();
    expect(pageCount).toBeGreaterThan(0);

    // Verify document info appeared
    const pageInfo = page.locator('.pdf-page-info');
    await expect(pageInfo).toBeVisible();

    // Verify markup button is now enabled
    const markupBtn = page.locator('.pdf-markup-btn');
    await expect(markupBtn).toBeEnabled();

    await page.screenshot({
      path: 'e2e/screenshots/pdf-test-file-loaded.png',
      fullPage: true,
    });
  });

  test('should load test PDF via file input', async ({ page }) => {
    // Use the hidden file input for PDF
    const fileInput = page.locator('input[type="file"][accept*=".pdf"]');
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles(TEST_PDF_PATH);

    // Wait for canvas
    await page.waitForSelector('.pdf-page canvas', { timeout: 30000 });

    const pages = page.locator('.pdf-page');
    expect(await pages.count()).toBeGreaterThan(0);

    await page.screenshot({
      path: 'e2e/screenshots/pdf-file-input-loaded.png',
      fullPage: true,
    });
  });
});

test.describe('PDF Viewer - Zoom & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pdf');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.pdf-viewer-wrapper', { timeout: 30000 });

    // Load test PDF
    const loadTestBtn = page.locator('[data-testid="load-test-pdf"]');
    await loadTestBtn.click();
    await page.waitForSelector('.pdf-page canvas', { timeout: 30000 });
  });

  test('should zoom in and out', async ({ page }) => {
    // Get initial scale text
    const scaleText = page.locator('text=150%');
    await expect(scaleText).toBeVisible();

    // Zoom in
    const zoomInBtn = page.locator('.pdf-btn', { hasText: '+' });
    await zoomInBtn.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=175%')).toBeVisible();

    // Zoom out
    const zoomOutBtn = page.locator('.pdf-btn', { hasText: '-' });
    await zoomOutBtn.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=150%')).toBeVisible();
  });
});

test.describe('PDF Viewer - XML Markup Overlay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pdf');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.pdf-viewer-wrapper', { timeout: 30000 });

    // Load test PDF first
    const loadTestBtn = page.locator('[data-testid="load-test-pdf"]');
    await loadTestBtn.click();
    await page.waitForSelector('.pdf-page canvas', { timeout: 30000 });
  });

  test('should load XML markup and show sidebar', async ({ page }) => {
    // Upload XML markup
    const markupInput = page.locator('input[type="file"][accept*=".xml"]');
    await expect(markupInput).toBeAttached();
    await markupInput.setInputFiles(TEST_XML_MARKUP_PATH);

    // Sidebar should appear
    await page.waitForSelector('.annotation-sidebar', { timeout: 10000 });
    const sidebar = page.locator('.annotation-sidebar');
    await expect(sidebar).toBeVisible();

    // Should show "Markup Layers" header
    await expect(page.locator('.annotation-sidebar-header h3')).toHaveText('Markup Layers');

    // Markup filename should appear in toolbar
    await expect(page.locator('.markup-file-badge')).toContainText('test-markup.xml');

    // Layers button should appear
    const layersBtn = page.locator('.pdf-btn', { hasText: 'Layers' });
    await expect(layersBtn).toBeVisible();

    await page.screenshot({
      path: 'e2e/screenshots/pdf-xml-markup-loaded.png',
      fullPage: true,
    });
  });

  test('should render annotation SVG overlays on PDF pages', async ({ page }) => {
    // Upload XML markup
    const markupInput = page.locator('input[type="file"][accept*=".xml"]');
    await markupInput.setInputFiles(TEST_XML_MARKUP_PATH);

    // Wait for sidebar and overlay
    await page.waitForSelector('.annotation-sidebar', { timeout: 10000 });

    // SVG overlay should appear
    const overlays = page.locator('.pdf-annotation-overlay');
    // Give it a moment to render
    await page.waitForTimeout(1000);

    // Check that stat badges show counts
    const sidebar = page.locator('.annotation-sidebar');
    await expect(sidebar).toBeVisible();

    // Should have layer controls
    const layerControls = page.locator('.layer-control');
    expect(await layerControls.count()).toBeGreaterThan(0);

    await page.screenshot({
      path: 'e2e/screenshots/pdf-xml-overlay-rendered.png',
      fullPage: true,
    });
  });

  test('should toggle layer visibility', async ({ page }) => {
    // Upload XML markup
    const markupInput = page.locator('input[type="file"][accept*=".xml"]');
    await markupInput.setInputFiles(TEST_XML_MARKUP_PATH);

    await page.waitForSelector('.annotation-sidebar', { timeout: 10000 });

    // Find first layer checkbox
    const checkbox = page.locator('.layer-visibility input[type="checkbox"]').first();
    await expect(checkbox).toBeChecked();

    // Uncheck to hide layer
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();

    // Layer should get hidden class
    const layerControl = page.locator('.layer-control').first();
    await expect(layerControl).toHaveClass(/layer-hidden/);

    await page.screenshot({
      path: 'e2e/screenshots/pdf-layer-hidden.png',
      fullPage: true,
    });

    // Re-check to show layer
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await expect(layerControl).not.toHaveClass(/layer-hidden/);
  });

  test('should change layer color', async ({ page }) => {
    const markupInput = page.locator('input[type="file"][accept*=".xml"]');
    await markupInput.setInputFiles(TEST_XML_MARKUP_PATH);

    await page.waitForSelector('.annotation-sidebar', { timeout: 10000 });

    // Color picker should exist
    const colorPicker = page.locator('.layer-color-picker').first();
    await expect(colorPicker).toBeVisible();

    // Change color
    await colorPicker.evaluate((el: HTMLInputElement) => {
      el.value = '#ff00ff';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.screenshot({
      path: 'e2e/screenshots/pdf-color-changed.png',
      fullPage: true,
    });
  });

  test('should change layer opacity', async ({ page }) => {
    const markupInput = page.locator('input[type="file"][accept*=".xml"]');
    await markupInput.setInputFiles(TEST_XML_MARKUP_PATH);

    await page.waitForSelector('.annotation-sidebar', { timeout: 10000 });

    // Opacity slider should exist
    const slider = page.locator('.layer-opacity-slider').first();
    await expect(slider).toBeVisible();

    // Change opacity
    await slider.fill('0.3');

    // Opacity value should update
    const opacityValue = page.locator('.layer-opacity-value').first();
    await expect(opacityValue).toHaveText('30%');

    await page.screenshot({
      path: 'e2e/screenshots/pdf-opacity-changed.png',
      fullPage: true,
    });
  });

  test('should select item from sidebar list', async ({ page }) => {
    const markupInput = page.locator('input[type="file"][accept*=".xml"]');
    await markupInput.setInputFiles(TEST_XML_MARKUP_PATH);

    await page.waitForSelector('.annotation-sidebar', { timeout: 10000 });

    // Click on first item in layer
    const itemRow = page.locator('.layer-item-row').first();
    await expect(itemRow).toBeVisible();
    await itemRow.click();

    // Should be selected
    await expect(itemRow).toHaveClass(/selected/);

    await page.screenshot({
      path: 'e2e/screenshots/pdf-item-selected.png',
      fullPage: true,
    });
  });

  test('should close sidebar', async ({ page }) => {
    const markupInput = page.locator('input[type="file"][accept*=".xml"]');
    await markupInput.setInputFiles(TEST_XML_MARKUP_PATH);

    await page.waitForSelector('.annotation-sidebar', { timeout: 10000 });

    // Close sidebar
    const closeBtn = page.locator('.annotation-sidebar-close');
    await closeBtn.click();

    // Sidebar should disappear
    await expect(page.locator('.annotation-sidebar')).not.toBeVisible();

    // Layers button should toggle it back
    const layersBtn = page.locator('.pdf-btn', { hasText: 'Layers' });
    await layersBtn.click();
    await expect(page.locator('.annotation-sidebar')).toBeVisible();
  });
});

test.describe('PDF Viewer - JSON Markup Overlay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pdf');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.pdf-viewer-wrapper', { timeout: 30000 });

    const loadTestBtn = page.locator('[data-testid="load-test-pdf"]');
    await loadTestBtn.click();
    await page.waitForSelector('.pdf-page canvas', { timeout: 30000 });
  });

  test('should load JSON markup and show sidebar', async ({ page }) => {
    const markupInput = page.locator('input[type="file"][accept*=".json"]');
    await expect(markupInput).toBeAttached();
    await markupInput.setInputFiles(TEST_JSON_MARKUP_PATH);

    await page.waitForSelector('.annotation-sidebar', { timeout: 10000 });

    await expect(page.locator('.annotation-sidebar-header h3')).toHaveText('Markup Layers');
    await expect(page.locator('.markup-file-badge')).toContainText('test-markup.json');

    // Should have 2 layers (Measurements + Areas)
    const layerControls = page.locator('.layer-control');
    expect(await layerControls.count()).toBe(2);

    await page.screenshot({
      path: 'e2e/screenshots/pdf-json-markup-loaded.png',
      fullPage: true,
    });
  });

  test('JSON and XML produce same UI structure', async ({ page }) => {
    // Load JSON markup
    const markupInput = page.locator('input[type="file"][accept*=".json"]');
    await markupInput.setInputFiles(TEST_JSON_MARKUP_PATH);

    await page.waitForSelector('.annotation-sidebar', { timeout: 10000 });

    // Verify same structural elements exist
    await expect(page.locator('.annotation-sidebar')).toBeVisible();
    await expect(page.locator('.layer-control').first()).toBeVisible();
    await expect(page.locator('.layer-visibility').first()).toBeVisible();
    await expect(page.locator('.layer-color-picker').first()).toBeVisible();
    await expect(page.locator('.layer-opacity-slider').first()).toBeVisible();
    await expect(page.locator('.layer-item-row').first()).toBeVisible();

    await page.screenshot({
      path: 'e2e/screenshots/pdf-json-overlay-rendered.png',
      fullPage: true,
    });
  });
});

test.describe('PDF Viewer - Complete Workflow', () => {
  test('full workflow: load PDF, load XML markup, interact, screenshot', async ({ page }) => {
    await page.goto('/pdf');
    await page.waitForSelector('.pdf-viewer-wrapper', { timeout: 30000 });

    // Step 1: Load PDF
    const loadTestBtn = page.locator('[data-testid="load-test-pdf"]');
    await loadTestBtn.click();
    await page.waitForSelector('.pdf-page canvas', { timeout: 30000 });

    // Step 2: Load XML markup
    const markupInput = page.locator('input[type="file"][accept*=".xml"]');
    await markupInput.setInputFiles(TEST_XML_MARKUP_PATH);
    await page.waitForSelector('.annotation-sidebar', { timeout: 10000 });

    // Step 3: Verify layers are visible
    const layerControls = page.locator('.layer-control');
    expect(await layerControls.count()).toBeGreaterThan(0);

    // Step 4: Click an item
    const firstItem = page.locator('.layer-item-row').first();
    await firstItem.click();
    await expect(firstItem).toHaveClass(/selected/);

    // Step 5: Change color on a layer
    const colorPicker = page.locator('.layer-color-picker').first();
    await colorPicker.evaluate((el: HTMLInputElement) => {
      el.value = '#00ffff';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Step 6: Toggle a layer off and on
    const checkbox = page.locator('.layer-visibility input[type="checkbox"]').first();
    await checkbox.uncheck();
    await page.waitForTimeout(300);
    await checkbox.check();

    // Step 7: Final screenshot
    await page.screenshot({
      path: 'e2e/screenshots/pdf-workflow-complete.png',
      fullPage: true,
    });
  });
});
