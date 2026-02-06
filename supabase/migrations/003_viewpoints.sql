CREATE TABLE IF NOT EXISTS viewpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ifc_models(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    camera_position JSONB NOT NULL,    -- {x, y, z}
    camera_target JSONB NOT NULL,      -- {x, y, z}
    hidden_express_ids INTEGER[] DEFAULT '{}',
    colored_elements JSONB DEFAULT '[]',  -- [{expressIds: number[], color: string}]
    clipping_planes JSONB DEFAULT '[]',   -- [{axis: 'x'|'y'|'z', constant: number}]
    thumbnail TEXT,                     -- base64 data URL
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_viewpoints_model ON viewpoints(model_id);
