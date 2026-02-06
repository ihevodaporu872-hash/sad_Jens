// Annotation types for PDF markup overlay system

export type AnnotationKind = 'count_point' | 'area_polygon' | 'dimension_line';

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface AnnotationItem {
  id: string;
  page: number; // 1-based page index
  kind: AnnotationKind;
  color?: string; // CSS color, if absent — use layer color
  opacity?: number; // 0..1
  label?: string; // display label (e.g. "12.3 m²")
  points: AnnotationPoint[];
  closed?: boolean; // true for polygons
  meta?: Record<string, unknown>;
}

export interface AnnotationLayer {
  id: string;
  name: string;
  color: string;
  opacity: number;
  visible: boolean;
  items: AnnotationItem[];
}

export interface AnnotationModel {
  version: string;
  docId?: string;
  pageCount?: number;
  layers: AnnotationLayer[];
}

