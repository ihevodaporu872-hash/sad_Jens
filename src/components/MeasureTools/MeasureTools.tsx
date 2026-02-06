import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { IfcViewerRef } from '../../types/ifc';
import './MeasureTools.css';

type MeasureMode = 'distance' | 'area' | 'angle' | null;

interface Measurement {
  id: string;
  type: 'distance' | 'area' | 'angle';
  value: string;
  objects: THREE.Object3D[];
  label: CSS2DObject;
}

export interface MeasureToolsProps {
  viewerRef: React.RefObject<IfcViewerRef | null>;
  active: boolean;
  onClose: () => void;
  className?: string;
}

// Small sphere marker at a clicked point
function createPointMarker(position: THREE.Vector3): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(0.05, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color: 0xff4444, depthTest: false });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.copy(position);
  sphere.renderOrder = 999;
  sphere.userData.__isMeasure = true;
  return sphere;
}

// Create a CSS2D label
function createLabel(text: string, position: THREE.Vector3, cssClass: string): CSS2DObject {
  const div = document.createElement('div');
  div.className = `measure-label ${cssClass}`;
  div.textContent = text;
  const label = new CSS2DObject(div);
  label.position.copy(position);
  label.userData.__isMeasure = true;
  return label;
}

// Create a line between points
function createLine(points: THREE.Vector3[], color: number = 0x00ff88): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    depthTest: false,
    linewidth: 2,
  });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 999;
  line.userData.__isMeasure = true;
  return line;
}

// Create a line loop (closed polygon)
function createLineLoop(points: THREE.Vector3[], color: number = 0x44aaff): THREE.LineLoop {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    depthTest: false,
    linewidth: 2,
  });
  const loop = new THREE.LineLoop(geometry, material);
  loop.renderOrder = 999;
  loop.userData.__isMeasure = true;
  return loop;
}

// Calculate area of polygon using shoelace formula projected to best-fit plane
function calculatePolygonArea(points: THREE.Vector3[]): number {
  if (points.length < 3) return 0;

  // Find the best-fit plane normal using Newell's method
  const normal = new THREE.Vector3();
  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    normal.x += (curr.y - next.y) * (curr.z + next.z);
    normal.y += (curr.z - next.z) * (curr.x + next.x);
    normal.z += (curr.x - next.x) * (curr.y + next.y);
  }
  normal.normalize();

  // If normal is zero (degenerate), try XY projection
  if (normal.lengthSq() < 0.001) {
    normal.set(0, 0, 1);
  }

  // Create a coordinate system on the plane
  const up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(normal.dot(up)) > 0.99) {
    up.set(1, 0, 0);
  }
  const u = new THREE.Vector3().crossVectors(up, normal).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();

  // Project points onto 2D plane
  const projected2D: { x: number; y: number }[] = points.map((p) => ({
    x: p.dot(u),
    y: p.dot(v),
  }));

  // Shoelace formula
  let area = 0;
  for (let i = 0; i < projected2D.length; i++) {
    const j = (i + 1) % projected2D.length;
    area += projected2D[i].x * projected2D[j].y;
    area -= projected2D[j].x * projected2D[i].y;
  }
  return Math.abs(area) / 2;
}

// Calculate centroid of points
function centroid(points: THREE.Vector3[]): THREE.Vector3 {
  const c = new THREE.Vector3();
  for (const p of points) {
    c.add(p);
  }
  c.divideScalar(points.length);
  return c;
}

let measureIdCounter = 0;
function nextMeasureId(): string {
  return `measure_${++measureIdCounter}`;
}

