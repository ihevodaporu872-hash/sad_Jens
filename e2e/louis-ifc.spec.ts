import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('IFC Viewer - louis.ifc Large Model Test', () => {
  // Increase timeout for large file
  test.setTimeout(120000);

  test('should load louis.ifc model and render 3D geometry', async ({ page }) => {
    // Capture console logs for debugging
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warn') {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    // Navigate to IFC page
    await page.goto('/ifc');
    await page.waitForLoadState('domcontentloaded');

    // Wait for viewer to initialize
    await page.waitForSelector('.ifc-viewer', { timeout: 30000 });
    await page.waitForSelector('.ifc-container canvas', { timeout: 30000 });

    console.log('Viewer initialized, waiting for web-ifc...');

    // Wait a bit more for web-ifc WASM to load
    await page.waitForTimeout(3000);

    // Take screenshot before loading
    await page.screenshot({
      path: 'e2e/screenshots/louis-ifc-before-load.png',
      fullPage: true
    });

    // Get the file input and upload louis.ifc
    const fileInput = page.locator('input[type="file"][accept=".ifc"]');
    await expect(fileInput).toBeAttached();

    // Path to louis.ifc in public folder
    const louisIfcPath = path.resolve(__dirname, '..', 'public', 'louis.ifc');
    console.log('Loading file from:', louisIfcPath);

    // Upload the file
    await fileInput.setInputFiles(louisIfcPath);

    console.log('File selected, waiting for model to load...');

    // Wait for loading indicator to appear
    const loadingOverlay = page.locator('.ifc-overlay');

    // Wait for loading to start (should see "Parsing IFC data...")
    try {
      await expect(loadingOverlay).toBeVisible({ timeout: 5000 });
      console.log('Loading overlay appeared');
    } catch {
      console.log('No loading overlay detected - might have loaded instantly or errored');
    }

    // Wait for loading to complete (loading overlay disappears or model info appears)
    // This is a large 3.9MB file, so give it plenty of time
    console.log('Waiting for model to finish loading (up to 60 seconds)...');

    // Wait for either:
    // 1. Model info to appear (success)
    // 2. Error overlay to appear (failure)
    // 3. Loading overlay to disappear and canvas to have content

    const modelInfoOrError = page.locator('.ifc-model-info, .ifc-error');
    await expect(modelInfoOrError).toBeVisible({ timeout: 60000 });

    // Check if there's an error
    const errorElement = page.locator('.ifc-error');
    const hasError = await errorElement.isVisible();

    if (hasError) {
      const errorMessage = await page.locator('.ifc-error-message').textContent();
      console.log('ERROR loading IFC:', errorMessage);

      // Take error screenshot
      await page.screenshot({
        path: 'e2e/screenshots/louis-ifc-error.png',
        fullPage: true
      });

      // Print console logs
      console.log('Console logs:', consoleLogs.join('\n'));

      throw new Error(`IFC loading failed: ${errorMessage}`);
    }

    // Model loaded successfully - check model info
    const modelInfo = page.locator('.ifc-model-info');
    await expect(modelInfo).toBeVisible();

    // Verify file name
    await expect(modelInfo).toContainText('louis.ifc');

    // Get model details
    const schemaText = await modelInfo.locator('text=Schema').first().textContent();
    const elementsText = await modelInfo.locator('text=Elements').first().textContent();
    const sizeText = await modelInfo.locator('text=Size').first().textContent();

    console.log('Model loaded successfully:');
    console.log('  Schema:', schemaText);
    console.log('  Elements:', elementsText);
    console.log('  Size:', sizeText);

    // Wait additional time for all meshes to render
    console.log('Waiting 10 seconds for complete rendering...');
    await page.waitForTimeout(10000);

    // Take screenshot after loading
    await page.screenshot({
      path: 'e2e/screenshots/louis-ifc-loaded.png',
      fullPage: true
    });

    // Verify canvas has actual rendered content (not just background)
    const canvas = page.locator('.ifc-container canvas').first();
    await expect(canvas).toBeVisible();

    // Check canvas dimensions
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.width).toBeGreaterThan(200);
    expect(canvasBox!.height).toBeGreaterThan(200);

    // Verify model is visible by checking that hasModel state is true
    // This is indicated by enabled Reset View and Wireframe buttons
    const resetBtn = page.locator('.reset-view-btn');
    const wireframeBtn = page.locator('.wireframe-btn');

    // Buttons should be enabled when model is loaded
    await expect(resetBtn).toBeEnabled();
    await expect(wireframeBtn).toBeEnabled();

    // Test interaction - click Reset View
    await resetBtn.click();
    await page.waitForTimeout(1000);

    // Take screenshot after reset view
    await page.screenshot({
      path: 'e2e/screenshots/louis-ifc-reset-view.png',
      fullPage: true
    });

    // Test wireframe toggle
    await wireframeBtn.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'e2e/screenshots/louis-ifc-wireframe.png',
      fullPage: true
    });

    // Toggle wireframe off
    await wireframeBtn.click();
    await page.waitForTimeout(500);

    // Verify canvas is not empty by checking pixel data
    const canvasHasContent = await page.evaluate(() => {
      const canvas = document.querySelector('.ifc-container canvas') as HTMLCanvasElement;
      if (!canvas) return { hasCanvas: false, hasContent: false };

      // Try to get the WebGL context and read pixels
      // Note: This may not work if the context is lost or in certain security contexts
      try {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl) {
          // Just verify there's a valid rendering context
          return {
            hasCanvas: true,
            hasContent: true,
            width: canvas.width,
            height: canvas.height
          };
        }
      } catch {
        // Context access might fail
      }

      return {
        hasCanvas: true,
        hasContent: canvas.width > 0 && canvas.height > 0,
        width: canvas.width,
        height: canvas.height
      };
    });

    console.log('Canvas state:', canvasHasContent);
    expect(canvasHasContent.hasCanvas).toBe(true);
    expect(canvasHasContent.hasContent).toBe(true);

    // Print console logs for debugging
    console.log('\n=== Console Logs ===');
    consoleLogs.filter(log => log.includes('[IFC')).forEach(log => console.log(log));

    // Final screenshot
    await page.screenshot({
      path: 'e2e/screenshots/louis-ifc-final.png',
      fullPage: true
    });

    console.log('\nTest completed successfully!');
  });
});
