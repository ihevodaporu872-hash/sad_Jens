/**
 * Shared types for IFC Viewer with Worksets, Smart Filter, Quantification
 */

// Element selection info emitted by the viewer on click
export interface ElementSelection {
  modelId: number;
  expressId: number;
  globalId?: string;
}

// Workset structure (matches backend schema)
export interface Workset {
  id: string;
  modelId: string;
  name: string;
  color: string;
  opacity: number;
  elementIds: {
    expressIds: number[];
    globalIds: string[];
  };
  createdAt?: string;
  updatedAt?: string;
}

// Create/update workset request
export interface WorksetCreateRequest {
  name: string;
  color: string;
  opacity: number;
  elementIds: {
    expressIds: number[];
    globalIds: string[];
  };
}

export interface WorksetUpdateRequest {
  name?: string;
  color?: string;
  opacity?: number;
  elementIds?: {
    expressIds: number[];
    globalIds: string[];
  };
}

// IFC property types for PropertiesPanel
export interface IfcPropertySet {
  name: string;
  properties: IfcProperty[];
}

export interface IfcProperty {
  name: string;
  value: string | number | boolean | null;
  type?: string;
}

// Key parameters extracted from IFC (shown only when present)
export interface IfcKeyParams {
  volume?: string;
  area?: string;
  floor?: string;
  concreteClass?: string;
  height?: string;
  length?: string;
}

export interface IfcElementInfo {
  expressId: number;
  globalId: string;
  ifcType: string;
  name: string;
  description?: string;
  keyParams: IfcKeyParams;
  propertySets: IfcPropertySet[];
  materials: string[];
  classifications: string[];
}

// ── Element Index (built after model load for fast filtering) ──

export interface ElementIndexEntry {
  expressId: number;
  ifcType: string;
  name: string;
  floor: string;
  volume: number;
  area: number;
  height: number;
  length: number;
  material: string;
  // All property values flattened for search: "propName=value"
  searchableProps: string[];
}

// ── Quantification row ──

export interface QuantificationRow {
  groupKey: string;         // e.g. "IfcWall" or "Floor 1"
  count: number;
  totalVolume: number;
  totalArea: number;
  expressIds: number[];
}

// ── Viewer ref API exposed via forwardRef ──

export interface IfcViewerRef {
  highlightElements: (worksetId: string, expressIds: number[], color: string, opacity: number) => void;
  clearHighlight: (worksetId?: string) => void;
  isolate: (expressIds: number[]) => void;
  unisolate: () => void;
  hideElements: (expressIds: number[]) => void;
  showElements: (expressIds: number[]) => void;
  showAll: () => void;
  colorElements: (expressIds: number[], color: string) => void;
  resetColors: () => void;
  selectElements: (expressIds: number[]) => void;
  setElementsOpacity: (expressIds: number[], opacity: number) => void;
  setOthersWireframe: (expressIdsToKeep: number[]) => void;
  clearOthersWireframe: () => void;
  getModelId: () => number | null;
  getIfcApi: () => unknown | null;
  getSelectedExpressIds: () => number[];
  getAllExpressIds: () => number[];
  zoomToSelected: () => void;
  zoomToFit: () => void;
  getScene: () => unknown | null;
  getCamera: () => unknown | null;
  getRenderer: () => unknown | null;
  getControls: () => unknown | null;
  getModelGroup: () => unknown | null;
  getExpressIdToMeshes: () => Map<number, unknown[]>;
  setBoxSelectMode: (enabled: boolean) => void;
}

// ── Search Sets (Navisworks-style saved search criteria) ──

export interface SearchCriteria {
  ifcTypes?: string[];
  floors?: string[];
  materials?: string[];
  textQuery?: string;
  propFilters?: { property: string; operator: 'equals' | 'contains' | 'gt' | 'lt'; value: string }[];
}

export interface SearchSet {
  id: string;
  modelId: string;
  name: string;
  criteria: SearchCriteria;
  createdAt?: string;
}

// ── Viewpoints (Navisworks-style saved viewpoints) ──

export interface ViewpointData {
  name: string;
  cameraPosition: { x: number; y: number; z: number };
  cameraTarget: { x: number; y: number; z: number };
  hiddenExpressIds: number[];
  coloredElements: { expressIds: number[]; color: string }[];
  clippingPlanes: { axis: 'x' | 'y' | 'z'; constant: number }[];
  thumbnail?: string;
  annotations?: AnnotationEntryData[];
}

// Annotation entry data for viewpoint serialization
export interface AnnotationEntryData {
  type: 'text' | 'freehand' | 'cloud' | 'arrow';
  points: { x: number; y: number }[];
  color: string;
  width: number;
  text?: string;
}

export interface Viewpoint extends ViewpointData {
  id: string;
  modelId: string;
  createdAt?: string;
}

// Viewer props
export interface IfcViewerProps {
  className?: string;
  onElementSelected?: (info: ElementSelection | null) => void;
  onSelectionChanged?: (selections: ElementSelection[]) => void;
}
