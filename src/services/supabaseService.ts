/**
 * Supabase data service — fetches pre-computed IFC data from Supabase Postgres.
 * Replaces client-side buildElementIndex() and local Express workset API.
 */

import { supabase } from '../lib/supabase';
import type { DbIfcModel, DbIfcElement, DbSpatialNode, DbWorkset } from '../lib/supabase';
import type { ElementIndexEntry, QuantificationRow, Workset } from '../types/ifc';

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
  const { data, error } = await supabase
    .from('ifc_elements')
    .select('express_id, ifc_type, name, floor_name, volume, area, height, length, materials, property_sets')
    .eq('model_id', modelId);
  if (error) throw error;

  return (data || []).map((e) => ({
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
  const { data, error } = await supabase
    .from('v_quantification_by_type')
    .select('*')
    .eq('model_id', modelId);
  if (error) throw error;
  return (data || []).map((r) => ({
    groupKey: r.ifc_type,
    count: r.element_count,
    totalVolume: r.total_volume || 0,
    totalArea: r.total_area || 0,
    expressIds: r.express_ids || [],
  }));
}

export async function getQuantificationByFloor(modelId: string): Promise<QuantificationRow[]> {
  const { data, error } = await supabase
    .from('v_quantification_by_floor')
    .select('*')
    .eq('model_id', modelId);
  if (error) throw error;
  return (data || []).map((r) => ({
    groupKey: r.floor_name || 'No Floor',
    count: r.element_count,
    totalVolume: r.total_volume || 0,
    totalArea: r.total_area || 0,
    expressIds: r.express_ids || [],
  }));
}

// ── Spatial tree ────────────────────────────────────────────────

export async function getSpatialTree(modelId: string): Promise<DbSpatialNode[]> {
  const { data, error } = await supabase
    .from('ifc_spatial_tree')
    .select('*')
    .eq('model_id', modelId)
    .order('elevation', { ascending: true });
  if (error) throw error;
  return data || [];
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
