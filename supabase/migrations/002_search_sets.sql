CREATE TABLE IF NOT EXISTS search_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ifc_models(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    criteria JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_search_sets_model ON search_sets(model_id);
CREATE TRIGGER tr_search_sets_updated BEFORE UPDATE ON search_sets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
