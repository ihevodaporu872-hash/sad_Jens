import { useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import type { IfcViewerRef } from '../../types/ifc';
import type { Viewpoint, ViewpointData } from '../../types/ifc';
import * as supabaseApi from '../../services/supabaseService';
import './Viewpoints.css';

interface ViewpointsProps {
  viewerRef: React.RefObject<IfcViewerRef | null>;
  supabaseModelId: string | null;
  className?: string;
}

export function Viewpoints({ viewerRef, supabaseModelId, className }: ViewpointsProps) {
  const [viewpoints, setViewpoints] = useState<Viewpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [activeViewpointId, setActiveViewpointId] = useState<string | null>(null);

  // Load viewpoints on mount / model change
  useEffect(() => {
    if (!supabaseModelId) return;
    setLoading(true);
    supabaseApi
      .getViewpoints(supabaseModelId)
      .then((data) => setViewpoints(data))
      .catch((err) => console.warn('[Viewpoints] Failed to load:', err))
      .finally(() => setLoading(false));
  }, [supabaseModelId]);

  // ── Capture thumbnail from renderer ────────────────────────────
  const captureThumbnail = useCallback((): string | undefined => {
    const viewer = viewerRef.current;
    if (!viewer) return undefined;

    const renderer = viewer.getRenderer() as THREE.WebGLRenderer | null;
    if (!renderer) return undefined;

    const canvas = renderer.domElement;
    // Create a smaller canvas for the thumbnail
    const thumbWidth = 200;
    const thumbHeight = Math.round((canvas.height / canvas.width) * thumbWidth);

    const offscreen = document.createElement('canvas');
    offscreen.width = thumbWidth;
    offscreen.height = thumbHeight;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return undefined;

    ctx.drawImage(canvas, 0, 0, thumbWidth, thumbHeight);
    return offscreen.toDataURL('image/jpeg', 0.5);
  }, [viewerRef]);

  // ── Read current camera state ──────────────────────────────────
  const readCameraState = useCallback((): {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  } | null => {
    const viewer = viewerRef.current;
    if (!viewer) return null;

    const camera = viewer.getCamera() as THREE.PerspectiveCamera | null;
    const controls = viewer.getControls() as { target?: THREE.Vector3 } | null;
    if (!camera) return null;

    const position = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    const target = controls?.target
      ? { x: controls.target.x, y: controls.target.y, z: controls.target.z }
      : { x: 0, y: 0, z: 0 };

    return { position, target };
  }, [viewerRef]);

  // ── Read current clipping planes ───────────────────────────────
  const readClippingPlanes = useCallback((): ViewpointData['clippingPlanes'] => {
    const viewer = viewerRef.current;
    if (!viewer) return [];

    const renderer = viewer.getRenderer() as THREE.WebGLRenderer | null;
    if (!renderer || !renderer.clippingPlanes || renderer.clippingPlanes.length === 0) return [];

    const result: ViewpointData['clippingPlanes'] = [];
    for (const plane of renderer.clippingPlanes) {
      // Determine axis from normal
      const n = plane.normal;
      let axis: 'x' | 'y' | 'z';
      if (Math.abs(n.x) > Math.abs(n.y) && Math.abs(n.x) > Math.abs(n.z)) {
        axis = 'x';
      } else if (Math.abs(n.y) > Math.abs(n.z)) {
        axis = 'y';
      } else {
        axis = 'z';
      }
      result.push({ axis, constant: plane.constant });
    }
    return result;
  }, [viewerRef]);

  // ── Save current viewpoint ─────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!supabaseModelId || !newName.trim()) return;

    const cameraState = readCameraState();
    if (!cameraState) return;

    setSaving(true);
    try {
      const thumbnail = captureThumbnail();
      const clippingPlanes = readClippingPlanes();

      const input: ViewpointData = {
        name: newName.trim(),
        cameraPosition: cameraState.position,
        cameraTarget: cameraState.target,
        hiddenExpressIds: [],  // Could be extended to track hidden elements
        coloredElements: [],   // Could be extended to track colored elements
        clippingPlanes,
        thumbnail,
      };

      const created = await supabaseApi.createViewpoint(supabaseModelId, input);
      setViewpoints((prev) => [created, ...prev]);
      setNewName('');
      setShowNameInput(false);
    } catch (err) {
      console.error('[Viewpoints] Failed to save:', err);
    } finally {
      setSaving(false);
    }
  }, [supabaseModelId, newName, readCameraState, captureThumbnail, readClippingPlanes]);

  // ── Restore a viewpoint ────────────────────────────────────────
  const handleRestore = useCallback(
    (vp: Viewpoint) => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      setActiveViewpointId(vp.id);

      // 1. Set camera position and target
      const camera = viewer.getCamera() as THREE.PerspectiveCamera | null;
      const controls = viewer.getControls() as {
        target?: THREE.Vector3;
        update?: () => void;
      } | null;

      if (camera) {
        camera.position.set(vp.cameraPosition.x, vp.cameraPosition.y, vp.cameraPosition.z);
      }
      if (controls?.target) {
        controls.target.set(vp.cameraTarget.x, vp.cameraTarget.y, vp.cameraTarget.z);
      }
      if (controls?.update) {
        controls.update();
      }

      // 2. Reset visibility then apply hidden elements
      viewer.showAll();
      if (vp.hiddenExpressIds.length > 0) {
        viewer.hideElements(vp.hiddenExpressIds);
      }

      // 3. Reset colors then apply colored elements
      viewer.resetColors();
      for (const ce of vp.coloredElements) {
        if (ce.expressIds.length > 0) {
          viewer.colorElements(ce.expressIds, ce.color);
        }
      }

      // 4. Apply clipping planes
      const renderer = viewer.getRenderer() as THREE.WebGLRenderer | null;
      if (renderer) {
        if (vp.clippingPlanes.length > 0) {
          const AXIS_NORMALS: Record<string, THREE.Vector3> = {
            x: new THREE.Vector3(-1, 0, 0),
            y: new THREE.Vector3(0, -1, 0),
            z: new THREE.Vector3(0, 0, -1),
          };
          const threePlanes = vp.clippingPlanes.map((cp) => {
            const normal = (AXIS_NORMALS[cp.axis] || new THREE.Vector3(0, 0, -1)).clone();
            return new THREE.Plane(normal, cp.constant);
          });
          renderer.clippingPlanes = threePlanes;
          renderer.localClippingEnabled = true;
        } else {
          renderer.clippingPlanes = [];
          renderer.localClippingEnabled = false;
        }
      }
    },
    [viewerRef]
  );

  // ── Delete a viewpoint ─────────────────────────────────────────
  const handleDelete = useCallback(
    async (e: React.MouseEvent, vpId: string) => {
      e.stopPropagation();
      try {
        await supabaseApi.deleteViewpoint(vpId);
        setViewpoints((prev) => prev.filter((v) => v.id !== vpId));
        if (activeViewpointId === vpId) {
          setActiveViewpointId(null);
        }
      } catch (err) {
        console.error('[Viewpoints] Failed to delete:', err);
      }
    },
    [activeViewpointId]
  );

  // ── Cancel name input ──────────────────────────────────────────
  const handleCancelSave = useCallback(() => {
    setShowNameInput(false);
    setNewName('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancelSave();
      }
    },
    [handleSave, handleCancelSave]
  );

  return (
    <div className={`viewpoints ${className || ''}`}>
      <div className="viewpoints-header">
        <h3>Viewpoints</h3>
        {!showNameInput ? (
          <button
            className="viewpoints-save-btn"
            onClick={() => setShowNameInput(true)}
            disabled={!supabaseModelId}
            title="Save current view"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Save View
          </button>
        ) : (
          <div className="viewpoints-name-input-row">
            <input
              className="viewpoints-name-input"
              type="text"
              placeholder="Viewpoint name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              disabled={saving}
            />
            <button
              className="viewpoints-confirm-btn"
              onClick={handleSave}
              disabled={saving || !newName.trim()}
              title="Confirm save"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
            <button
              className="viewpoints-cancel-btn"
              onClick={handleCancelSave}
              disabled={saving}
              title="Cancel"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="viewpoints-list">
        {loading && (
          <div className="viewpoints-empty">
            <p>Loading viewpoints...</p>
          </div>
        )}

        {!loading && viewpoints.length === 0 && (
          <div className="viewpoints-empty">
            <svg
              className="viewpoints-empty-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M15 10l-4 4l6 6l4-16l-18 7l4 2l2 6l3-4" />
            </svg>
            <p>No saved viewpoints</p>
            <span className="viewpoints-empty-hint">
              Save the current camera view to quickly return to it later
            </span>
          </div>
        )}

        {viewpoints.map((vp) => (
          <div
            key={vp.id}
            className={`viewpoints-card ${activeViewpointId === vp.id ? 'active' : ''}`}
            onClick={() => handleRestore(vp)}
            title={`Restore: ${vp.name}`}
          >
            <div className="viewpoints-card-thumb">
              {vp.thumbnail ? (
                <img src={vp.thumbnail} alt={vp.name} />
              ) : (
                <div className="viewpoints-card-no-thumb">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
                    <rect x="2" y="2" width="20" height="20" rx="2" />
                    <circle cx="8" cy="8" r="2" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
              )}
            </div>
            <div className="viewpoints-card-info">
              <span className="viewpoints-card-name">{vp.name}</span>
              <span className="viewpoints-card-meta">
                {vp.clippingPlanes.length > 0 && (
                  <span className="viewpoints-badge" title="Has clipping planes">clip</span>
                )}
                {vp.hiddenExpressIds.length > 0 && (
                  <span className="viewpoints-badge" title="Has hidden elements">hide</span>
                )}
                {vp.coloredElements.length > 0 && (
                  <span className="viewpoints-badge" title="Has colored elements">color</span>
                )}
              </span>
            </div>
            <button
              className="viewpoints-delete-btn"
              onClick={(e) => handleDelete(e, vp.id)}
              title="Delete viewpoint"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
