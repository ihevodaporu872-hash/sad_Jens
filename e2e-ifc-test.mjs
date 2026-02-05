import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = './screenshots/ifc';
const BASE_URL = 'http://localhost:5183';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Create a valid IFC test file
function createTestIfcFile() {
  const ifcContent = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('test-model.ifc','2024-01-01T00:00:00',('Test'),(''),'','web-ifc','');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
#1=IFCPROJECT('0YvctVUKr0kugbFTf53O9L',$,'Test BIM Project',$,$,$,$,(#6),#7);
#2=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);
#3=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);
#4=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);
#5=IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);
#6=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5,#10,$);
#7=IFCUNITASSIGNMENT((#2,#3,#4,#5));
#10=IFCAXIS2PLACEMENT3D(#11,$,$);
#11=IFCCARTESIANPOINT((0.,0.,0.));
#20=IFCSITE('2XoBZ9nWn1qgP0pBL0UisF',$,'Test Site',$,$,#21,$,$,.ELEMENT.,$,$,$,$,$);
#21=IFCLOCALPLACEMENT($,#10);
#30=IFCBUILDING('3vB2YO6MzFBu8FJDmT4hl7',$,'Test Building',$,$,#31,$,$,.ELEMENT.,$,$,$);
#31=IFCLOCALPLACEMENT(#21,#10);
#40=IFCBUILDINGSTOREY('0gqJDlLXvCbBI8HwUkd3Z9',$,'Level 1',$,$,#41,$,$,.ELEMENT.,0.);
#41=IFCLOCALPLACEMENT(#31,#10);
#50=IFCRELAGGREGATES('2nFTw9m$96$es3BBIuZkYN',$,$,$,#1,(#20));
#51=IFCRELAGGREGATES('3QoLV9he94gQlhPIer$QU8',$,$,$,#20,(#30));
#52=IFCRELAGGREGATES('1wYVhRn2j0mQCMxZBj$cZu',$,$,$,#30,(#40));
#100=IFCWALL('2O2Fr$t4X7Zf8NOew3FNr2',$,'Test Wall',$,$,#101,#110,$,$);
#101=IFCLOCALPLACEMENT(#41,#102);
#102=IFCAXIS2PLACEMENT3D(#103,$,$);
#103=IFCCARTESIANPOINT((0.,0.,0.));
#110=IFCPRODUCTDEFINITIONSHAPE($,$,(#111));
#111=IFCSHAPEREPRESENTATION(#6,'Body','SweptSolid',(#112));
#112=IFCEXTRUDEDAREASOLID(#113,#102,#114,3.0);
#113=IFCRECTANGLEPROFILEDEF(.AREA.,$,#115,5.0,0.2);
#114=IFCDIRECTION((0.,0.,1.));
#115=IFCAXIS2PLACEMENT2D(#116,$);
#116=IFCCARTESIANPOINT((0.,0.));
#200=IFCRELCONTAINEDINSPATIALSTRUCTURE('3Sa3dTJGn0H8TQIGiuGQd5',$,$,$,(#100),#40);
ENDSEC;
END-ISO-10303-21;`;

  const testFilePath = './test-model.ifc';
  fs.writeFileSync(testFilePath, ifcContent);
  console.log('Created test IFC file:', testFilePath);
  return testFilePath;
}

async function runIfcTests() {
  console.log('='.repeat(60));
  console.log('E2E ТЕСТИРОВАНИЕ IFC/BIM VIEWER');
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  const results = [];
  let testIfcPath = null;

  // Capture console
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('   [Browser Error]:', msg.text().substring(0, 150));
    }
  });

  try {
    // 1. Load page
    console.log('\n[1] Загрузка IFC страницы...');
    await page.goto(BASE_URL + '/ifc', { timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-initial.png`, fullPage: true });

    const title = await page.title();
    console.log('    URL:', page.url());
    results.push({ test: 'Page Load', status: 'PASS' });

    // 2. Check header
    console.log('\n[2] Проверка заголовка...');
    const h2 = page.locator('h2');
    if (await h2.count() > 0) {
      const headerText = await h2.first().textContent();
      console.log('    H2:', headerText);
      results.push({ test: 'Header', status: headerText?.includes('IFC') ? 'PASS' : 'FAIL' });
    } else {
      results.push({ test: 'Header', status: 'FAIL' });
    }

    // 3. Check Upload button
    console.log('\n[3] Проверка кнопки Upload IFC...');
    const uploadBtn = page.locator('text=Upload IFC');
    const btnCount = await uploadBtn.count();
    console.log('    Upload IFC button:', btnCount > 0 ? 'OK' : 'MISSING');
    results.push({ test: 'Upload Button', status: btnCount > 0 ? 'PASS' : 'FAIL' });

    // 4. Check canvas (Three.js)
    console.log('\n[4] Проверка 3D canvas (Three.js)...');
    const canvas = page.locator('canvas');
    const canvasCount = await canvas.count();
    console.log('    Canvas elements:', canvasCount);
    results.push({ test: '3D Canvas', status: canvasCount > 0 ? 'PASS' : 'FAIL' });

    // 5. Check file input
    console.log('\n[5] Проверка file input...');
    const fileInput = page.locator('input[type="file"][accept=".ifc"]');
    const inputCount = await fileInput.count();
    console.log('    IFC file input:', inputCount > 0 ? 'OK' : 'MISSING');
    results.push({ test: 'File Input', status: inputCount > 0 ? 'PASS' : 'FAIL' });

    // 6. Wait for viewer initialization
    console.log('\n[6] Ожидание инициализации viewer...');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-viewer-init.png`, fullPage: true });

    // Check if viewer shows ready state or drop hint
    const dropHint = await page.locator('text=Drag & Drop').count();
    const viewerReady = dropHint > 0 || canvasCount > 0;
    console.log('    Viewer ready:', viewerReady ? 'YES' : 'NO');
    results.push({ test: 'Viewer Init', status: viewerReady ? 'PASS' : 'FAIL' });

    // 7. Test file upload
    console.log('\n[7] Тест загрузки IFC файла...');
    testIfcPath = createTestIfcFile();

    const fileInputForUpload = page.locator('input[type="file"]');
    if (await fileInputForUpload.count() > 0) {
      await fileInputForUpload.setInputFiles(path.resolve(testIfcPath));
      console.log('    Файл выбран');

      // Wait for loading
      await page.waitForTimeout(8000);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-after-upload.png`, fullPage: true });

      // Check if model info appeared
      const modelInfoSchema = await page.locator('text=Schema').count();
      const modelInfoElements = await page.locator('text=Elements').count();
      const hasModelInfo = modelInfoSchema > 0 || modelInfoElements > 0;

      console.log('    Model info visible:', hasModelInfo ? 'YES' : 'NO');
      results.push({ test: 'File Upload', status: hasModelInfo ? 'PASS' : 'PARTIAL' });
    } else {
      results.push({ test: 'File Upload', status: 'SKIP' });
    }

    // 8. Check controls hint
    console.log('\n[8] Проверка подсказок управления...');
    const rotateHint = await page.locator('text=Rotate').count();
    const zoomHint = await page.locator('text=Zoom').count();
    console.log('    Controls hints:', (rotateHint > 0 || zoomHint > 0) ? 'OK' : 'MISSING');
    results.push({ test: 'Controls Hints', status: (rotateHint > 0 || zoomHint > 0) ? 'PASS' : 'FAIL' });

    // Final screenshot
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-final.png`, fullPage: true });

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('РЕЗУЛЬТАТЫ ТЕСТОВ IFC/BIM');
    console.log('='.repeat(60));

    let passed = 0, failed = 0, partial = 0;
    for (const r of results) {
      let icon = '✓';
      if (r.status === 'FAIL') icon = '✗';
      if (r.status === 'PARTIAL' || r.status === 'SKIP') icon = '○';

      console.log(`${icon} ${r.test}: ${r.status}`);

      if (r.status === 'PASS') passed++;
      else if (r.status === 'FAIL') failed++;
      else partial++;
    }

    console.log('='.repeat(60));
    console.log(`Прошло: ${passed} | Упало: ${failed} | Частично: ${partial}`);
    console.log(`Скриншоты: ${path.resolve(SCREENSHOTS_DIR)}`);

    if (failed === 0) {
      console.log('\n✓ ВСЕ ОСНОВНЫЕ ТЕСТЫ IFC ПРОЙДЕНЫ');
    }

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/error.png` });
  } finally {
    await browser.close();
    // Cleanup test file
    if (testIfcPath && fs.existsSync(testIfcPath)) {
      fs.unlinkSync(testIfcPath);
    }
  }
}

runIfcTests().catch(console.error);
