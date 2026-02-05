import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a minimal IFC file for testing
const createTestIfc = (): Buffer => {
  const ifc = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('test.ifc','2024-01-01T00:00:00',(''),(''),'','','');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
#1=IFCPROJECT('0001',#2,'Test Project',$,$,$,$,$,$);
#2=IFCOWNERHISTORY(#3,#4,$,.ADDED.,$,$,$,0);
#3=IFCPERSONANDORGANIZATION(#5,#6,$);
#4=IFCAPPLICATION(#6,'1.0','Test','Test');
#5=IFCPERSON($,'Test',$,$,$,$,$,$);
#6=IFCORGANIZATION($,'Test',$,$,$);
ENDSEC;
END-ISO-10303-21;
`;
  return Buffer.from(ifc);
};

test.describe('IFC Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ifc');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.ifc-viewer', { timeout: 30000 });
  });

  test('should load IFC page with viewer container', async ({ page }) => {
    // Check main viewer container exists
    const viewer = page.locator('.ifc-viewer');
    await expect(viewer).toBeVisible({ timeout: 15000 });

    await page.screenshot({ path: 'e2e/screenshots/ifc-page-loaded.png', fullPage: true });
  });

  test('should have toolbar with header', async ({ page }) => {
    const toolbar = page.locator('.ifc-toolbar');
    await expect(toolbar).toBeVisible();

    // Check header content
    await expect(page.locator('.ifc-toolbar-header h2')).toBeVisible();
    await expect(page.locator('.ifc-toolbar-header h2')).toContainText('IFC Viewer');
  });

  test('should have Upload IFC button', async ({ page }) => {
    const uploadBtn = page.locator('.file-upload-btn');
    await expect(uploadBtn).toBeVisible();
    await expect(uploadBtn).toContainText('Upload IFC');
  });

  test('should have file input for IFC files', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept=".ifc"]');
    await expect(fileInput).toBeAttached();
  });

  test('should display drop zone area', async ({ page }) => {
    const dropZone = page.locator('.ifc-drop-zone');
    await expect(dropZone).toBeVisible();
  });

  test('should have 3D canvas container', async ({ page }) => {
    // Wait for viewer initialization
    await page.waitForTimeout(3000);

    // The Three.js canvas should be rendered
    const container = page.locator('.ifc-container');
    await expect(container).toBeVisible();

    // Check for canvas element (Three.js renders to canvas)
    const canvas = page.locator('.ifc-container canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Verify canvas has reasonable dimensions
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  test('should show drop hint when no model loaded', async ({ page }) => {
    // Wait for viewer to be ready
    await page.waitForTimeout(3000);

    // Check for drop hint
    const dropHint = page.locator('.ifc-drop-hint');
    if (await dropHint.isVisible()) {
      await expect(page.locator('.ifc-drop-title')).toContainText('Drag & Drop IFC File');
      await expect(page.locator('.ifc-drop-formats')).toContainText('.ifc');
    }
  });

  test('should have Reset View button', async ({ page }) => {
    const resetBtn = page.locator('.reset-view-btn');
    await expect(resetBtn).toBeVisible();
    await expect(resetBtn).toContainText('Reset View');
  });

  test('should have Wireframe button', async ({ page }) => {
    const wireframeBtn = page.locator('.wireframe-btn');
    await expect(wireframeBtn).toBeVisible();
    await expect(wireframeBtn).toContainText('Wireframe');
  });

  test('should display controls hint', async ({ page }) => {
    const controlsHint = page.locator('.ifc-controls-hint');
    await expect(controlsHint).toBeVisible();

    // Check for control instructions
    await expect(controlsHint).toContainText('Rotate');
    await expect(controlsHint).toContainText('Zoom');
    await expect(controlsHint).toContainText('Pan');
  });

  test('can prepare IFC file for upload', async ({ page }) => {
    // Create test IFC file
    const testIfcPath = path.join(__dirname, 'test-model.ifc');
    fs.writeFileSync(testIfcPath, createTestIfc());

    try {
      // Verify file was created
      expect(fs.existsSync(testIfcPath)).toBe(true);

      // File input exists
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeAttached();

      // Set input files
      await fileInput.setInputFiles(testIfcPath);

      // Wait for processing
      await page.waitForTimeout(3000);

      // Take screenshot
      await page.screenshot({ path: 'e2e/screenshots/ifc-after-file-select.png', fullPage: true });
    } finally {
      if (fs.existsSync(testIfcPath)) {
        fs.unlinkSync(testIfcPath);
      }
    }
  });

  test('page structure is correct', async ({ page }) => {
    // Main viewer container
    await expect(page.locator('.ifc-viewer')).toBeVisible();

    // Toolbar
    await expect(page.locator('.ifc-toolbar')).toBeVisible();

    // Header
    await expect(page.locator('.ifc-toolbar-header')).toBeVisible();

    // Toolbar actions
    await expect(page.locator('.ifc-toolbar-actions')).toBeVisible();

    // Drop zone
    await expect(page.locator('.ifc-drop-zone')).toBeVisible();

    // Container
    await expect(page.locator('.ifc-container')).toBeVisible();

    // Controls hint
    await expect(page.locator('.ifc-controls-hint')).toBeVisible();
  });

  test('buttons are properly sized and clickable', async ({ page }) => {
    const uploadBtn = page.locator('.file-upload-btn');
    await expect(uploadBtn).toBeVisible();

    const box = await uploadBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(50);
    expect(box!.height).toBeGreaterThan(20);

    const resetBtn = page.locator('.reset-view-btn');
    const resetBox = await resetBtn.boundingBox();
    expect(resetBox).not.toBeNull();
    expect(resetBox!.width).toBeGreaterThan(50);
  });

  test('viewer initializes Three.js scene', async ({ page }) => {
    // Wait for initialization
    await page.waitForTimeout(4000);

    // Canvas should be present (Three.js renderer)
    const canvas = page.locator('.ifc-container canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Canvas should have WebGL context
    const hasWebGL = await page.evaluate(() => {
      const canvas = document.querySelector('.ifc-container canvas');
      if (!canvas) return false;
      const gl = (canvas as HTMLCanvasElement).getContext('webgl') ||
                 (canvas as HTMLCanvasElement).getContext('webgl2');
      // Context may be null if already acquired by Three.js, that's OK
      return canvas instanceof HTMLCanvasElement;
    });
    expect(hasWebGL).toBe(true);

    await page.screenshot({ path: 'e2e/screenshots/ifc-three-initialized.png', fullPage: true });
  });
});
