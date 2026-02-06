import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  DragEvent,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as WebIFC from 'web-ifc';
import type { IfcViewerProps, IfcViewerRef, ElementSelection } from '../../types/ifc';
import './IfcViewer.css';

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

// Parse hex color to THREE.Color
function hexToThreeColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

export const IfcViewer = forwardRef<IfcViewerRef, IfcViewerProps>(
  function IfcViewer({ className, onElementSelected, onSelectionChanged }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const ifcApiRef = useRef<WebIFC.IfcAPI | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const modelGroupRef = useRef<THREE.Group | null>(null);
    const modelIdRef = useRef<number | null>(null);

    // Selection tracking
    const raycasterRef = useRef(new THREE.Raycaster());
    const mouseRef = useRef(new THREE.Vector2());
    const selectedIdsRef = useRef<Set<number>>(new Set());
    // expressId → array of Three.js meshes
    const expressIdToMeshesRef = useRef<Map<number, THREE.Mesh[]>>(new Map());
    // mesh uuid → original material(s)
    const originalMaterialsRef = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());
    // worksetId → { expressIds, color, opacity } for active highlights
    const activeHighlightsRef = useRef<Map<string, { expressIds: number[]; color: string; opacity: number }>>(new Map());
    // Track isolated elements
    const isolatedIdsRef = useRef<Set<number> | null>(null);
    // Track wireframe-others mode: stores original materials of "other" meshes
    const wireframeOthersRef = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());
    // Track hidden elements
    const hiddenIdsRef = useRef<Set<number>>(new Set());
    // Track colored elements for resetColors
    const coloredIdsRef = useRef<Set<number>>(new Set());
    // Click tracking to distinguish click from drag
    const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

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
    const [loadingProgress, setLoadingProgress] = useState(0);

    // ── Selection highlight helpers ──────────────────────────────────

    const storeOriginalMaterial = useCallback((mesh: THREE.Mesh) => {
      if (!originalMaterialsRef.current.has(mesh.uuid)) {
        originalMaterialsRef.current.set(
          mesh.uuid,
          Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone()
        );
      }
    }, []);

    const restoreMaterial = useCallback((mesh: THREE.Mesh) => {
      const original = originalMaterialsRef.current.get(mesh.uuid);
      if (original) {
        mesh.material = Array.isArray(original) ? original.map((m) => m.clone()) : original.clone();
        originalMaterialsRef.current.delete(mesh.uuid);
      }
    }, []);

    const applyHighlightToMesh = useCallback(
      (mesh: THREE.Mesh, color: string, opacity: number) => {
        storeOriginalMaterial(mesh);
        const mat = new THREE.MeshPhongMaterial({
          color: hexToThreeColor(color),
          opacity,
          transparent: opacity < 1,
          side: THREE.DoubleSide,
          shininess: 60,
          emissive: hexToThreeColor(color),
          emissiveIntensity: 0.15,
        });
        mesh.material = mat;
      },
      [storeOriginalMaterial]
    );

    const applySelectionHighlight = useCallback(
      (expressId: number) => {
        const meshes = expressIdToMeshesRef.current.get(expressId);
        if (!meshes) return;
        for (const mesh of meshes) {
          applyHighlightToMesh(mesh, '#4488ff', 0.85);
        }
      },
      [applyHighlightToMesh]
    );

    const removeSelectionHighlight = useCallback(
      (expressId: number) => {
        const meshes = expressIdToMeshesRef.current.get(expressId);
        if (!meshes) return;
        for (const mesh of meshes) {
          restoreMaterial(mesh);
        }
      },
      [restoreMaterial]
    );

    // ── Imperative API ──────────────────────────────────────────────

    useImperativeHandle(
      ref,
      () => ({
        highlightElements(worksetId: string, expressIds: number[], color: string, opacity: number) {
          // Clear previous highlight for this workset
          this.clearHighlight(worksetId);

          activeHighlightsRef.current.set(worksetId, { expressIds, color, opacity });

          for (const eid of expressIds) {
            const meshes = expressIdToMeshesRef.current.get(eid);
            if (!meshes) continue;
            for (const mesh of meshes) {
              applyHighlightToMesh(mesh, color, opacity);
            }
          }
        },

        clearHighlight(worksetId?: string) {
          if (worksetId) {
            const info = activeHighlightsRef.current.get(worksetId);
            if (info) {
              for (const eid of info.expressIds) {
                const meshes = expressIdToMeshesRef.current.get(eid);
                if (!meshes) continue;
                for (const mesh of meshes) {
                  restoreMaterial(mesh);
                }
              }
              activeHighlightsRef.current.delete(worksetId);
            }
          } else {
            // Clear all highlights
            for (const [, info] of activeHighlightsRef.current) {
              for (const eid of info.expressIds) {
                const meshes = expressIdToMeshesRef.current.get(eid);
                if (!meshes) continue;
                for (const mesh of meshes) {
                  restoreMaterial(mesh);
                }
              }
            }
            activeHighlightsRef.current.clear();
          }
        },

        isolate(expressIds: number[]) {
          const idSet = new Set(expressIds);
          isolatedIdsRef.current = idSet;
          const modelGroup = modelGroupRef.current;
          if (!modelGroup) return;

          modelGroup.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const eid = child.userData.expressID as number | undefined;
              if (eid !== undefined) {
                child.visible = idSet.has(eid);
              }
            }
          });
        },

        unisolate() {
          isolatedIdsRef.current = null;
          const modelGroup = modelGroupRef.current;
          if (!modelGroup) return;

          modelGroup.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.visible = true;
            }
          });
        },

        setElementsOpacity(expressIds: number[], opacity: number) {
          for (const eid of expressIds) {
            const meshes = expressIdToMeshesRef.current.get(eid);
            if (!meshes) continue;
            for (const mesh of meshes) {
              storeOriginalMaterial(mesh);
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach((m) => {
                  m.opacity = opacity;
                  m.transparent = opacity < 1;
                });
              } else {
                mesh.material.opacity = opacity;
                mesh.material.transparent = opacity < 1;
              }
            }
          }
        },

        setOthersWireframe(expressIdsToKeep: number[]) {
          const keepSet = new Set(expressIdsToKeep);
          const modelGroup = modelGroupRef.current;
          if (!modelGroup) return;

          // Clear previous wireframe-others state
          this.clearOthersWireframe();

          modelGroup.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const eid = child.userData.expressID as number | undefined;
              if (eid !== undefined && !keepSet.has(eid)) {
                // Store original material
                if (!wireframeOthersRef.current.has(child.uuid)) {
                  wireframeOthersRef.current.set(
                    child.uuid,
                    Array.isArray(child.material)
                      ? child.material.map((m) => m.clone())
                      : child.material.clone()
                  );
                }
                // Apply wireframe
                const wireMat = new THREE.MeshBasicMaterial({
                  color: 0x8899bb,
                  wireframe: true,
                  transparent: true,
                  opacity: 0.35,
                });
                child.material = wireMat;
              }
            }
          });
        },

        clearOthersWireframe() {
          const modelGroup = modelGroupRef.current;
          if (!modelGroup) return;

          for (const [uuid, origMat] of wireframeOthersRef.current) {
            modelGroup.traverse((child) => {
              if (child instanceof THREE.Mesh && child.uuid === uuid) {
                child.material = Array.isArray(origMat) ? origMat.map((m) => m.clone()) : origMat.clone();
              }
            });
          }
          wireframeOthersRef.current.clear();
        },

        getModelId() {
          return modelIdRef.current;
        },

        getIfcApi() {
          return ifcApiRef.current;
        },

        hideElements(expressIds: number[]) {
          for (const eid of expressIds) {
            hiddenIdsRef.current.add(eid);
            const meshes = expressIdToMeshesRef.current.get(eid);
            if (!meshes) continue;
            for (const mesh of meshes) {
              mesh.visible = false;
            }
          }
        },

        showElements(expressIds: number[]) {
          for (const eid of expressIds) {
            hiddenIdsRef.current.delete(eid);
            const meshes = expressIdToMeshesRef.current.get(eid);
            if (!meshes) continue;
            for (const mesh of meshes) {
              mesh.visible = true;
            }
          }
        },

        showAll() {
          hiddenIdsRef.current.clear();
          const modelGroup = modelGroupRef.current;
          if (!modelGroup) return;
          modelGroup.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.visible = true;
            }
          });
        },

        colorElements(expressIds: number[], color: string) {
          for (const eid of expressIds) {
            coloredIdsRef.current.add(eid);
            const meshes = expressIdToMeshesRef.current.get(eid);
            if (!meshes) continue;
            for (const mesh of meshes) {
              storeOriginalMaterial(mesh);
              const mat = new THREE.MeshPhongMaterial({
                color: hexToThreeColor(color),
                side: THREE.DoubleSide,
                shininess: 40,
              });
              mesh.material = mat;
            }
          }
        },

        resetColors() {
          for (const eid of coloredIdsRef.current) {
            const meshes = expressIdToMeshesRef.current.get(eid);
            if (!meshes) continue;
            for (const mesh of meshes) {
              restoreMaterial(mesh);
            }
          }
          coloredIdsRef.current.clear();
        },

        selectElements(expressIds: number[]) {
          // Clear previous selection
          for (const prevId of selectedIdsRef.current) {
            removeSelectionHighlight(prevId);
          }
          selectedIdsRef.current.clear();

          // Apply new selection
          for (const eid of expressIds) {
            selectedIdsRef.current.add(eid);
            applySelectionHighlight(eid);
          }

          const modelId = modelIdRef.current ?? 0;
          onSelectionChanged?.(
            expressIds.map((eid) => ({ modelId, expressId: eid }))
          );
          if (expressIds.length > 0) {
            onElementSelected?.({ modelId, expressId: expressIds[0] });
          } else {
            onElementSelected?.(null);
          }
        },

        getAllExpressIds() {
          return Array.from(expressIdToMeshesRef.current.keys());
        },

        getSelectedExpressIds() {
          return Array.from(selectedIdsRef.current);
        },
      }),
      [applyHighlightToMesh, restoreMaterial, storeOriginalMaterial, applySelectionHighlight, removeSelectionHighlight, onElementSelected, onSelectionChanged]
    );

    // ── Initialize Three.js scene and web-ifc ───────────────────────

    useEffect(() => {
      let isInitialized = false;

      const initViewer = async () => {
        if (!containerRef.current || isInitialized) return;
        if (rendererRef.current) return;
        isInitialized = true;

        try {
          setIsLoading(true);
          setError(null);

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
          ifcApi.SetWasmPath('/wasm/', true);
          console.log('[IFC Viewer] Initializing web-ifc API...');
          await ifcApi.Init();
          console.log('[IFC Viewer] web-ifc API initialized successfully');
          ifcApiRef.current = ifcApi;

          // ── Click handling for element selection ──

          const onMouseDown = (e: MouseEvent) => {
            mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
          };

          const onClick = (e: MouseEvent) => {
            // Ignore if dragged more than 5px (orbit control)
            if (mouseDownPosRef.current) {
              const dx = e.clientX - mouseDownPosRef.current.x;
              const dy = e.clientY - mouseDownPosRef.current.y;
              if (Math.sqrt(dx * dx + dy * dy) > 5) return;
            }

            if (!cameraRef.current || !modelGroupRef.current) return;

            const rect = renderer.domElement.getBoundingClientRect();
            mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
            const intersects = raycasterRef.current.intersectObjects(
              modelGroupRef.current.children,
              true
            );

            if (intersects.length > 0) {
              const hit = intersects[0].object as THREE.Mesh;
              const expressId = hit.userData.expressID as number | undefined;
              if (expressId === undefined) return;

              const isCtrl = e.ctrlKey || e.metaKey;

              if (isCtrl) {
                // Toggle in multi-select
                if (selectedIdsRef.current.has(expressId)) {
                  selectedIdsRef.current.delete(expressId);
                  removeSelectionHighlight(expressId);
                } else {
                  selectedIdsRef.current.add(expressId);
                  applySelectionHighlight(expressId);
                }
              } else {
                // Single select — clear previous
                for (const prevId of selectedIdsRef.current) {
                  removeSelectionHighlight(prevId);
                }
                selectedIdsRef.current.clear();
                selectedIdsRef.current.add(expressId);
                applySelectionHighlight(expressId);
              }

              const modelId = modelIdRef.current ?? 0;
              const selection: ElementSelection = { modelId, expressId };

              onElementSelected?.(selection);
              onSelectionChanged?.(
                Array.from(selectedIdsRef.current).map((eid) => ({
                  modelId,
                  expressId: eid,
                }))
              );
            } else {
              // Click on empty space — deselect
              for (const prevId of selectedIdsRef.current) {
                removeSelectionHighlight(prevId);
              }
              selectedIdsRef.current.clear();
              onElementSelected?.(null);
              onSelectionChanged?.([]);
            }
          };

          renderer.domElement.addEventListener('mousedown', onMouseDown);
          renderer.domElement.addEventListener('click', onClick);

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
            renderer.domElement.removeEventListener('mousedown', onMouseDown);
            renderer.domElement.removeEventListener('click', onClick);
          };
        } catch (err) {
          console.error('Failed to initialize IFC viewer:', err);
          setError(err instanceof Error ? err.message : 'Failed to initialize viewer');
          setIsLoading(false);
        }
      };

      initViewer();

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (rendererRef.current && containerRef.current) {
          containerRef.current.removeChild(rendererRef.current.domElement);
          rendererRef.current.dispose();
        }
        if (ifcApiRef.current) {
          // Close model if open
          if (modelIdRef.current !== null) {
            try {
              ifcApiRef.current.CloseModel(modelIdRef.current);
            } catch {
              // ignore
            }
          }
          ifcApiRef.current.Dispose();
        }
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Create mesh from IFC geometry ───────────────────────────────

    const createMeshFromGeometry = useCallback(
      (
        ifcApi: WebIFC.IfcAPI,
        modelID: number,
        placedGeometry: WebIFC.PlacedGeometry,
        expressID: number
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

          const bufferGeometry = new THREE.BufferGeometry();
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

          const matrix = new THREE.Matrix4();
          matrix.fromArray(placedGeometry.flatTransformation);
          bufferGeometry.applyMatrix4(matrix);

          const color = placedGeometry.color;
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
          // Store expressID for raycast identification
          mesh.userData.expressID = expressID;

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

    // ── Load IFC model ──────────────────────────────────────────────

    const loadIfcModel = useCallback(
      async (data: Uint8Array, fileName: string, fileSize: number) => {
        const ifcApi = ifcApiRef.current;
        const modelGroup = modelGroupRef.current;

        if (!ifcApi || !modelGroup) {
          throw new Error('Viewer not initialized');
        }

        // Close previous model if open
        if (modelIdRef.current !== null) {
          try {
            ifcApi.CloseModel(modelIdRef.current);
          } catch {
            // ignore
          }
          modelIdRef.current = null;
        }

        // Clear existing meshes and tracking maps
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
        expressIdToMeshesRef.current.clear();
        originalMaterialsRef.current.clear();
        activeHighlightsRef.current.clear();
        selectedIdsRef.current.clear();
        isolatedIdsRef.current = null;
        hiddenIdsRef.current.clear();
        coloredIdsRef.current.clear();
        wireframeOthersRef.current.clear();

        console.log('[IFC Viewer] Opening model...');
        const modelID = ifcApi.OpenModel(data, {
          COORDINATE_TO_ORIGIN: true,
          CIRCLE_SEGMENTS: 16,
          MEMORY_LIMIT: 2147483648,
          BOOLEAN_UNION_THRESHOLD: 200,
        });

        console.log('[IFC Viewer] Model ID:', modelID);
        if (modelID === -1) {
          throw new Error('Failed to open IFC file');
        }

        // Keep model open for property queries!
        modelIdRef.current = modelID;

        const schema = ifcApi.GetModelSchema(modelID);
        console.log('[IFC Viewer] Model schema:', schema);

        let meshCount = 0;
        let flatMeshCount = 0;

        console.log('[IFC Viewer] Streaming and processing meshes...');
        setLoadingProgress(0);

        ifcApi.StreamAllMeshes(modelID, (mesh: WebIFC.FlatMesh, index: number, total: number) => {
          flatMeshCount++;
          const expressID = mesh.expressID;

          if (index % 20 === 0 || index === total - 1) {
            const progress = Math.round(((index + 1) / total) * 100);
            setLoadingProgress(progress);
            setLoadingMessage(`Loading geometry... ${progress}%`);
          }

          const geometries = mesh.geometries;
          const size = geometries.size();

          for (let j = 0; j < size; j++) {
            const placedGeometry = geometries.get(j);
            const threeMesh = createMeshFromGeometry(ifcApi, modelID, placedGeometry, expressID);
            if (threeMesh) {
              modelGroup.add(threeMesh);
              meshCount++;

              // Build expressId → meshes map
              if (!expressIdToMeshesRef.current.has(expressID)) {
                expressIdToMeshesRef.current.set(expressID, []);
              }
              expressIdToMeshesRef.current.get(expressID)!.push(threeMesh);
            }
          }
        });

        setLoadingProgress(100);
        console.log(
          `[IFC Viewer] Loaded ${meshCount} Three.js meshes from ${flatMeshCount} IFC flat meshes`
        );
        console.log(
          `[IFC Viewer] Express IDs tracked: ${expressIdToMeshesRef.current.size}`
        );

        // Center camera on model
        if (modelGroup.children.length > 0) {
          const box = new THREE.Box3().setFromObject(modelGroup);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);

          if (cameraRef.current && controlsRef.current && sceneRef.current) {
            const oldGrid = sceneRef.current.getObjectByName('gridHelper');
            const oldAxes = sceneRef.current.getObjectByName('axesHelper');
            if (oldGrid) sceneRef.current.remove(oldGrid);
            if (oldAxes) sceneRef.current.remove(oldAxes);

            const gridSize = Math.max(maxDim * 4, 10);
            const gridDivisions = Math.min(100, Math.max(10, Math.floor(gridSize)));
            const newGrid = new THREE.GridHelper(gridSize, gridDivisions, 0x555555, 0x404040);
            newGrid.name = 'gridHelper';
            newGrid.position.set(center.x, box.min.y, center.z);
            sceneRef.current.add(newGrid);

            const axesSize = Math.max(maxDim * 0.3, 1);
            const newAxes = new THREE.AxesHelper(axesSize);
            newAxes.name = 'axesHelper';
            newAxes.position.set(center.x, box.min.y, center.z);
            sceneRef.current.add(newAxes);

            const distance = maxDim * 2.5;
            cameraRef.current.position.set(
              center.x + distance * 0.7,
              center.y + distance * 0.7,
              center.z + distance * 0.7
            );
            cameraRef.current.lookAt(center);
            controlsRef.current.target.copy(center);

            cameraRef.current.near = Math.max(0.001, maxDim * 0.0001);
            cameraRef.current.far = Math.max(1000, maxDim * 200);
            cameraRef.current.updateProjectionMatrix();

            controlsRef.current.minDistance = maxDim * 0.05;
            controlsRef.current.maxDistance = maxDim * 20;
            controlsRef.current.update();
          }
        } else {
          console.warn('[IFC Viewer] No meshes were added to the model group');
        }

        // NOTE: We do NOT close the model here — it stays open for property queries
        setHasModel(modelGroup.children.length > 0);

        setModelInfo({
          schema,
          meshCount,
          fileSize,
          fileName,
        });
      },
      [createMeshFromGeometry]
    );

    // ── Process file ────────────────────────────────────────────────

    const processFile = useCallback(
      async (file: File) => {
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.ifc')) {
          setError('Invalid file type. Please upload an IFC file (.ifc)');
          return;
        }

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
      },
      [loadIfcModel]
    );

    // Handle file upload
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await processFile(file);
      event.target.value = '';
    };

    // Drag and drop handlers
    const handleDragEnter = useCallback(
      (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!viewerReady || isLoading) return;
        setIsDragging(true);
      },
      [viewerReady, isLoading]
    );

    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const relatedTarget = e.relatedTarget as Node | null;
      if (!dropZoneRef.current?.contains(relatedTarget)) {
        setIsDragging(false);
      }
    }, []);

    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
    }, []);

    const handleDrop = useCallback(
      async (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (!viewerReady || isLoading) return;

        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        await processFile(file);
      },
      [viewerReady, isLoading, processFile]
    );

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
            <p>Click elements to select. Ctrl+Click for multi-select.</p>
          </div>
          <div className="ifc-toolbar-actions">
            <label
              className={`file-upload-btn ${!viewerReady || isLoading ? 'disabled' : ''}`}
            >
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
                {loadingProgress > 0 && loadingProgress < 100 && (
                  <div className="ifc-progress-bar">
                    <div
                      className="ifc-progress-fill"
                      style={{ width: `${loadingProgress}%` }}
                    />
                  </div>
                )}
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
          <span>Left click: Select element</span>
          <span>Ctrl+Click: Multi-select</span>
          <span>Left drag: Rotate</span>
          <span>Right drag: Pan</span>
          <span>Scroll: Zoom</span>
        </div>
      </div>
    );
  }
);
