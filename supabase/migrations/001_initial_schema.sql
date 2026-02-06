-- Supabase Postgres schema for IFC Viewer
-- Run this in the Supabase SQL Editor

-- ============================================================
-- IFC Models
-- ============================================================
CREATE TABLE IF NOT EXISTS ifc_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    storage_path TEXT,                -- path in Supabase Storage
    schema_version TEXT,              -- IFC2x3, IFC4, IFC4x3
    element_count INTEGER DEFAULT 0,
    parsed_at TIMESTAMPTZ,
    parse_status TEXT DEFAULT 'pending', -- pending, parsing, done, error
    parse_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- IFC Elements (per-element data with JSONB properties)
-- ============================================================
CREATE TABLE IF NOT EXISTS ifc_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ifc_models(id) ON DELETE CASCADE,
    express_id INTEGER NOT NULL,
    global_id TEXT,
    ifc_type TEXT NOT NULL,
    name TEXT DEFAULT '',
    description TEXT DEFAULT '',

    -- Key numeric quantities for fast aggregation
    volume DOUBLE PRECISION DEFAULT 0,
    area DOUBLE PRECISION DEFAULT 0,
    height DOUBLE PRECISION DEFAULT 0,
    length DOUBLE PRECISION DEFAULT 0,
    width DOUBLE PRECISION DEFAULT 0,
    perimeter DOUBLE PRECISION DEFAULT 0,
    weight DOUBLE PRECISION DEFAULT 0,

    -- Floor / storey
    floor_name TEXT DEFAULT '',

    -- Materials (array of names)
    materials TEXT[] DEFAULT '{}',

    -- Classifications
    classifications TEXT[] DEFAULT '{}',

    -- Concrete class
    concrete_class TEXT DEFAULT '',

    -- ALL property sets as JSONB: { "Pset_WallCommon": { "IsExternal": true, ... }, ... }
    property_sets JSONB DEFAULT '{}',

    -- ALL quantity sets as JSONB: { "Qto_WallBaseQuantities": { "Length": 5.2, ... }, ... }
    quantity_sets JSONB DEFAULT '{}',

    -- Flattened searchable text for full-text queries
    search_text TEXT DEFAULT '',

    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_elements_model ON ifc_elements(model_id);
CREATE INDEX IF NOT EXISTS idx_elements_type ON ifc_elements(ifc_type);
CREATE INDEX IF NOT EXISTS idx_elements_floor ON ifc_elements(floor_name);
CREATE INDEX IF NOT EXISTS idx_elements_express ON ifc_elements(model_id, express_id);
CREATE INDEX IF NOT EXISTS idx_elements_psets ON ifc_elements USING GIN(property_sets);
CREATE INDEX IF NOT EXISTS idx_elements_qsets ON ifc_elements USING GIN(quantity_sets);
CREATE INDEX IF NOT EXISTS idx_elements_search ON ifc_elements USING GIN(to_tsvector('simple', search_text));

-- ============================================================
-- Spatial hierarchy tree (Site > Building > Storey > Space)
-- ============================================================
CREATE TABLE IF NOT EXISTS ifc_spatial_tree (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ifc_models(id) ON DELETE CASCADE,
    express_id INTEGER NOT NULL,
    ifc_type TEXT NOT NULL,       -- IfcProject, IfcSite, IfcBuilding, IfcBuildingStorey, IfcSpace
    name TEXT DEFAULT '',
    long_name TEXT DEFAULT '',
    parent_express_id INTEGER,    -- NULL for root (IfcProject)
    elevation DOUBLE PRECISION,   -- for storeys
    element_count INTEGER DEFAULT 0,  -- how many elements contained

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spatial_model ON ifc_spatial_tree(model_id);
CREATE INDEX IF NOT EXISTS idx_spatial_parent ON ifc_spatial_tree(model_id, parent_express_id);

-- ============================================================
-- Worksets (saved element groups)
-- ============================================================
CREATE TABLE IF NOT EXISTS worksets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ifc_models(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#FF8800',
    opacity DOUBLE PRECISION DEFAULT 0.5,
    express_ids INTEGER[] DEFAULT '{}',
    global_ids TEXT[] DEFAULT '{}',

    -- Optional: saved filter criteria (for dynamic worksets / search sets)
    filter_criteria JSONB,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worksets_model ON worksets(model_id);

-- ============================================================
-- Useful views
-- ============================================================

-- Quantification by type
CREATE OR REPLACE VIEW v_quantification_by_type AS
SELECT
    model_id,
    ifc_type,
    COUNT(*) as element_count,
    SUM(volume) as total_volume,
    SUM(area) as total_area,
    SUM(height) as total_height,
    SUM(length) as total_length,
    SUM(weight) as total_weight,
    array_agg(express_id) as express_ids
FROM ifc_elements
GROUP BY model_id, ifc_type;

-- Quantification by floor
CREATE OR REPLACE VIEW v_quantification_by_floor AS
SELECT
    model_id,
    floor_name,
    COUNT(*) as element_count,
    SUM(volume) as total_volume,
    SUM(area) as total_area,
    array_agg(express_id) as express_ids
FROM ifc_elements
GROUP BY model_id, floor_name;

-- Quantification by material
CREATE OR REPLACE VIEW v_quantification_by_material AS
SELECT
    model_id,
    unnest(materials) as material,
    COUNT(*) as element_count,
    SUM(volume) as total_volume,
    SUM(area) as total_area,
    array_agg(express_id) as express_ids
FROM ifc_elements
WHERE array_length(materials, 1) > 0
GROUP BY model_id, unnest(materials);

-- ============================================================
-- Updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_models_updated
    BEFORE UPDATE ON ifc_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_worksets_updated
    BEFORE UPDATE ON worksets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
