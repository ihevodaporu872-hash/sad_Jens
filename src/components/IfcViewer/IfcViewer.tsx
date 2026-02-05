import { useEffect, useRef, useState, useCallback, DragEvent } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as WebIFC from 'web-ifc';
import './IfcViewer.css';

export interface IfcViewerProps {
  className?: string;
}

// Helper function to get user-friendly error messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('wasm') || msg.includes('webassembly')) {
      return 'Failed to load WebAssembly module. Please refresh the page or try a different browser.';
    }
    if (msg.includes('memory') || msg.includes('heap')) {
      return 'Not enough memory to load this file. Try a smaller IFC file.';
    }
    if (msg.includes('invalid') || msg.includes('parse') || msg.includes('syntax')) {
      return 'Invalid IFC file format. Please check that the file is a valid IFC file.';
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return 'Network error. Please check your internet connection.';
    }
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

export function IfcViewer({ className }: IfcViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const ifcApiRef = useRef<WebIFC.IfcAPI | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [error, setError] = useState<string | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [modelInfo, setModelInfo] = useState<{
    schema: string;
    meshCount: number;
    fileSize: number;
    fileName: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasModel, setHasModel] = useState(false);
  const [wireframeMode, setWireframeMode] = useState(false);

  // Initialize Three.js scene and web-ifc
  useEffect(() => {
    // Prevent double initialization in React Strict Mode
    let isInitialized = false;

    const initViewer = async () => {
      if (!containerRef.current || isInitialized) return;
      if (rendererRef.current) return; // Already initialized
      isInitialized = true;

      try {
        setIsLoading(true);
        setError(null);

        // Initialize Three.js
        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
        camera.position.set(50, 50, 50);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = true;
        controls.minDistance = 1;
        controls.maxDistance = 5000;
        controlsRef.current = controls;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight2.position.set(-50, 50, -50);
        scene.add(directionalLight2);

        // Grid helper
        const gridHelper = new THREE.GridHelper(100, 100, 0x444444, 0x333333);
        gridHelper.name = 'gridHelper';
        scene.add(gridHelper);

        // Axes helper
        const axesHelper = new THREE.AxesHelper(10);
        axesHelper.name = 'axesHelper';
        scene.add(axesHelper);

        // Model group
        const modelGroup = new THREE.Group();
        scene.add(modelGroup);
        modelGroupRef.current = modelGroup;

        // Initialize web-ifc
        const ifcApi = new WebIFC.IfcAPI();
        // Use absolute path for WASM files
        ifcApi.SetWasmPath('/wasm/', true);
        console.log('[IFC Viewer] Initializing web-ifc API...');
        await ifcApi.Init();
        console.log('[IFC Viewer] web-ifc API initialized successfully');
        ifcApiRef.current = ifcApi;

        // Animation loop
        const animate = () => {
          animationFrameRef.current = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        // Handle resize
        const handleResize = () => {
          if (!containerRef.current || !camera || !renderer) return;
          const newWidth = containerRef.current.clientWidth;
          const newHeight = containerRef.current.clientHeight;
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        };
        window.addEventListener('resize', handleResize);

        setViewerReady(true);
        setIsLoading(false);

        return () => {
          window.removeEventListener('resize', handleResize);
        };
      } catch (err) {
        console.error('Failed to initialize IFC viewer:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize viewer');
        setIsLoading(false);
      }
    };

    initViewer();

    return () => {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      if (ifcApiRef.current) {
        ifcApiRef.current.Dispose();
      }
    };
  }, []);

  // Create mesh from IFC geometry
  const createMeshFromGeometry = useCallback(
    (
      ifcApi: WebIFC.IfcAPI,
      modelID: number,
      placedGeometry: WebIFC.PlacedGeometry
    ): THREE.Mesh | null => {
      try {
        const geometry = ifcApi.GetGeometry(modelID, placedGeometry.geometryExpressID);
        const vertexData = ifcApi.GetVertexArray(
          geometry.GetVertexData(),
          geometry.GetVertexDataSize()
        );
        const indexData = ifcApi.GetIndexArray(
          geometry.GetIndexData(),
          geometry.GetIndexDataSize()
        );

        if (vertexData.length === 0 || indexData.length === 0) {
          if (typeof geometry.delete === 'function') geometry.delete();
          return null;
        }

      // Create Three.js geometry
      const bufferGeometry = new THREE.BufferGeometry();

      // Vertex data contains: position (3) + normal (3) = 6 floats per vertex
      const positionArray = new Float32Array(vertexData.length / 2);
      const normalArray = new Float32Array(vertexData.length / 2);

      for (let i = 0; i < vertexData.length; i += 6) {
        const vertexIndex = i / 6;
        positionArray[vertexIndex * 3] = vertexData[i];
        positionArray[vertexIndex * 3 + 1] = vertexData[i + 1];
        positionArray[vertexIndex * 3 + 2] = vertexData[i + 2];
        normalArray[vertexIndex * 3] = vertexData[i + 3];
        normalArray[vertexIndex * 3 + 1] = vertexData[i + 4];
        normalArray[vertexIndex * 3 + 2] = vertexData[i + 5];
      }

      bufferGeometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
      bufferGeometry.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));
      bufferGeometry.setIndex(new THREE.BufferAttribute(indexData, 1));

      // Apply transformation matrix
      const matrix = new THREE.Matrix4();
      matrix.fromArray(placedGeometry.flatTransformation);
      bufferGeometry.applyMatrix4(matrix);

      // Create material with IFC color
      const color = placedGeometry.color;
      // If color is pure white, use a light gray for better visibility
      const r = color.x === 1 && color.y === 1 && color.z === 1 ? 0.85 : color.x;
      const g = color.x === 1 && color.y === 1 && color.z === 1 ? 0.85 : color.y;
      const b = color.x === 1 && color.y === 1 && color.z === 1 ? 0.9 : color.z;

      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(r, g, b),
        opacity: color.w,
        transparent: color.w < 1,
        side: THREE.DoubleSide,
        flatShading: false,
        shininess: 30,
      });

      const mesh = new THREE.Mesh(bufferGeometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (typeof geometry.delete === 'function') geometry.delete();
      return mesh;
      } catch (err) {
        console.error('[IFC Viewer] Error creating mesh from geometry:', err);
        return null;
      }
    },
    []
  );

  // Toggle wireframe mode
  const toggleWireframe = useCallback(() => {
    const modelGroup = modelGroupRef.current;
    if (!modelGroup) return;

    const newWireframeMode = !wireframeMode;
    setWireframeMode(newWireframeMode);

    modelGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => {
            m.wireframe = newWireframeMode;
          });
        } else {
          child.material.wireframe = newWireframeMode;
        }
      }
    });
  }, [wireframeMode]);

  // Load IFC model
  const loadIfcModel = useCallback(
    async (data: Uint8Array, fileName: string, fileSize: number) => {
      const ifcApi = ifcApiRef.current;
      const modelGroup = modelGroupRef.current;

      if (!ifcApi || !modelGroup) {
        throw new Error('Viewer not initialized');
      }

      // Clear existing model
      while (modelGroup.children.length > 0) {
        const child = modelGroup.children[0];
        modelGroup.remove(child);
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }

      // Open model
      console.log('[IFC Viewer] Opening model...');
      const modelID = ifcApi.OpenModel(data, {
        COORDINATE_TO_ORIGIN: true,
      });

      console.log('[IFC Viewer] Model ID:', modelID);

      if (modelID === -1) {
        throw new Error('Failed to open IFC file');
      }

      // Get model schema info
      const schema = ifcApi.GetModelSchema(modelID);
      console.log('[IFC Viewer] Model schema:', schema);

      // Load all geometry using StreamAllMeshes
      // IMPORTANT: Geometry is only available during the callback - must process immediately!
      let meshCount = 0;
      let flatMeshCount = 0;

      console.log('[IFC Viewer] Streaming and processing meshes...');
      ifcApi.StreamAllMeshes(modelID, (mesh: WebIFC.FlatMesh, index: number, total: number) => {
        flatMeshCount++;

        // Update progress every 50 meshes or at the end
        if (index % 50 === 0 || index === total - 1) {
          console.log(`[IFC Viewer] Processing mesh ${index + 1}/${total}`);
        }

        const geometries = mesh.geometries;
        const size = geometries.size();

        for (let j = 0; j < size; j++) {
          const placedGeometry = geometries.get(j);
          const threeMesh = createMeshFromGeometry(ifcApi, modelID, placedGeometry);
          if (threeMesh) {
            modelGroup.add(threeMesh);
            meshCount++;
          }
        }
      });

      console.log(`[IFC Viewer] Loaded ${meshCount} Three.js meshes from ${flatMeshCount} IFC flat meshes`);

      // Center camera on model
      console.log('[IFC Viewer] Model group children count:', modelGroup.children.length);
      if (modelGroup.children.length > 0) {
        const box = new THREE.Box3().setFromObject(modelGroup);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);


        if (cameraRef.current && controlsRef.current && sceneRef.current) {
          // Remove old grid, axes and box helper by name
          const oldGrid = sceneRef.current.getObjectByName('gridHelper');
          const oldAxes = sceneRef.current.getObjectByName('axesHelper');
          const oldBox = sceneRef.current.getObjectByName('boxHelper');
          if (oldGrid) sceneRef.current.remove(oldGrid);
          if (oldAxes) sceneRef.current.remove(oldAxes);
          if (oldBox) sceneRef.current.remove(oldBox);

          // Update grid to match model size
          const gridSize = Math.max(maxDim * 4, 10);
          const gridDivisions = Math.min(100, Math.max(10, Math.floor(gridSize)));
          const newGrid = new THREE.GridHelper(gridSize, gridDivisions, 0x555555, 0x404040);
          newGrid.name = 'gridHelper';
          newGrid.position.set(center.x, box.min.y, center.z);
          sceneRef.current.add(newGrid);

          // Update axes helper
          const axesSize = Math.max(maxDim * 0.3, 1);
          const newAxes = new THREE.AxesHelper(axesSize);
          newAxes.name = 'axesHelper';
          newAxes.position.set(center.x, box.min.y, center.z);
          sceneRef.current.add(newAxes);


          // Position camera at a good viewing distance
          const distance = maxDim * 2.5;
          cameraRef.current.position.set(
            center.x + distance * 0.7,
            center.y + distance * 0.7,
            center.z + distance * 0.7
          );
          cameraRef.current.lookAt(center);
          controlsRef.current.target.copy(center);

          // Update camera near/far planes based on model size
          cameraRef.current.near = Math.max(0.001, maxDim * 0.0001);
          cameraRef.current.far = Math.max(1000, maxDim * 200);
          cameraRef.current.updateProjectionMatrix();

          // Update controls distance limits
          controlsRef.current.minDistance = maxDim * 0.05;
          controlsRef.current.maxDistance = maxDim * 20;
          controlsRef.current.update();

        }
      } else {
        console.warn('[IFC Viewer] No meshes were added to the model group');
      }

      // Close model to free memory (geometry is already extracted)
      ifcApi.CloseModel(modelID);

      setHasModel(modelGroup.children.length > 0);

      // Set model info with all details
      setModelInfo({
        schema,
        meshCount,
        fileSize,
        fileName,
      });
    },
    [createMeshFromGeometry]
  );

  // Process file (used by both upload and drag&drop)
  const processFile = useCallback(async (file: File) => {
    // Validate file extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.ifc')) {
      setError('Invalid file type. Please upload an IFC file (.ifc)');
      return;
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File is too large. Maximum file size is 500MB.');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Reading file...');
    setError(null);
    setModelInfo(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      // Basic validation of IFC file header
      const header = new TextDecoder().decode(data.slice(0, 100));
      if (!header.includes('ISO-10303-21') && !header.includes('STEP')) {
        throw new Error('Invalid IFC file: missing STEP header');
      }

      setLoadingMessage('Parsing IFC data...');
      await loadIfcModel(data, file.name, file.size);
      setWireframeMode(false);
      setIsLoading(false);
      setLoadingMessage('Loading...');
    } catch (err) {
      console.error('Failed to load IFC file:', err);
      setError(getErrorMessage(err));
      setIsLoading(false);
      setLoadingMessage('Loading...');
    }
  }, [loadIfcModel]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await processFile(file);

    // Reset input to allow re-uploading same file
    event.target.value = '';
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!viewerReady || isLoading) return;
    setIsDragging(true);
  }, [viewerReady, isLoading]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the drop zone entirely
    const relatedTarget = e.relatedTarget as Node | null;
    if (!dropZoneRef.current?.contains(relatedTarget)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!viewerReady || isLoading) return;

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    // Take only the first file
    const file = files[0];
    await processFile(file);
  }, [viewerReady, isLoading, processFile]);

  // Reset view
  const handleResetView = () => {
    if (!cameraRef.current || !controlsRef.current || !modelGroupRef.current) return;

    if (modelGroupRef.current.children.length > 0) {
      const box = new THREE.Box3().setFromObject(modelGroupRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      cameraRef.current.position.set(
        center.x + maxDim,
        center.y + maxDim,
        center.z + maxDim
      );
      controlsRef.current.target.copy(center);
    } else {
      cameraRef.current.position.set(50, 50, 50);
      controlsRef.current.target.set(0, 0, 0);
    }
    controlsRef.current.update();
  };

  return (
    <div className={`ifc-viewer ${className || ''}`}>
      <div className="ifc-toolbar">
        <div className="ifc-toolbar-header">
          <h2>IFC Viewer</h2>
          <p>View BIM/IFC files with 3D navigation - Rotate, Zoom, Pan</p>
        </div>
        <div className="ifc-toolbar-actions">
          <label className={`file-upload-btn ${(!viewerReady || isLoading) ? 'disabled' : ''}`}>
            Upload IFC
            <input
              type="file"
              accept=".ifc"
              onChange={handleFileUpload}
              disabled={!viewerReady || isLoading}
            />
          </label>
          <button
            className="reset-view-btn"
            onClick={handleResetView}
            disabled={!viewerReady || isLoading || !hasModel}
          >
            Reset View
          </button>
          <button
            className={`wireframe-btn ${wireframeMode ? 'active' : ''}`}
            onClick={toggleWireframe}
            disabled={!viewerReady || isLoading || !hasModel}
            title="Toggle wireframe mode"
          >
            Wireframe
          </button>
        </div>
      </div>
      {modelInfo && (
        <div className="ifc-model-info">
          <span className="ifc-model-info-item">
            <strong>File:</strong> {modelInfo.fileName}
          </span>
          <span className="ifc-model-info-item">
            <strong>Schema:</strong> {modelInfo.schema}
          </span>
          <span className="ifc-model-info-item">
            <strong>Elements:</strong> {modelInfo.meshCount.toLocaleString()}
          </span>
          <span className="ifc-model-info-item">
            <strong>Size:</strong> {(modelInfo.fileSize / 1024 / 1024).toFixed(2)} MB
          </span>
        </div>
      )}
      <div
        ref={dropZoneRef}
        className={`ifc-drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div ref={containerRef} className="ifc-container">
          {isLoading && (
            <div className="ifc-overlay">
              <div className="ifc-spinner" />
              <p>{loadingMessage}</p>
            </div>
          )}
          {error && (
            <div className="ifc-overlay ifc-error">
              <div className="ifc-error-icon">!</div>
              <p className="ifc-error-title">Error Loading File</p>
              <p className="ifc-error-message">{error}</p>
              <button className="ifc-error-retry" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          )}
          {!viewerReady && !isLoading && !error && (
            <div className="ifc-overlay">
              <div className="ifc-spinner" />
              <p>Initializing IFC viewer...</p>
            </div>
          )}
          {viewerReady && !isLoading && !error && !hasModel && (
            <div className="ifc-drop-hint">
              <div className="ifc-drop-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="ifc-drop-title">Drag & Drop IFC File Here</p>
              <p className="ifc-drop-subtitle">or use the "Upload IFC" button above</p>
              <p className="ifc-drop-formats">Supported: .ifc (IFC2x3, IFC4, IFC4x3)</p>
            </div>
          )}
          {isDragging && (
            <div className="ifc-drag-overlay">
              <div className="ifc-drag-content">
                <div className="ifc-drag-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p>Drop IFC file to load</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="ifc-controls-hint">
        <span>Left click + drag: Rotate</span>
        <span>Right click + drag: Pan</span>
        <span>Scroll: Zoom</span>
      </div>
    </div>
  );
}
