import { useState, useRef, useCallback, useEffect } from 'react';
import { IfcViewer } from '../IfcViewer';
import { PropertiesPanel } from '../PropertiesPanel';
import { WorksetsWidget } from '../WorksetsWidget';
import { getElementProperties } from '../../utils/ifcProperties';
import * as worksetApi from '../../services/worksetService';
import type {
  IfcViewerRef,
  IfcElementInfo,
  ElementSelection,
  Workset,
} from '../../types/ifc';
import './ModelViewerPage.css';

// Use a fixed model ID for now (could be dynamic from URL params later)
const MODEL_ID = 'default';

export function ModelViewerPage() {
  const viewerRef = useRef<IfcViewerRef>(null);

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Properties panel state
  const [elementInfo, setElementInfo] = useState<IfcElementInfo | null>(null);

  // Selection state
  const [selectedExpressIds, setSelectedExpressIds] = useState<number[]>([]);

  // Worksets state
  const [worksets, setWorksets] = useState<Workset[]>([]);
  const [selectedWorksetId, setSelectedWorksetId] = useState<string | null>(null);

  // Load worksets on mount
  useEffect(() => {
    loadWorksets();
  }, []);

  const loadWorksets = async () => {
    try {
      const data = await worksetApi.getWorksets(MODEL_ID);
      setWorksets(data);
    } catch (err) {
      // Server may not be running — that's OK for now
      console.warn('[Worksets] Failed to load worksets:', err);
    }
  };

  // ── Viewer callbacks ──────────────────────────────────────────

  const handleElementSelected = useCallback(
    (selection: ElementSelection | null) => {
      if (!selection) {
        setElementInfo(null);
        return;
      }

      // Get properties from web-ifc
      const ifcApi = viewerRef.current?.getIfcApi();
      const modelId = viewerRef.current?.getModelId();
      if (ifcApi && modelId !== null && modelId !== undefined) {
        const info = getElementProperties(ifcApi, modelId, selection.expressId);
        setElementInfo(info);
      }
    },
    []
  );

  const handleSelectionChanged = useCallback(
    (selections: ElementSelection[]) => {
      setSelectedExpressIds(selections.map((s) => s.expressId));
    },
    []
  );

  // ── Workset handlers ──────────────────────────────────────────

  const handleCreateWorkset = useCallback(async () => {
    const ids = viewerRef.current?.getSelectedExpressIds() ?? [];
    if (ids.length === 0) return;

    try {
      const ws = await worksetApi.createWorkset(MODEL_ID, {
        name: `Workset ${worksets.length + 1}`,
        color: '#FF8800',
        opacity: 0.5,
        elementIds: { expressIds: ids, globalIds: [] },
      });
      setWorksets((prev) => [...prev, ws]);
    } catch (err) {
      console.error('[Worksets] Failed to create:', err);
    }
  }, [worksets.length]);

  const handleDeleteWorkset = useCallback(async (worksetId: string) => {
    try {
      await worksetApi.deleteWorkset(MODEL_ID, worksetId);
      setWorksets((prev) => prev.filter((w) => w.id !== worksetId));
      viewerRef.current?.clearHighlight(worksetId);
      if (selectedWorksetId === worksetId) {
        viewerRef.current?.clearOthersWireframe();
        setSelectedWorksetId(null);
      }
    } catch (err) {
      console.error('[Worksets] Failed to delete:', err);
    }
  }, [selectedWorksetId]);

  const handleRenameWorkset = useCallback(async (worksetId: string, newName: string) => {
    try {
      const updated = await worksetApi.updateWorkset(MODEL_ID, worksetId, { name: newName });
      setWorksets((prev) => prev.map((w) => (w.id === worksetId ? updated : w)));
    } catch (err) {
      console.error('[Worksets] Failed to rename:', err);
    }
  }, []);

  const handleColorChange = useCallback(async (worksetId: string, color: string) => {
    try {
      const updated = await worksetApi.updateWorkset(MODEL_ID, worksetId, { color });
      setWorksets((prev) => prev.map((w) => (w.id === worksetId ? updated : w)));

      // If this workset is currently highlighted, re-apply with new color
      if (selectedWorksetId === worksetId) {
        const ws = worksets.find((w) => w.id === worksetId);
        if (ws) {
          viewerRef.current?.clearHighlight(worksetId);
          viewerRef.current?.clearOthersWireframe();
          viewerRef.current?.highlightElements(worksetId, ws.elementIds.expressIds, color, ws.opacity);
          viewerRef.current?.setOthersWireframe(ws.elementIds.expressIds);
        }
      }
    } catch (err) {
      console.error('[Worksets] Failed to update color:', err);
    }
  }, [selectedWorksetId, worksets]);

  const handleOpacityChange = useCallback(async (worksetId: string, opacity: number) => {
    try {
      const updated = await worksetApi.updateWorkset(MODEL_ID, worksetId, { opacity });
      setWorksets((prev) => prev.map((w) => (w.id === worksetId ? updated : w)));

      if (selectedWorksetId === worksetId) {
        const ws = worksets.find((w) => w.id === worksetId);
        if (ws) {
          viewerRef.current?.clearHighlight(worksetId);
          viewerRef.current?.clearOthersWireframe();
          viewerRef.current?.highlightElements(worksetId, ws.elementIds.expressIds, ws.color, opacity);
          viewerRef.current?.setOthersWireframe(ws.elementIds.expressIds);
        }
      }
    } catch (err) {
      console.error('[Worksets] Failed to update opacity:', err);
    }
  }, [selectedWorksetId, worksets]);

  const handleWorksetClick = useCallback((workset: Workset) => {
    // Clear previous workset highlight and wireframe
    if (selectedWorksetId) {
      viewerRef.current?.clearHighlight(selectedWorksetId);
      viewerRef.current?.clearOthersWireframe();
    }

    if (selectedWorksetId === workset.id) {
      // Deselect — restore normal view
      setSelectedWorksetId(null);
    } else {
      setSelectedWorksetId(workset.id);
      // Highlight workset elements with color
      viewerRef.current?.highlightElements(
        workset.id,
        workset.elementIds.expressIds,
        workset.color,
        workset.opacity
      );
      // All OTHER elements become wireframe for clarity
      viewerRef.current?.setOthersWireframe(workset.elementIds.expressIds);
    }
  }, [selectedWorksetId]);

  const handleAddElementsToWorkset = useCallback(async (worksetId: string) => {
    const ids = viewerRef.current?.getSelectedExpressIds() ?? [];
    if (ids.length === 0) return;

    const ws = worksets.find((w) => w.id === worksetId);
    if (!ws) return;

    const merged = Array.from(new Set([...ws.elementIds.expressIds, ...ids]));
    try {
      const updated = await worksetApi.updateWorkset(MODEL_ID, worksetId, {
        elementIds: { expressIds: merged, globalIds: ws.elementIds.globalIds },
      });
      setWorksets((prev) => prev.map((w) => (w.id === worksetId ? updated : w)));
    } catch (err) {
      console.error('[Worksets] Failed to add elements:', err);
    }
  }, [worksets]);

  const handleRemoveElementsFromWorkset = useCallback(async (worksetId: string) => {
    const ids = viewerRef.current?.getSelectedExpressIds() ?? [];
    if (ids.length === 0) return;

    const ws = worksets.find((w) => w.id === worksetId);
    if (!ws) return;

    const removeSet = new Set(ids);
    const remaining = ws.elementIds.expressIds.filter((eid) => !removeSet.has(eid));
    try {
      const updated = await worksetApi.updateWorkset(MODEL_ID, worksetId, {
        elementIds: { expressIds: remaining, globalIds: ws.elementIds.globalIds },
      });
      setWorksets((prev) => prev.map((w) => (w.id === worksetId ? updated : w)));

      // Re-apply highlight if active
      if (selectedWorksetId === worksetId) {
        viewerRef.current?.clearHighlight(worksetId);
        viewerRef.current?.highlightElements(worksetId, remaining, ws.color, ws.opacity);
      }
    } catch (err) {
      console.error('[Worksets] Failed to remove elements:', err);
    }
  }, [worksets, selectedWorksetId]);

  return (
    <div className="model-viewer-page">
      {/* Left sidebar toggle */}
      <button
        className={`sidebar-toggle sidebar-toggle-left ${leftOpen ? 'open' : ''}`}
        onClick={() => setLeftOpen(!leftOpen)}
        title={leftOpen ? 'Hide worksets' : 'Show worksets'}
      >
        {leftOpen ? '\u25C0' : '\u25B6'}
      </button>

      {/* Left sidebar: Worksets */}
      {leftOpen && (
        <aside className="model-viewer-sidebar model-viewer-sidebar-left">
          <WorksetsWidget
            worksets={worksets}
            selectedWorksetId={selectedWorksetId}
            onWorksetClick={handleWorksetClick}
            onCreateWorkset={handleCreateWorkset}
            onDeleteWorkset={handleDeleteWorkset}
            onRenameWorkset={handleRenameWorkset}
            onColorChange={handleColorChange}
            onOpacityChange={handleOpacityChange}
            onAddElementsToWorkset={handleAddElementsToWorkset}
            onRemoveElementsFromWorkset={handleRemoveElementsFromWorkset}
            hasSelection={selectedExpressIds.length > 0}
          />
        </aside>
      )}

      {/* Center: 3D Viewer */}
      <main className="model-viewer-center">
        <IfcViewer
          ref={viewerRef}
          onElementSelected={handleElementSelected}
          onSelectionChanged={handleSelectionChanged}
        />
      </main>

      {/* Right sidebar: Properties */}
      {rightOpen && (
        <aside className="model-viewer-sidebar model-viewer-sidebar-right">
          <PropertiesPanel elementInfo={elementInfo} />
        </aside>
      )}

      {/* Right sidebar toggle */}
      <button
        className={`sidebar-toggle sidebar-toggle-right ${rightOpen ? 'open' : ''}`}
        onClick={() => setRightOpen(!rightOpen)}
        title={rightOpen ? 'Hide properties' : 'Show properties'}
      >
        {rightOpen ? '\u25B6' : '\u25C0'}
      </button>
    </div>
  );
}
