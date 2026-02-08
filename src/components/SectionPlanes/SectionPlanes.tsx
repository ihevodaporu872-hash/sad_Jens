import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import type { IfcViewerRef } from '../../types/ifc';
import './SectionPlanes.css';

interface SectionPlanesProps {
  viewerRef: React.RefObject<IfcViewerRef | null>;
  className?: string;
}

type Axis = 'x' | 'y' | 'z';

interface PlaneState {
  active: boolean;
  plane: THREE.Plane | null;
  offset: number;
  min: number;
  max: number;
}

interface BoxClipState {
  active: boolean;
  planes: THREE.Plane[];
  offsets: { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number };
  bounds: { min: THREE.Vector3; max: THREE.Vector3 } | null;
}

const AXIS_NORMALS: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(-1, 0, 0),
  y: new THREE.Vector3(0, -1, 0),
  z: new THREE.Vector3(0, 0, -1),
};

const AXIS_LABELS: Record<Axis, string> = {
  x: 'X Plane',
  y: 'Y Plane',
  z: 'Z Plane',
};

export function SectionPlanes({ viewerRef, className }: SectionPlanesProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const didDrag = useRef(false);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    isDragging.current = true;
    didDrag.current = false;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      px: rect.left,
      py: rect.top,
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !dragStart.current) return;
      const dx = ev.clientX - dragStart.current.x;
      const dy = ev.clientY - dragStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didDrag.current = true;
      }
      if (didDrag.current) {
        setPosition({
          x: dragStart.current.px + dx,
          y: dragStart.current.py + dy,
        });
      }
    };

    const onMouseUp = () => {
      isDragging.current = false;
      dragStart.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const [planes, setPlanes] = useState<Record<Axis, PlaneState>>({
    x: { active: false, plane: null, offset: 0, min: -50, max: 50 },
    y: { active: false, plane: null, offset: 0, min: -50, max: 50 },
    z: { active: false, plane: null, offset: 0, min: -50, max: 50 },
  });
  const [boxClip, setBoxClip] = useState<BoxClipState>({
    active: false,
    planes: [],
    offsets: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0 },
    bounds: null,
  });

  const planesRef = useRef(planes);
  const boxClipRef = useRef(boxClip);

  useEffect(() => {
    planesRef.current = planes;
  }, [planes]);

  useEffect(() => {
    boxClipRef.current = boxClip;
  }, [boxClip]);

  // Compute model bounding box for slider ranges
  const getModelBounds = useCallback((): { min: THREE.Vector3; max: THREE.Vector3 } | null => {
    const viewer = viewerRef.current;
    if (!viewer) return null;

    const modelGroup = viewer.getModelGroup() as THREE.Group | null;
    if (!modelGroup || modelGroup.children.length === 0) return null;

    const box = new THREE.Box3().setFromObject(modelGroup);
    if (box.isEmpty()) return null;

    // Add some padding
    const size = box.getSize(new THREE.Vector3());
    const padding = size.length() * 0.1;
    box.min.subScalar(padding);
    box.max.addScalar(padding);

    return { min: box.min.clone(), max: box.max.clone() };
  }, [viewerRef]);

  // Get the renderer and enable/disable local clipping
  const getRenderer = useCallback((): THREE.WebGLRenderer | null => {
    const viewer = viewerRef.current;
    if (!viewer) return null;
    return viewer.getRenderer() as THREE.WebGLRenderer | null;
  }, [viewerRef]);

  // Sync all active planes to the renderer's clippingPlanes array
  const syncClippingPlanes = useCallback(() => {
    const renderer = getRenderer();
    if (!renderer) return;

    const activePlanes: THREE.Plane[] = [];

    // Individual axis planes
    const currentPlanes = planesRef.current;
    for (const axis of ['x', 'y', 'z'] as Axis[]) {
      const state = currentPlanes[axis];
      if (state.active && state.plane) {
        activePlanes.push(state.plane);
      }
    }

    // Box clip planes
    const currentBox = boxClipRef.current;
    if (currentBox.active) {
      for (const p of currentBox.planes) {
        activePlanes.push(p);
      }
    }

    renderer.clippingPlanes = activePlanes;
    renderer.localClippingEnabled = activePlanes.length > 0;
  }, [getRenderer]);

  // Toggle an individual axis plane
  const togglePlane = useCallback(
    (axis: Axis) => {
      setPlanes((prev) => {
        const state = prev[axis];

        if (state.active) {
          // Deactivate
          return {
            ...prev,
            [axis]: { ...state, active: false, plane: null },
          };
        }

        // Activate: compute bounds
        const bounds = getModelBounds();
        const normal = AXIS_NORMALS[axis].clone();
        let min: number, max: number, offset: number;

        if (bounds) {
          const axisKey = axis as 'x' | 'y' | 'z';
          min = bounds.min[axisKey];
          max = bounds.max[axisKey];
          offset = max; // start at the max (plane doesn't clip anything initially)
        } else {
          min = -50;
          max = 50;
          offset = max;
        }

        const plane = new THREE.Plane(normal, offset);

        return {
          ...prev,
          [axis]: { active: true, plane, offset, min, max },
        };
      });
    },
    [getModelBounds]
  );

  // Update slider offset for individual axis plane
  const updatePlaneOffset = useCallback((axis: Axis, offset: number) => {
    // Direct mutation for instant visual feedback
    const state = planesRef.current[axis];
    if (state.active && state.plane) {
      state.plane.constant = offset;
    }

    // Debounced React state update for UI display
    setPlanes((prev) => {
      const s = prev[axis];
      if (!s.active || !s.plane) return prev;
      return { ...prev, [axis]: { ...s, offset } };
    });
  }, []);

  // Toggle box clip mode
  const toggleBoxClip = useCallback(() => {
    setBoxClip((prev) => {
      if (prev.active) {
        // Deactivate
        return {
          active: false,
          planes: [],
          offsets: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0 },
          bounds: null,
        };
      }

      // Activate
      const bounds = getModelBounds();
      if (!bounds) {
        return prev;
      }

      // Create 6 planes forming a box
      // +X face: normal (-1,0,0), clips x < offset
      // -X face: normal (1,0,0), clips x > offset
      // Same for Y and Z
      const xMinPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -bounds.min.x);
      const xMaxPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), bounds.max.x);
      const yMinPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -bounds.min.y);
      const yMaxPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), bounds.max.y);
      const zMinPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -bounds.min.z);
      const zMaxPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), bounds.max.z);

      return {
        active: true,
        planes: [xMinPlane, xMaxPlane, yMinPlane, yMaxPlane, zMinPlane, zMaxPlane],
        offsets: {
          xMin: bounds.min.x,
          xMax: bounds.max.x,
          yMin: bounds.min.y,
          yMax: bounds.max.y,
          zMin: bounds.min.z,
          zMax: bounds.max.z,
        },
        bounds,
      };
    });
  }, [getModelBounds]);

  // Update box clip slider
  const updateBoxOffset = useCallback(
    (face: 'xMin' | 'xMax' | 'yMin' | 'yMax' | 'zMin' | 'zMax', value: number) => {
      // Direct plane mutation for instant visual
      const current = boxClipRef.current;
      if (current.active && current.planes.length >= 6) {
        const newOffsets = { ...current.offsets, [face]: value };
        current.planes[0].constant = -newOffsets.xMin;
        current.planes[1].constant = newOffsets.xMax;
        current.planes[2].constant = -newOffsets.yMin;
        current.planes[3].constant = newOffsets.yMax;
        current.planes[4].constant = -newOffsets.zMin;
        current.planes[5].constant = newOffsets.zMax;
      }

      setBoxClip((prev) => {
        if (!prev.active || prev.planes.length < 6) return prev;
        const newOffsets = { ...prev.offsets, [face]: value };
        return { ...prev, offsets: newOffsets };
      });
    },
    []
  );

  // Clear everything
  const clearAll = useCallback(() => {
    setPlanes({
      x: { active: false, plane: null, offset: 0, min: -50, max: 50 },
      y: { active: false, plane: null, offset: 0, min: -50, max: 50 },
      z: { active: false, plane: null, offset: 0, min: -50, max: 50 },
    });
    setBoxClip({
      active: false,
      planes: [],
      offsets: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0 },
      bounds: null,
    });

    const renderer = getRenderer();
    if (renderer) {
      renderer.clippingPlanes = [];
      renderer.localClippingEnabled = false;
    }
  }, [getRenderer]);

  // Sync clipping planes whenever state changes
  useEffect(() => {
    syncClippingPlanes();
  }, [planes, boxClip, syncClippingPlanes]);

  // Cleanup on unmount: remove clipping planes from renderer
  useEffect(() => {
    return () => {
      const renderer = getRenderer();
      if (renderer) {
        renderer.clippingPlanes = [];
        renderer.localClippingEnabled = false;
      }
    };
  }, [getRenderer]);

  const hasAnyActive = planes.x.active || planes.y.active || planes.z.active || boxClip.active;

  const formatValue = (val: number): string => {
    return Math.abs(val) < 0.01 ? '0' : val.toFixed(2);
  };

  const panelStyle: React.CSSProperties = position
    ? { position: 'fixed', left: position.x, top: position.y, right: 'auto' }
    : {};

  return (
    <div ref={panelRef} className={`section-planes ${className || ''}`} style={panelStyle}>
      <div
        className="section-planes-header"
        onMouseDown={handleDragStart}
        onClick={() => {
          if (!didDrag.current) {
            setCollapsed(!collapsed);
          }
        }}
        style={{ cursor: 'grab' }}
      >
        <div className="section-planes-title">
          <svg
            className="section-planes-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 20L20 4" />
            <path d="M4 4v16h16" />
            <path d="M8 16l4-4 4-4" strokeDasharray="2 2" />
          </svg>
          <span>Section Planes</span>
        </div>
        <svg
          className={`section-planes-chevron ${collapsed ? '' : 'open'}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {!collapsed && (
        <div className="section-planes-body">
          {/* Individual axis planes */}
          {(['x', 'y', 'z'] as Axis[]).map((axis) => {
            const state = planes[axis];
            return (
              <div key={axis} className="section-plane-row">
                <button
                  className={`section-plane-toggle ${state.active ? 'active' : ''}`}
                  onClick={() => togglePlane(axis)}
                  title={`Toggle ${AXIS_LABELS[axis]}`}
                >
                  <span className={`section-plane-axis axis-${axis}`}>
                    {axis.toUpperCase()}
                  </span>
                  <span className="section-plane-label">{AXIS_LABELS[axis]}</span>
                </button>
                {state.active && (
                  <div className="section-plane-slider-wrap">
                    <input
                      type="range"
                      className="section-plane-slider"
                      min={state.min}
                      max={state.max}
                      step={(state.max - state.min) / 200}
                      value={state.offset}
                      onChange={(e) => updatePlaneOffset(axis, parseFloat(e.target.value))}
                    />
                    <span className="section-plane-value">{formatValue(state.offset)}</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Separator */}
          <div className="section-planes-divider" />

          {/* Box clip toggle */}
          <div className="section-plane-row">
            <button
              className={`section-plane-toggle box-clip-toggle ${boxClip.active ? 'active' : ''}`}
              onClick={toggleBoxClip}
              title="Toggle box clipping (6 planes)"
            >
              <svg
                className="box-clip-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="1" strokeDasharray="4 2" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="12" y1="3" x2="12" y2="21" />
              </svg>
              <span className="section-plane-label">Box Clip</span>
            </button>
          </div>

          {/* Box clip sliders */}
          {boxClip.active && boxClip.bounds && (
            <div className="box-clip-sliders">
              {([
                { face: 'xMin' as const, label: 'X Min', axis: 'x' as const },
                { face: 'xMax' as const, label: 'X Max', axis: 'x' as const },
                { face: 'yMin' as const, label: 'Y Min', axis: 'y' as const },
                { face: 'yMax' as const, label: 'Y Max', axis: 'y' as const },
                { face: 'zMin' as const, label: 'Z Min', axis: 'z' as const },
                { face: 'zMax' as const, label: 'Z Max', axis: 'z' as const },
              ]).map(({ face, label, axis }) => (
                <div key={face} className="box-clip-slider-row">
                  <span className={`box-clip-label axis-${axis}`}>{label}</span>
                  <input
                    type="range"
                    className="section-plane-slider"
                    min={boxClip.bounds!.min[axis]}
                    max={boxClip.bounds!.max[axis]}
                    step={(boxClip.bounds!.max[axis] - boxClip.bounds!.min[axis]) / 200}
                    value={boxClip.offsets[face]}
                    onChange={(e) => updateBoxOffset(face, parseFloat(e.target.value))}
                  />
                  <span className="section-plane-value">{formatValue(boxClip.offsets[face])}</span>
                </div>
              ))}
            </div>
          )}

          {/* Clear All */}
          {hasAnyActive && (
            <>
              <div className="section-planes-divider" />
              <button className="section-planes-clear" onClick={clearAll}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="clear-icon"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Clear All
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