export function MeasureTools({ viewerRef, active, onClose, className }: MeasureToolsProps) {
  const [mode, setMode] = useState<MeasureMode>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [tempPoints, setTempPoints] = useState<THREE.Vector3[]>([]);
  const [statusText, setStatusText] = useState('');

  // Drag-to-move state
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelDragging = useRef(false);
  const panelDragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const panelDidDrag = useRef(false);

  const handlePanelDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    panelDragging.current = true;
    panelDidDrag.current = false;
    panelDragStart.current = {
      x: e.clientX,
      y: e.clientY,
      px: rect.left,
      py: rect.top,
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!panelDragging.current || !panelDragStart.current) return;
      const dx = ev.clientX - panelDragStart.current.x;
      const dy = ev.clientY - panelDragStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        panelDidDrag.current = true;
      }
      if (panelDidDrag.current) {
        setPanelPosition({
          x: panelDragStart.current.px + dx,
          y: panelDragStart.current.py + dy,
        });
      }
    };

    const onMouseUp = () => {
      panelDragging.current = false;
      panelDragStart.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const measurementsRef = useRef<Measurement[]>([]);
  const tempPointsRef = useRef<THREE.Vector3[]>([]);
  const modeRef = useRef<MeasureMode>(null);
  const tempMarkersRef = useRef<THREE.Object3D[]>([]);
  const tempLineRef = useRef<THREE.Line | null>(null);
  const css2dRendererRef = useRef<CSS2DRenderer | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    measurementsRef.current = measurements;
  }, [measurements]);

  useEffect(() => {
    tempPointsRef.current = tempPoints;
  }, [tempPoints]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Initialize CSS2DRenderer overlay and animation loop
  useEffect(() => {
    if (!active) return;

    const renderer = viewerRef.current?.getRenderer() as THREE.WebGLRenderer | null;
    if (!renderer) return;

    const canvas = renderer.domElement;
    const parent = canvas.parentElement;
    if (!parent) return;

    // Create CSS2DRenderer
    const css2dRenderer = new CSS2DRenderer();
    css2dRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
    css2dRenderer.domElement.style.position = 'absolute';
    css2dRenderer.domElement.style.top = '0';
    css2dRenderer.domElement.style.left = '0';
    css2dRenderer.domElement.style.pointerEvents = 'none';
    css2dRenderer.domElement.style.zIndex = '10';
    css2dRenderer.domElement.classList.add('measure-css2d-overlay');
    parent.style.position = 'relative';
    parent.appendChild(css2dRenderer.domElement);
    css2dRendererRef.current = css2dRenderer;

    // Separate animation loop for CSS2DRenderer
    const animateLabels = () => {
      rafIdRef.current = requestAnimationFrame(animateLabels);
      const scene = viewerRef.current?.getScene() as THREE.Scene | null;
      const camera = viewerRef.current?.getCamera() as THREE.PerspectiveCamera | null;
      if (scene && camera && css2dRendererRef.current) {
        css2dRendererRef.current.setSize(canvas.clientWidth, canvas.clientHeight);
        css2dRendererRef.current.render(scene, camera);
      }
    };
    animateLabels();

    // Handle resize
    const handleResize = () => {
      if (css2dRendererRef.current) {
        css2dRendererRef.current.setSize(canvas.clientWidth, canvas.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (css2dRendererRef.current) {
        css2dRendererRef.current.domElement.remove();
        css2dRendererRef.current = null;
      }
    };
  }, [active, viewerRef]);

  // Raycast helper
  const raycastClick = useCallback(
    (event: MouseEvent): THREE.Vector3 | null => {
      const camera = viewerRef.current?.getCamera() as THREE.PerspectiveCamera | null;
      const renderer = viewerRef.current?.getRenderer() as THREE.WebGLRenderer | null;
      const modelGroup = viewerRef.current?.getModelGroup() as THREE.Group | null;
      if (!camera || !renderer || !modelGroup) return null;

      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(modelGroup.children, true);
      if (intersects.length > 0) {
        return intersects[0].point.clone();
      }
      return null;
    },
    [viewerRef]
  );

  // Clean temp visuals from scene
  const clearTempVisuals = useCallback(() => {
    const scene = viewerRef.current?.getScene() as THREE.Scene | null;
    if (!scene) return;

    for (const obj of tempMarkersRef.current) {
      scene.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) obj.material.dispose();
      }
    }
    tempMarkersRef.current = [];

    if (tempLineRef.current) {
      scene.remove(tempLineRef.current);
      tempLineRef.current.geometry.dispose();
      if (tempLineRef.current.material instanceof THREE.Material) {
        tempLineRef.current.material.dispose();
      }
      tempLineRef.current = null;
    }
  }, [viewerRef]);

  // Add a temp point visual
  const addTempMarker = useCallback(
    (point: THREE.Vector3) => {
      const scene = viewerRef.current?.getScene() as THREE.Scene | null;
      if (!scene) return;

      const marker = createPointMarker(point);
      scene.add(marker);
      tempMarkersRef.current.push(marker);
    },
    [viewerRef]
  );

  // Update temp line preview for area and angle modes
  const updateTempLine = useCallback(
    (points: THREE.Vector3[]) => {
      const scene = viewerRef.current?.getScene() as THREE.Scene | null;
      if (!scene || points.length < 2) return;

      if (tempLineRef.current) {
        scene.remove(tempLineRef.current);
        tempLineRef.current.geometry.dispose();
        if (tempLineRef.current.material instanceof THREE.Material) {
          tempLineRef.current.material.dispose();
        }
      }

      const line = createLine(points, 0xffaa00);
      scene.add(line);
      tempLineRef.current = line;
    },
    [viewerRef]
  );

  // Finalize distance measurement
  const finalizeDistance = useCallback(
    (p1: THREE.Vector3, p2: THREE.Vector3) => {
      const scene = viewerRef.current?.getScene() as THREE.Scene | null;
      if (!scene) return;

      const distance = p1.distanceTo(p2);
      const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

      const marker1 = createPointMarker(p1);
      const marker2 = createPointMarker(p2);
      const line = createLine([p1, p2], 0x00ff88);
      const label = createLabel(`${distance.toFixed(3)} m`, midpoint, 'measure-label-distance');

      scene.add(marker1);
      scene.add(marker2);
      scene.add(line);
      scene.add(label);

      const measurement: Measurement = {
        id: nextMeasureId(),
        type: 'distance',
        value: `${distance.toFixed(3)} m`,
        objects: [marker1, marker2, line],
        label,
      };

      setMeasurements((prev) => [...prev, measurement]);
    },
    [viewerRef]
  );

  // Finalize area measurement
  const finalizeArea = useCallback(
    (points: THREE.Vector3[]) => {
      const scene = viewerRef.current?.getScene() as THREE.Scene | null;
      if (!scene || points.length < 3) return;

      const area = calculatePolygonArea(points);
      const center = centroid(points);

      const markers = points.map((p) => {
        const m = createPointMarker(p);
        scene.add(m);
        return m;
      });

      const loop = createLineLoop(points, 0x44aaff);
      scene.add(loop);

      const label = createLabel(`${area.toFixed(3)} m\u00B2`, center, 'measure-label-area');
      scene.add(label);

      const measurement: Measurement = {
        id: nextMeasureId(),
        type: 'area',
        value: `${area.toFixed(3)} m\u00B2`,
        objects: [...markers, loop],
        label,
      };

      setMeasurements((prev) => [...prev, measurement]);
    },
    [viewerRef]
  );

  // Finalize angle measurement
  const finalizeAngle = useCallback(
    (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      const scene = viewerRef.current?.getScene() as THREE.Scene | null;
      if (!scene) return;

      const ba = new THREE.Vector3().subVectors(a, b);
      const bc = new THREE.Vector3().subVectors(c, b);
      const angleRad = ba.angleTo(bc);
      const angleDeg = THREE.MathUtils.radToDeg(angleRad);

      const markerA = createPointMarker(a);
      const markerB = createPointMarker(b);
      const markerC = createPointMarker(c);
      const lineAB = createLine([a, b], 0xffaa00);
      const lineBC = createLine([b, c], 0xffaa00);

      scene.add(markerA);
      scene.add(markerB);
      scene.add(markerC);
      scene.add(lineAB);
      scene.add(lineBC);

      const label = createLabel(
        `${angleDeg.toFixed(1)}\u00B0`,
        b.clone().add(new THREE.Vector3(0, 0.15, 0)),
        'measure-label-angle'
      );
      scene.add(label);

      const measurement: Measurement = {
        id: nextMeasureId(),
        type: 'angle',
        value: `${angleDeg.toFixed(1)}\u00B0`,
        objects: [markerA, markerB, markerC, lineAB, lineBC],
        label,
      };

      setMeasurements((prev) => [...prev, measurement]);
    },
    [viewerRef]
  );

  // Handle clicks on the viewer canvas
  useEffect(() => {
    if (!active) return;

    const renderer = viewerRef.current?.getRenderer() as THREE.WebGLRenderer | null;
    if (!renderer) return;

    const canvas = renderer.domElement;
    let mouseDownPos: { x: number; y: number } | null = null;

    const onMouseDown = (e: MouseEvent) => {
      mouseDownPos = { x: e.clientX, y: e.clientY };
    };

    const onClick = (e: MouseEvent) => {
      // Ignore drag
      if (mouseDownPos) {
        const dx = e.clientX - mouseDownPos.x;
        const dy = e.clientY - mouseDownPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) return;
      }

      const currentMode = modeRef.current;
      if (!currentMode) return;

      const point = raycastClick(e);
      if (!point) return;

      const currentTempPoints = [...tempPointsRef.current, point];

      if (currentMode === 'distance') {
        addTempMarker(point);
        if (currentTempPoints.length === 1) {
          setTempPoints(currentTempPoints);
          setStatusText('Click second point');
        } else if (currentTempPoints.length >= 2) {
          clearTempVisuals();
          finalizeDistance(currentTempPoints[0], currentTempPoints[1]);
          setTempPoints([]);
          setStatusText('Click first point');
        }
      } else if (currentMode === 'area') {
        addTempMarker(point);
        setTempPoints(currentTempPoints);
        updateTempLine(currentTempPoints);
        if (currentTempPoints.length >= 3) {
          setStatusText(`${currentTempPoints.length} points. Double-click to close polygon.`);
        } else {
          setStatusText(`${currentTempPoints.length} point(s). Click more points (min 3).`);
        }
      } else if (currentMode === 'angle') {
        addTempMarker(point);
        if (currentTempPoints.length < 3) {
          setTempPoints(currentTempPoints);
          if (currentTempPoints.length >= 2) {
            updateTempLine(currentTempPoints);
          }
          const labels = ['Click point A', 'Click vertex B', 'Click point C'];
          setStatusText(labels[currentTempPoints.length] || 'Click point');
        }
        if (currentTempPoints.length >= 3) {
          clearTempVisuals();
          finalizeAngle(currentTempPoints[0], currentTempPoints[1], currentTempPoints[2]);
          setTempPoints([]);
          setStatusText('Click point A');
        }
      }
    };

    const onDblClick = (e: MouseEvent) => {
      const currentMode = modeRef.current;
      if (currentMode !== 'area') return;

      e.preventDefault();
      e.stopPropagation();

      const currentTempPoints = tempPointsRef.current;
      if (currentTempPoints.length >= 3) {
        clearTempVisuals();
        finalizeArea([...currentTempPoints]);
        setTempPoints([]);
        setStatusText('Click first point of polygon');
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('dblclick', onDblClick);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('dblclick', onDblClick);
    };
  }, [
    active,
    viewerRef,
    raycastClick,
    addTempMarker,
    clearTempVisuals,
    updateTempLine,
    finalizeDistance,
    finalizeArea,
    finalizeAngle,
  ]);

  // Reset temp state when mode changes
  useEffect(() => {
    clearTempVisuals();
    setTempPoints([]);

    if (mode === 'distance') {
      setStatusText('Click first point');
    } else if (mode === 'area') {
      setStatusText('Click first point of polygon');
    } else if (mode === 'angle') {
      setStatusText('Click point A');
    } else {
      setStatusText('');
    }
  }, [mode, clearTempVisuals]);

  // Cleanup when component deactivates
  useEffect(() => {
    if (!active) {
      clearTempVisuals();
      setMode(null);
      setTempPoints([]);
      setStatusText('');
    }
  }, [active, clearTempVisuals]);

  // Clear all measurements
  const handleClearAll = useCallback(() => {
    const scene = viewerRef.current?.getScene() as THREE.Scene | null;
    if (!scene) return;

    for (const m of measurementsRef.current) {
      for (const obj of m.objects) {
        scene.remove(obj);
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (obj.material instanceof THREE.Material) obj.material.dispose();
        }
        if (obj instanceof THREE.Line) {
          obj.geometry.dispose();
          if (obj.material instanceof THREE.Material) obj.material.dispose();
        }
      }
      scene.remove(m.label);
    }

    clearTempVisuals();
    setMeasurements([]);
    setTempPoints([]);
    if (mode) {
      if (mode === 'distance') setStatusText('Click first point');
      else if (mode === 'area') setStatusText('Click first point of polygon');
      else if (mode === 'angle') setStatusText('Click point A');
    }
  }, [viewerRef, clearTempVisuals, mode]);

  // Remove a single measurement
  const handleRemoveMeasurement = useCallback(
    (id: string) => {
      const scene = viewerRef.current?.getScene() as THREE.Scene | null;
      if (!scene) return;

      setMeasurements((prev) => {
        const target = prev.find((m) => m.id === id);
        if (target) {
          for (const obj of target.objects) {
            scene.remove(obj);
            if (obj instanceof THREE.Mesh) {
              obj.geometry.dispose();
              if (obj.material instanceof THREE.Material) obj.material.dispose();
            }
            if (obj instanceof THREE.Line) {
              obj.geometry.dispose();
              if (obj.material instanceof THREE.Material) obj.material.dispose();
            }
          }
          scene.remove(target.label);
        }
        return prev.filter((m) => m.id !== id);
      });
    },
    [viewerRef]
  );

  if (!active) return null;

  const measurePanelStyle: React.CSSProperties = panelPosition
    ? { position: 'fixed', left: panelPosition.x, top: panelPosition.y, bottom: 'auto', transform: 'none' }
    : {};

  return (
    <div ref={panelRef} className={`measure-tools ${className || ''}`} style={measurePanelStyle}>
      {/* Toolbar — draggable via header area */}
      <div className="measure-toolbar" onMouseDown={handlePanelDragStart} style={{ cursor: 'grab' }}>
        <button
          className={`measure-btn ${mode === 'distance' ? 'measure-btn-active' : ''}`}
          onClick={() => setMode(mode === 'distance' ? null : 'distance')}
          title="Measure distance between two points"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <line x1="4" y1="20" x2="20" y2="4" />
            <circle cx="4" cy="20" r="2" />
            <circle cx="20" cy="4" r="2" />
          </svg>
          <span>Distance</span>
        </button>

        <button
          className={`measure-btn ${mode === 'area' ? 'measure-btn-active' : ''}`}
          onClick={() => setMode(mode === 'area' ? null : 'area')}
          title="Measure area of polygon"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <polygon points="4,20 12,4 20,20" />
          </svg>
          <span>Area</span>
        </button>

        <button
          className={`measure-btn ${mode === 'angle' ? 'measure-btn-active' : ''}`}
          onClick={() => setMode(mode === 'angle' ? null : 'angle')}
          title="Measure angle between three points"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <polyline points="4,20 12,6 20,20" />
            <path d="M8 16 Q12 12, 16 16" />
          </svg>
          <span>Angle</span>
        </button>

        <div className="measure-separator" />

        <button
          className="measure-btn"
          onClick={handleClearAll}
          title="Clear all measurements"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-2 14H7L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
          <span>Clear All</span>
        </button>

        <button
          className="measure-btn measure-btn-close"
          onClick={onClose}
          title="Close measure tools"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <span>Close</span>
        </button>
      </div>

      {/* Status text */}
      {statusText && (
        <div className="measure-status">{statusText}</div>
      )}

      {/* Measurements list */}
      {measurements.length > 0 && (
        <div className="measure-list">
          <div className="measure-list-header">Measurements</div>
          {measurements.map((m) => (
            <div key={m.id} className="measure-list-item">
              <span className={`measure-list-icon measure-list-icon-${m.type}`}>
                {m.type === 'distance' ? '\u2194' : m.type === 'area' ? '\u25B3' : '\u2220'}
              </span>
              <span className="measure-list-value">{m.value}</span>
              <button
                className="measure-list-remove"
                onClick={() => handleRemoveMeasurement(m.id)}
                title="Remove measurement"
              >
                \u00D7
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
