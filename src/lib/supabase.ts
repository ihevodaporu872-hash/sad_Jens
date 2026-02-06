import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Types matching Supabase schema ──────────────────────────────

export interface DbIfcModel {
  id: string;
  name: string;
  file_name: string;
  file_size: number;
  storage_path: string | null;
  schema_version: string | null;
  element_count: number;
  parsed_at: string | null;
  parse_status: 'pending' | 'parsing' | 'done' | 'error';
  parse_error: string | null;
  created_at: string;
}

export interface DbIfcElement {
  id: string;
  model_id: string;
  express_id: number;
  global_id: string;
  ifc_type: string;
  name: string;
  description: string;
  volume: number;
  area: number;
  height: number;
  length: number;
  width: number;
  perimeter: number;
  weight: number;
  floor_name: string;
  materials: string[];
  classifications: string[];
  concrete_class: string;
  property_sets: Record<string, Record<string, unknown>>;
  quantity_sets: Record<string, Record<string, unknown>>;
  search_text: string;
}

export interface DbSpatialNode {
  id: string;
  model_id: string;
  express_id: number;
  ifc_type: string;
  name: string;
  long_name: string;
  parent_express_id: number | null;
  elevation: number | null;
  element_count: number;
}

export interface DbWorkset {
  id: string;
  model_id: string;
  name: string;
  color: string;
  opacity: number;
  express_ids: number[];
  global_ids: string[];
  filter_criteria: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
