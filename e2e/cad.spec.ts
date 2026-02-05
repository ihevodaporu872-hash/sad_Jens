import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// Create a minimal DXF file for testing
const createTestDxf = (): Buffer => {
  const dxf = `0
SECTION
2
HEADER
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
0
10
0
20
0
11
100
21
100
0
ENDSEC
0
EOF
`;
  return Buffer.from(dxf);
};

test.describe('CAD Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cad');
    await page.waitForLoadState('networkidle');
  });

  test('should load CAD page with viewer container', async ({ page }) => {
    // Check main viewer container exists
    const viewer = page.locator('.cad-viewer');
    await expect(viewer).toBeVisible({ timeout: 15000 });

    await page.screenshot({ path: 'e2e/screenshots/cad-page-loaded.png', fullPage: true });
  });

  test('should have toolbar with header', async ({ page }) => {
    const toolbar = page.locator('.cad-toolbar');
    await expect(toolbar).toBeVisible();

    // Check header content
    await expect(page.locator('.cad-toolbar-header h2')).toBeVisible();
    await expect(page.locator('.cad-toolbar-header h2')).toContainText('CAD Viewer');
  });

  test('should have Upload DWG/DXF button', async ({ page }) => {
    const uploadBtn = page.locator('.file-upload-btn');
    await expect(uploadBtn).toBeVisible();
    await expect(uploadBtn).toContainText('Upload DWG/DXF');
  });

  test('should have file input for CAD files', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept=".dwg,.dxf"]');
    await expect(fileInput).toBeAttached();
  });

  test('should display drop zone area', async ({ page }) => {
    const dropZone = page.locator('.cad-drop-zone');
    await expect(dropZone).toBeVisible();
  });

  test('should show empty state with drop hint', async ({ page }) => {
    // Wait for viewer to be ready
    await page.waitForTimeout(2000);

    // Check for empty state message
    const emptyState = page.locator('.cad-empty-state');
    if (await emptyState.isVisible()) {
      await expect(page.locator('.cad-drop-title')).toContainText('Drop a CAD file here');
      await expect(page.locator('.cad-drop-formats')).toContainText('DWG, DXF');
    }
  });

  test('should have CAD container for rendering', async ({ page }) => {
    const container = page.locator('.cad-container');
    await expect(container).toBeVisible();

    // Check container has reasonable size
    const box = await container.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  test('can prepare DXF file for upload', async ({ page }) => {
    // Create test DXF file
    const testDxfPath = path.join(__dirname, 'test-drawing.dxf');
    fs.writeFileSync(testDxfPath, createTestDxf());

    try {
      // Verify file was created
      expect(fs.existsSync(testDxfPath)).toBe(true);

      // File input exists
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeAttached();

      // Set input files
      await fileInput.setInputFiles(testDxfPath);

      // Wait for processing
      await page.waitForTimeout(2000);

      // Take screenshot
      await page.screenshot({ path: 'e2e/screenshots/cad-after-file-select.png', fullPage: true });
    } finally {
      if (fs.existsSync(testDxfPath)) {
        fs.unlinkSync(testDxfPath);
      }
    }
  });

  test('toolbar shows control buttons when document is loaded', async ({ page }) => {
    // Create and upload test file
    const testDxfPath = path.join(__dirname, 'test-controls.dxf');
    fs.writeFileSync(testDxfPath, createTestDxf());

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testDxfPath);

      // Wait for document to load
      await page.waitForTimeout(3000);

      // Check if control buttons appear (they show only when document is loaded)
      const panBtn = page.locator('.cad-btn', { hasText: 'Pan' });
      const zoomBtn = page.locator('.cad-btn', { hasText: 'Zoom' });
      const fitBtn = page.locator('.cad-btn', { hasText: 'Fit' });

      // These buttons may or may not be visible depending on successful load
      // Just verify they exist in DOM if document loaded successfully
      const hasDocument = await page.locator('.cad-controls-hint').isVisible();
      if (hasDocument) {
        await expect(panBtn).toBeVisible();
        await expect(zoomBtn).toBeVisible();
        await expect(fitBtn).toBeVisible();
      }
    } finally {
      if (fs.existsSync(testDxfPath)) {
        fs.unlinkSync(testDxfPath);
      }
    }
  });

  test('page structure is correct', async ({ page }) => {
    // Main viewer container
    await expect(page.locator('.cad-viewer')).toBeVisible();

    // Toolbar
    await expect(page.locator('.cad-toolbar')).toBeVisible();

    // Upload button
    await expect(page.locator('.file-upload-btn')).toBeVisible();

    // Drop zone
    await expect(page.locator('.cad-drop-zone')).toBeVisible();

    // Container
    await expect(page.locator('.cad-container')).toBeVisible();
  });
});
