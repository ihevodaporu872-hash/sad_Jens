/**
 * Integration tests for all packages
 * Verifies that all required files are in place and packages are structured correctly
 */

const fs = require('fs');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');

describe('Packages Integration Tests', () => {

  describe('web-ifc package', () => {
    const pkgDir = path.join(PACKAGES_DIR, 'web-ifc');

    test('package.json exists and is valid', () => {
      const pkgPath = path.join(pkgDir, 'package.json');
      expect(fs.existsSync(pkgPath)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.name).toBe('web-ifc');
    });

    test('all WASM files exist', () => {
      expect(fs.existsSync(path.join(pkgDir, 'web-ifc.wasm'))).toBe(true);
      expect(fs.existsSync(path.join(pkgDir, 'web-ifc-node.wasm'))).toBe(true);
      expect(fs.existsSync(path.join(pkgDir, 'web-ifc-mt.wasm'))).toBe(true);
    });

    test('JavaScript API files exist', () => {
      expect(fs.existsSync(path.join(pkgDir, 'web-ifc-api.js'))).toBe(true);
      expect(fs.existsSync(path.join(pkgDir, 'web-ifc-api-node.js'))).toBe(true);
    });

    test('TypeScript definitions exist', () => {
      expect(fs.existsSync(path.join(pkgDir, 'web-ifc-api.d.ts'))).toBe(true);
      expect(fs.existsSync(path.join(pkgDir, 'ifc-schema.d.ts'))).toBe(true);
    });

    test('source files exist', () => {
      expect(fs.existsSync(path.join(pkgDir, 'src', 'web-ifc-api.ts'))).toBe(true);
      expect(fs.existsSync(path.join(pkgDir, 'src', 'ifc-schema.ts'))).toBe(true);
    });
  });

  describe('simplepdf package', () => {
    const pkgDir = path.join(PACKAGES_DIR, 'simplepdf');

    test('package.json exists and is valid', () => {
      const pkgPath = path.join(pkgDir, 'package.json');
      expect(fs.existsSync(pkgPath)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.name).toBe('@project/simplepdf');
    });

    test('source directory exists', () => {
      expect(fs.existsSync(path.join(pkgDir, 'src'))).toBe(true);
    });

    test('vitest config exists', () => {
      expect(fs.existsSync(path.join(pkgDir, 'vitest.config.ts'))).toBe(true);
    });
  });

  describe('cad-viewer package', () => {
    const pkgDir = path.join(PACKAGES_DIR, 'cad-viewer');

    test('core module exists', () => {
      expect(fs.existsSync(path.join(pkgDir, 'core'))).toBe(true);
      expect(fs.existsSync(path.join(pkgDir, 'core', 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(pkgDir, 'core', 'src'))).toBe(true);
    });

    test('svg-renderer module exists', () => {
      expect(fs.existsSync(path.join(pkgDir, 'svg-renderer'))).toBe(true);
      expect(fs.existsSync(path.join(pkgDir, 'svg-renderer', 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(pkgDir, 'svg-renderer', 'src'))).toBe(true);
    });

    test('three-renderer module exists', () => {
      expect(fs.existsSync(path.join(pkgDir, 'three-renderer'))).toBe(true);
    });

    test('LICENSE file exists', () => {
      expect(fs.existsSync(path.join(pkgDir, 'LICENSE'))).toBe(true);
    });
  });

  describe('univer package', () => {
    const pkgDir = path.join(PACKAGES_DIR, 'univer');

    test('core module exists', () => {
      expect(fs.existsSync(path.join(pkgDir, 'core'))).toBe(true);
      expect(fs.existsSync(path.join(pkgDir, 'core', 'package.json'))).toBe(true);
    });

    test('sheets module exists', () => {
      expect(fs.existsSync(path.join(pkgDir, 'sheets'))).toBe(true);
      expect(fs.existsSync(path.join(pkgDir, 'sheets', 'package.json'))).toBe(true);
    });

    test('ui module exists', () => {
      expect(fs.existsSync(path.join(pkgDir, 'ui'))).toBe(true);
    });

    test('engine-render module exists', () => {
      expect(fs.existsSync(path.join(pkgDir, 'engine-render'))).toBe(true);
    });

    test('engine-formula module exists', () => {
      expect(fs.existsSync(path.join(pkgDir, 'engine-formula'))).toBe(true);
    });

    const requiredModules = ['design', 'drawing', 'sheets-formula', 'sheets-numfmt', 'sheets-ui', 'themes'];
    requiredModules.forEach(module => {
      test(`${module} module exists`, () => {
        expect(fs.existsSync(path.join(pkgDir, module))).toBe(true);
      });
    });
  });

  describe('Package file sizes', () => {
    test('web-ifc WASM files have reasonable size', () => {
      const wasmPath = path.join(PACKAGES_DIR, 'web-ifc', 'web-ifc.wasm');
      const stats = fs.statSync(wasmPath);
      expect(stats.size).toBeGreaterThan(1000000); // > 1MB
      expect(stats.size).toBeLessThan(10000000);   // < 10MB
    });

    test('web-ifc API JS files have reasonable size', () => {
      const apiPath = path.join(PACKAGES_DIR, 'web-ifc', 'web-ifc-api.js');
      const stats = fs.statSync(apiPath);
      expect(stats.size).toBeGreaterThan(100000);  // > 100KB
    });
  });
});
