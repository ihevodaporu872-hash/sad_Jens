import { useState, useRef, useCallback, useEffect } from 'react';
import { IfcViewer } from '../IfcViewer';
import { PropertiesPanel } from '../PropertiesPanel';
import { WorksetsWidget } from '../WorksetsWidget';
import { SmartFilter } from '../SmartFilter';
import { Quantification } from '../Quantification';
import { SelectionTree } from '../SelectionTree';
import { ElementActions } from '../ElementActions';
import { Annotations } from '../Annotations';
import { MeasureTools } from '../MeasureTools';
import { AppearanceProfiler } from '../AppearanceProfiler';
import { SearchSets } from '../SearchSets';
import { SectionPlanes } from '../SectionPlanes';
import { Viewpoints } from '../Viewpoints';
import { getElementProperties } from '../../utils/ifcProperties';
import * as supabaseApi from '../../services/supabaseService';
import type {
  IfcViewerRef,
  IfcElementInfo,
  ElementSelection,
  Workset,
  ElementIndexEntry,
} from '../../types/ifc';
import type { DbSpatialNode } from '../../lib/supabase';
import './ModelViewerPage.css';

type LeftTab = 'worksets' | 'filter' | 'quantification' | 'tree' | 'profiler' | 'searchsets';

export function ModelViewerPage() {
  const viewerRef = useRef<IfcViewerRef>(null);

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<LeftTab>('worksets');

  // Properties panel state
  const [elementInfo, setElementInfo] = useState<IfcElementInfo | null>(null);

  // Selection state
  const [selectedExpressIds, setSelectedExpressIds] = useState<number[]>([]);

  // Worksets state
  const [worksets, setWorksets] = useState<Workset[]>([]);
  const [selectedWorksetId, setSelectedWorksetId] = useState<string | null>(null);

  // Element index for SmartFilter & Quantification
  const [elementIndex, setElementIndex] = useState<ElementIndexEntry[]>([]);
  const [hasModel, setHasModel] = useState(false);

  // Box select state
  const [boxSelectActive, setBoxSelectActive] = useState(false);

  // Annotation mode state
  const [annotationActive, setAnnotationActive] = useState(false);

  // Measure mode state
  const [measureActive, setMeasureActive] = useState(false);

  // Spatial tree for SelectionTree
  const [spatialTree, setSpatialTree] = useState<DbSpatialNode[]>([]);

  // Supabase model ID — loaded from DB or fallback to first available model
  const [supabaseModelId, setSupabaseModelId] = useState<string | null>(null);

  // Load Supabase model + worksets on mount
  const loadSupabaseData = useCallback(async () => {
    try {
      // Find the first available model in Supabase
      const models = await supabaseApi.getModels();
      if (models.length > 0) {
        const model = models[0];
        setSupabaseModelId(model.id);
        console.log(`[Supabase] Using model: ${model.name} (${model.id})`);

        // Load worksets from Supabase
        try {
          const data = await supabaseApi.getWorksets(model.id);
          setWorksets(data);
        } catch (err) {
          console.warn('[Worksets] Failed to load worksets:', err);
        }

        // Load element index from Supabase (instant, no client-side indexing)
        try {
          const index = await supabaseApi.getElementIndex(model.id);
          setElementIndex(index);
          console.log(`[Supabase] Loaded element index: ${index.length} entries`);
        } catch (err) {
          console.warn('[Supabase] Failed to load element index:', err);
        }

        // Load spatial tree from Supabase
        try {
          const tree = await supabaseApi.getSpatialTree(model.id);
          setSpatialTree(tree);
          console.log(`[Supabase] Loaded spatial tree: ${tree.length} nodes`);
        } catch (err) {
          console.warn('[Supabase] Failed to load spatial tree:', err);
        }
      } else {
        console.warn('[Supabase] No models found in database — using client-side indexing');
      }
    } catch (err) {
      console.warn('[Supabase] Failed to connect:', err);
    }
  }, []);

  useEffect(() => {
    loadSupabaseData();
  }, [loadSupabaseData]);

  // ── Viewer callbacks ──────────────────────────────────────────

  const handleElementSelected = useCallback(
    async (selection: ElementSelection | null) => {
      if (!selection) {
        setElementInfo(null);
        return;
      }

      // Try Supabase first (richer data from Python parser)
      if (supabaseModelId) {
        try {
          const dbElement = await supabaseApi.getElementProperties(supabaseModelId, selection.expressId);
          if (dbElement) {
            setElementInfo(supabaseApi.dbElementToIfcElementInfo(dbElement));
            return;
          }
        } catch {
          // Fall through to web-ifc
        }
      }

      // Fallback: Get properties from web-ifc
      const ifcApi = viewerRef.current?.getIfcApi();
      const modelId = viewerRef.current?.getModelId();
      if (ifcApi && modelId !== null && modelId !== undefined) {
        const info = getElementProperties(ifcApi, modelId, selection.expressId);
        setElementInfo(info);
      }
    },
    [supabaseModelId]
  );

  const handleSelectionChanged = useCallback(
    (selections: ElementSelection[]) => {
      setSelectedExpressIds(selections.map((s) => s.expressId));
    },
    []
  );

  // Detect model load — poll for model availability
  useEffect(() => {
    const interval = setInterval(() => {
      const allIds = viewerRef.current?.getAllExpressIds() ?? [];
      if (allIds.length > 0 && !hasModel) {
        setHasModel(true);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [hasModel]);

  // ── Element Actions ──────────────────────────────────────────

  const handleHideSelected = useCallback(() => {
    const ids = viewerRef.current?.getSelectedExpressIds() ?? [];
    if (ids.length > 0) {
      viewerRef.current?.hideElements(ids);
    }
  }, []);

  const handleShowAll = useCallback(() => {
    viewerRef.current?.showAll();
  }, []);

  const handleIsolateSelected = useCallback(() => {
    const ids = viewerRef.current?.getSelectedExpressIds() ?? [];
    if (ids.length > 0) {
      viewerRef.current?.isolate(ids);
    }
  }, []);

  const handleColorSelected = useCallback((color: string) => {
    const ids = viewerRef.current?.getSelectedExpressIds() ?? [];
    if (ids.length > 0) {
      viewerRef.current?.colorElements(ids, color);
    }
  }, []);

  const handleResetColors = useCallback(() => {
    viewerRef.current?.resetColors();
  }, []);

  const handleInvertSelection = useCallback(() => {
    const allIds = viewerRef.current?.getAllExpressIds() ?? [];
    const selectedSet = new Set(viewerRef.current?.getSelectedExpressIds() ?? []);
    const inverted = allIds.filter((id) => !selectedSet.has(id));
    viewerRef.current?.selectElements(inverted);
  }, []);

  // ── Zoom handlers ──────────────────────────────────────────────

  const handleZoomToSelected = useCallback(() => {
    viewerRef.current?.zoomToSelected();
  }, []);

  const handleZoomToFit = useCallback(() => {
    viewerRef.current?.zoomToFit();
  }, []);

  // ── Box Select handler ──────────────────────────────────────────

  const handleBoxSelectToggle = useCallback(() => {
    const next = !boxSelectActive;
    setBoxSelectActive(next);
    viewerRef.current?.setBoxSelectMode(next);
  }, [boxSelectActive]);

  // ── Annotation handler ─────────────────────────────────────────

  const handleAnnotationToggle = useCallback(() => {
    setAnnotationActive((prev) => !prev);
  }, []);

  const handleAnnotationClose = useCallback(() => {
    setAnnotationActive(false);
  }, []);

  // ── Measure handler ─────────────────────────────────────────

  const handleMeasureToggle = useCallback(() => {
    setMeasureActive((prev) => !prev);
  }, []);

  const handleMeasureClose = useCallback(() => {
    setMeasureActive(false);
  }, []);

  // ── SmartFilter handlers ──────────────────────────────────────

  const handleFilterSelectElements = useCallback((expressIds: number[]) => {
    viewerRef.current?.selectElements(expressIds);
  }, []);

  const handleFilterHighlightElements = useCallback((expressIds: number[], color: string) => {
    viewerRef.current?.colorElements(expressIds, color);
  }, []);

  // ── Quantification handlers ──────────────────────────────────

  const handleQuantSelectElements = useCallback((expressIds: number[]) => {
    viewerRef.current?.selectElements(expressIds);
  }, []);

  // ── SelectionTree handlers ─────────────────────────────────

  const handleTreeSelectElements = useCallback((expressIds: number[]) => {
    viewerRef.current?.selectElements(expressIds);
  }, []);

  // ── AppearanceProfiler handlers ───────────────────────────

  const handleProfilerColorElements = useCallback((expressIds: number[], color: string) => {
    viewerRef.current?.colorElements(expressIds, color);
  }, []);

  const handleProfilerResetColors = useCallback(() => {
    viewerRef.current?.resetColors();
  }, []);

  // ── Workset handlers ──────────────────────────────────────────

  const handleCreateWorkset = useCallback(async () => {
    const ids = viewerRef.current?.getSelectedExpressIds() ?? [];
    if (ids.length === 0 || !supabaseModelId) return;

    try {
      const ws = await supabaseApi.createWorkset(supabaseModelId, {
        name: `Workset ${worksets.length + 1}`,
        color: '#FF8800',
        opacity: 0.5,
        expressIds: ids,
      });
      setWorksets((prev) => [...prev, ws]);
    } catch (err) {
      console.error('[Worksets] Failed to create:', err);
    }
  }, [worksets.length, supabaseModelId]);

  const handleDeleteWorkset = useCallback(async (worksetId: string) => {
    try {
      await supabaseApi.deleteWorkset(worksetId);
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
      const updated = await supabaseApi.updateWorkset(worksetId, { name: newName });
      setWorksets((prev) => prev.map((w) => (w.id === worksetId ? updated : w)));
    } catch (err) {
      console.error('[Worksets] Failed to rename:', err);
    }
  }, []);

  const handleColorChange = useCallback(async (worksetId: string, color: string) => {
    try {
      const updated = await supabaseApi.updateWorkset(worksetId, { color });
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
      const updated = await supabaseApi.updateWorkset(worksetId, { opacity });
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
      const updated = await supabaseApi.updateWorkset(worksetId, {
        expressIds: merged,
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
      const updated = await supabaseApi.updateWorkset(worksetId, {
        expressIds: remaining,
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
        title={leftOpen ? 'Hide panel' : 'Show panel'}
      >
        {leftOpen ? '\u25C0' : '\u25B6'}
      </button>

      {/* Left sidebar: Tabs + Content */}
      {leftOpen && (
        <aside className="model-viewer-sidebar model-viewer-sidebar-left">
          {/* Tab bar */}
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${leftTab === 'worksets' ? 'active' : ''}`}
              onClick={() => setLeftTab('worksets')}
            >
              Worksets
            </button>
            <button
              className={`sidebar-tab ${leftTab === 'filter' ? 'active' : ''}`}
              onClick={() => setLeftTab('filter')}
            >
              Filter
            </button>
            <button
              className={`sidebar-tab ${leftTab === 'quantification' ? 'active' : ''}`}
              onClick={() => setLeftTab('quantification')}
            >
              Quant
            </button>
            <button
              className={`sidebar-tab ${leftTab === 'tree' ? 'active' : ''}`}
              onClick={() => setLeftTab('tree')}
            >
              Tree
            </button>
            <button
              className={`sidebar-tab ${leftTab === 'profiler' ? 'active' : ''}`}
              onClick={() => setLeftTab('profiler')}
            >
              Profiler
            </button>
            <button
              className={`sidebar-tab ${leftTab === 'searchsets' ? 'active' : ''}`}
              onClick={() => setLeftTab('searchsets')}
            >
              Search
            </button>
          </div>

          {/* Tab content */}
          {leftTab === 'worksets' && (
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
          )}
          {leftTab === 'filter' && (
            <SmartFilter
              elementIndex={elementIndex}
              onSelectElements={handleFilterSelectElements}
              onHighlightElements={handleFilterHighlightElements}
            />
          )}
          {leftTab === 'quantification' && (
            <Quantification
              elementIndex={elementIndex}
              onSelectElements={handleQuantSelectElements}
            />
          )}
          {leftTab === 'tree' && (
            <SelectionTree
              spatialTree={spatialTree}
              elementIndex={elementIndex}
              onSelectElements={handleTreeSelectElements}
            />
          )}
          {leftTab === 'profiler' && (
            <AppearanceProfiler
              elementIndex={elementIndex}
              onColorElements={handleProfilerColorElements}
              onResetColors={handleProfilerResetColors}
            />
          )}
          {leftTab === 'searchsets' && (
            <SearchSets
              elementIndex={elementIndex}
              supabaseModelId={supabaseModelId}
              onSelectElements={handleFilterSelectElements}
              onHighlightElements={handleFilterHighlightElements}
            />
          )}
        </aside>
      )}

      {/* Center: Actions toolbar + 3D Viewer */}
      <main className="model-viewer-center">
        <ElementActions
          hasSelection={selectedExpressIds.length > 0}
          hasModel={hasModel}
          onHideSelected={handleHideSelected}
          onShowAll={handleShowAll}
          onIsolateSelected={handleIsolateSelected}
          onColorSelected={handleColorSelected}
          onResetColors={handleResetColors}
          onInvertSelection={handleInvertSelection}
          onZoomToSelected={handleZoomToSelected}
          onZoomToFit={handleZoomToFit}
          onBoxSelectToggle={handleBoxSelectToggle}
          boxSelectActive={boxSelectActive}
          onAnnotationToggle={handleAnnotationToggle}
          annotationActive={annotationActive}
          onMeasureToggle={handleMeasureToggle}
          measureActive={measureActive}
        />
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <IfcViewer
            ref={viewerRef}
            onElementSelected={handleElementSelected}
            onSelectionChanged={handleSelectionChanged}
          />
          <Annotations
            viewerRef={viewerRef}
            active={annotationActive}
            onClose={handleAnnotationClose}
          />
          <MeasureTools
            viewerRef={viewerRef}
            active={measureActive}
            onClose={handleMeasureClose}
          />
        </div>
        {hasModel && <SectionPlanes viewerRef={viewerRef} />}
      </main>

      {/* Right sidebar: Properties + Viewpoints */}
      {rightOpen && (
        <aside className="model-viewer-sidebar model-viewer-sidebar-right">
          <PropertiesPanel elementInfo={elementInfo} />
          <Viewpoints
            viewerRef={viewerRef}
            supabaseModelId={supabaseModelId}
          />
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
