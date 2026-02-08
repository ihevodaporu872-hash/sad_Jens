/**
 * Supabase data service — fetches pre-computed IFC data from Supabase Postgres.
 * Replaces client-side buildElementIndex() and local Express workset API.
 */

import { supabase } from '../lib/supabase';
import type { DbIfcModel, DbIfcElement, DbSpatialNode, DbWorkset } from '../lib/supabase';
import type { ElementIndexEntry, QuantificationRow, Workset, IfcElementInfo, IfcPropertySet, SearchSet, SearchCriteria, Viewpoint, ViewpointData } from '../types/ifc';

// ── Simple in-memory cache with TTL ──────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// ── Models ──────────────────────────────────────────────────────

export async function getModels(): Promise<DbIfcModel[]> {
  const { data, error } = await supabase
    .from('ifc_models')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getModel(modelId: string): Promise<DbIfcModel | null> {
  const { data, error } = await supabase
    .from('ifc_models')
    .select('*')
    .eq('id', modelId)
    .single();
  if (error) return null;
  return data;
}

// ── Elements (pre-computed from Python parser) ──────────────────

export async function getElementIndex(modelId: string): Promise<ElementIndexEntry[]> {
  const cacheKey = `elements:${modelId}`;
  const cached = getCached<ElementIndexEntry[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('ifc_elements')
    .select('express_id, ifc_type, name, floor_name, volume, area, height, length, materials, property_sets')
    .eq('model_id', modelId);
  if (error) throw error;

  const result = (data || []).map((e) => ({
    expressId: e.express_id,
    ifcType: e.ifc_type,
    name: e.name || '',
    floor: e.floor_name || '',
    volume: e.volume || 0,
    area: e.area || 0,
    height: e.height || 0,
    length: e.length || 0,
    material: Array.isArray(e.materials) && e.materials.length > 0 ? e.materials[0] : '',
    searchableProps: flattenProps(e.property_sets),
  }));
  setCache(cacheKey, result);
  return result;
}

function flattenProps(psets: Record<string, Record<string, unknown>> | null): string[] {
  if (!psets) return [];
  const result: string[] = [];
  for (const [, props] of Object.entries(psets)) {
    if (typeof props === 'object' && props !== null) {
      for (const [k, v] of Object.entries(props)) {
        if (v !== null && v !== undefined) {
          result.push(`${k}=${String(v)}`);
        }
      }
    }
  }
  return result;
}

export async function getElementProperties(
  modelId: string,
  expressId: number
): Promise<DbIfcElement | null> {
  const { data, error } = await supabase
    .from('ifc_elements')
    .select('*')
    .eq('model_id', modelId)
    .eq('express_id', expressId)
    .single();
  if (error) return null;
  return data;
}

// ── Quantification (uses Postgres views for fast aggregation) ──

export async function getQuantificationByType(modelId: string): Promise<QuantificationRow[]> {
  const cacheKey = `quant-type:${modelId}`;
  const cached = getCached<QuantificationRow[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('v_quantification_by_type')
    .select('*')
    .eq('model_id', modelId);
  if (error) throw error;
  const result = (data || []).map((r) => ({
    groupKey: r.ifc_type,
    count: r.element_count,
    totalVolume: r.total_volume || 0,
    totalArea: r.total_area || 0,
    expressIds: r.express_ids || [],
  }));
  setCache(cacheKey, result);
  return result;
}

export async function getQuantificationByFloor(modelId: string): Promise<QuantificationRow[]> {
  const cacheKey = `quant-floor:${modelId}`;
  const cached = getCached<QuantificationRow[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('v_quantification_by_floor')
    .select('*')
    .eq('model_id', modelId);
  if (error) throw error;
  const result = (data || []).map((r) => ({
    groupKey: r.floor_name || 'No Floor',
    count: r.element_count,
    totalVolume: r.total_volume || 0,
    totalArea: r.total_area || 0,
    expressIds: r.express_ids || [],
  }));
  setCache(cacheKey, result);
  return result;
}

export async function getQuantificationByMaterial(modelId: string): Promise<QuantificationRow[]> {
  const cacheKey = `quant-mat:${modelId}`;
  const cached = getCached<QuantificationRow[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('v_quantification_by_material')
    .select('*')
    .eq('model_id', modelId);
  if (error) throw error;
  const result = (data || []).map((r) => ({
    groupKey: r.material || 'No Material',
    count: r.element_count,
    totalVolume: r.total_volume || 0,
    totalArea: r.total_area || 0,
    expressIds: r.express_ids || [],
  }));
  setCache(cacheKey, result);
  return result;
}

// ── Map DB element to frontend IfcElementInfo ────────────────────

export function dbElementToIfcElementInfo(db: DbIfcElement): IfcElementInfo {
  const propertySets: IfcPropertySet[] = [];
  if (db.property_sets && typeof db.property_sets === 'object') {
    for (const [psetName, props] of Object.entries(db.property_sets)) {
      if (typeof props === 'object' && props !== null) {
        propertySets.push({
          name: psetName,
          properties: Object.entries(props).map(([k, v]) => ({
            name: k,
            value: v as string | number | boolean | null,
          })),
        });
      }
    }
  }
  if (db.quantity_sets && typeof db.quantity_sets === 'object') {
    for (const [qtoName, quantities] of Object.entries(db.quantity_sets)) {
      if (typeof quantities === 'object' && quantities !== null) {
        propertySets.push({
          name: qtoName,
          properties: Object.entries(quantities).map(([k, v]) => ({
            name: k,
            value: v as string | number | boolean | null,
          })),
        });
      }
    }
  }

  return {
    expressId: db.express_id,
    globalId: db.global_id || '',
    ifcType: db.ifc_type,
    name: db.name || '',
    description: db.description || undefined,
    keyParams: {
      volume: db.volume ? db.volume.toFixed(3) : undefined,
      area: db.area ? db.area.toFixed(3) : undefined,
      height: db.height ? db.height.toFixed(3) : undefined,
      length: db.length ? db.length.toFixed(3) : undefined,
      floor: db.floor_name || undefined,
      concreteClass: db.concrete_class || undefined,
    },
    propertySets,
    materials: db.materials || [],
    classifications: db.classifications || [],
  };
}

// ── Spatial tree ────────────────────────────────────────────────

export async function getSpatialTree(modelId: string): Promise<DbSpatialNode[]> {
  const cacheKey = `spatial:${modelId}`;
  const cached = getCached<DbSpatialNode[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('ifc_spatial_tree')
    .select('*')
    .eq('model_id', modelId)
    .order('elevation', { ascending: true });
  if (error) throw error;
  const result = data || [];
  setCache(cacheKey, result);
  return result;
}

// ── Search (full-text) ──────────────────────────────────────────

export async function searchElements(
  modelId: string,
  query: string
): Promise<{ expressId: number; ifcType: string; name: string }[]> {
  const { data, error } = await supabase
    .from('ifc_elements')
    .select('express_id, ifc_type, name')
    .eq('model_id', modelId)
    .textSearch('search_text', query, { type: 'plain' });
  if (error) throw error;
  return (data || []).map((e) => ({
    expressId: e.express_id,
    ifcType: e.ifc_type,
    name: e.name,
  }));
}

// ── Worksets (Supabase replaces local SQLite) ───────────────────

export async function getWorksets(modelId: string): Promise<Workset[]> {
  const { data, error } = await supabase
    .from('worksets')
    .select('*')
    .eq('model_id', modelId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(dbWorksetToWorkset);
}

export async function createWorkset(
  modelId: string,
  input: { name: string; color: string; opacity: number; expressIds: number[] }
): Promise<Workset> {
  const { data, error } = await supabase
    .from('worksets')
    .insert({
      model_id: modelId,
      name: input.name,
      color: input.color,
      opacity: input.opacity,
      express_ids: input.expressIds,
      global_ids: [],
    })
    .select()
    .single();
  if (error) throw error;
  return dbWorksetToWorkset(data);
}

export async function updateWorkset(
  worksetId: string,
  updates: { name?: string; color?: string; opacity?: number; expressIds?: number[] }
): Promise<Workset> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.color !== undefined) payload.color = updates.color;
  if (updates.opacity !== undefined) payload.opacity = updates.opacity;
  if (updates.expressIds !== undefined) payload.express_ids = updates.expressIds;

  const { data, error } = await supabase
    .from('worksets')
    .update(payload)
    .eq('id', worksetId)
    .select()
    .single();
  if (error) throw error;
  return dbWorksetToWorkset(data);
}

export async function deleteWorkset(worksetId: string): Promise<void> {
  const { error } = await supabase
    .from('worksets')
    .delete()
    .eq('id', worksetId);
  if (error) throw error;
}

function dbWorksetToWorkset(db: DbWorkset): Workset {
  return {
    id: db.id,
    modelId: db.model_id,
    name: db.name,
    color: db.color,
    opacity: db.opacity,
    elementIds: {
      expressIds: db.express_ids || [],
      globalIds: db.global_ids || [],
    },
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

// ── Search Sets CRUD ─────────────────────────────────────────────

export async function getSearchSets(modelId: string): Promise<SearchSet[]> {
  const { data, error } = await supabase
    .from('search_sets')
    .select('*')
    .eq('model_id', modelId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    modelId: row.model_id,
    name: row.name,
    criteria: (row.criteria || {}) as SearchCriteria,
    createdAt: row.created_at,
  }));
}

export async function createSearchSet(
  modelId: string,
  input: { name: string; criteria: SearchCriteria }
): Promise<SearchSet> {
  const { data, error } = await supabase
    .from('search_sets')
    .insert({
      model_id: modelId,
      name: input.name,
      criteria: input.criteria,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    modelId: data.model_id,
    name: data.name,
    criteria: (data.criteria || {}) as SearchCriteria,
    createdAt: data.created_at,
  };
}

export async function deleteSearchSet(searchSetId: string): Promise<void> {
  const { error } = await supabase
    .from('search_sets')
    .delete()
    .eq('id', searchSetId);
  if (error) throw error;
}

// ── Viewpoints CRUD ──────────────────────────────────────────────

export async function getViewpoints(modelId: string): Promise<Viewpoint[]> {
  const { data, error } = await supabase
    .from('viewpoints')
    .select('*')
    .eq('model_id', modelId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(dbViewpointToViewpoint);
}

export async function createViewpoint(
  modelId: string,
  input: ViewpointData
): Promise<Viewpoint> {
  const { data, error } = await supabase
    .from('viewpoints')
    .insert({
      model_id: modelId,
      name: input.name,
      camera_position: input.cameraPosition,
      camera_target: input.cameraTarget,
      hidden_express_ids: input.hiddenExpressIds,
      colored_elements: input.coloredElements,
      clipping_planes: input.clippingPlanes,
      thumbnail: input.thumbnail || null,
      annotation_data: input.annotations || null,
    })
    .select()
    .single();
  if (error) throw error;
  return dbViewpointToViewpoint(data);
}

export async function deleteViewpoint(viewpointId: string): Promise<void> {
  const { error } = await supabase
    .from('viewpoints')
    .delete()
    .eq('id', viewpointId);
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbViewpointToViewpoint(db: any): Viewpoint {
  return {
    id: db.id,
    modelId: db.model_id,
    name: db.name,
    cameraPosition: db.camera_position || { x: 0, y: 0, z: 0 },
    cameraTarget: db.camera_target || { x: 0, y: 0, z: 0 },
    hiddenExpressIds: db.hidden_express_ids || [],
    coloredElements: db.colored_elements || [],
    clippingPlanes: db.clipping_planes || [],
    thumbnail: db.thumbnail || undefined,
    annotations: db.annotation_data || undefined,
    createdAt: db.created_at,
  };
}
