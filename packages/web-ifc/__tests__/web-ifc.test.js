const fs = require('fs');
const path = require('path');
const WebIFC = require('../web-ifc-api-node.js');

describe('web-ifc Integration Tests', () => {
  let ifcApi;

  beforeAll(async () => {
    ifcApi = new WebIFC.IfcAPI();
    // SetWasmPath expects relative path from the module location
    ifcApi.SetWasmPath('./');
    await ifcApi.Init();
  });

  afterAll(() => {
    if (ifcApi) {
      ifcApi = null;
    }
  });

  describe('API Initialization', () => {
    test('should initialize IfcAPI successfully', () => {
      expect(ifcApi).toBeDefined();
    });

    test('should have required methods', () => {
      expect(typeof ifcApi.OpenModel).toBe('function');
      expect(typeof ifcApi.CloseModel).toBe('function');
      expect(typeof ifcApi.GetModelSchema).toBe('function');
      expect(typeof ifcApi.GetLineIDsWithType).toBe('function');
      expect(typeof ifcApi.GetLine).toBe('function');
    });
  });

  describe('IFC File Loading', () => {
    let modelID;
    const sampleIfcPath = path.join(__dirname, 'fixtures', 'sample.ifc');

    beforeAll(() => {
      const ifcData = fs.readFileSync(sampleIfcPath);
      modelID = ifcApi.OpenModel(ifcData);
    });

    afterAll(() => {
      if (modelID !== undefined) {
        ifcApi.CloseModel(modelID);
      }
    });

    test('should open IFC file and return model ID', () => {
      expect(typeof modelID).toBe('number');
      expect(modelID).toBeGreaterThanOrEqual(0);
    });

    test('should detect IFC schema version', () => {
      const schema = ifcApi.GetModelSchema(modelID);
      expect(schema).toBe('IFC2X3');
    });

    test('should find IFCPROJECT entity', () => {
      const projectIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCPROJECT);
      expect(projectIds.size()).toBeGreaterThan(0);
    });

    test('should read project properties', () => {
      const projectIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCPROJECT);
      const projectId = projectIds.get(0);
      const project = ifcApi.GetLine(modelID, projectId);

      expect(project).toBeDefined();
      expect(project.Name).toBeDefined();
      expect(project.Name.value).toBe('Sample Project');
    });

    test('should find unit assignments', () => {
      const unitIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCUNITASSIGNMENT);
      expect(unitIds.size()).toBeGreaterThan(0);
    });
  });

  describe('IFC Data Creation', () => {
    let modelID;

    beforeAll(() => {
      modelID = ifcApi.CreateModel({ schema: WebIFC.Schemas.IFC2X3 });
    });

    afterAll(() => {
      if (modelID !== undefined) {
        ifcApi.CloseModel(modelID);
      }
    });

    test('should create new empty model', () => {
      expect(typeof modelID).toBe('number');
      expect(modelID).toBeGreaterThanOrEqual(0);
    });

    test('should get all lines from model', () => {
      const allLines = ifcApi.GetAllLines(modelID);
      expect(allLines).toBeDefined();
      expect(typeof allLines.size).toBe('function');
    });

    test('should export model to IFC string', () => {
      const ifcData = ifcApi.SaveModel(modelID);
      expect(ifcData).toBeDefined();
      expect(ifcData.length).toBeGreaterThan(0);
    });
  });

  describe('Geometry Processing', () => {
    test('should have geometry processing methods', () => {
      expect(typeof ifcApi.GetCoordinationMatrix).toBe('function');
      expect(typeof ifcApi.StreamAllMeshes).toBe('function');
    });
  });

  describe('WASM Files Availability', () => {
    const wasmDir = path.join(__dirname, '..');

    test('should have web-ifc.wasm', () => {
      const wasmPath = path.join(wasmDir, 'web-ifc.wasm');
      expect(fs.existsSync(wasmPath)).toBe(true);
    });

    test('should have web-ifc-node.wasm', () => {
      const wasmPath = path.join(wasmDir, 'web-ifc-node.wasm');
      expect(fs.existsSync(wasmPath)).toBe(true);
    });

    test('should have web-ifc-mt.wasm', () => {
      const wasmPath = path.join(wasmDir, 'web-ifc-mt.wasm');
      expect(fs.existsSync(wasmPath)).toBe(true);
    });
  });
});
