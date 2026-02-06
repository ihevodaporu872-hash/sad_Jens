# Supabase + IfcOpenShell Backend Architecture

## Overview

Replace client-side IFC property extraction with server-side parsing via Python + IfcOpenShell.
Use Supabase for storage (IFC files), database (properties, worksets), and auth.

## Architecture

```
User uploads .ifc --> Supabase Storage (bucket: ifc-files)
                          |
                    Python Worker (local or cloud)
                      - IfcOpenShell parses file
                      - Extracts: types, properties, quantities, hierarchy
                      - Calculates exact volumes/areas via OpenCASCADE
                      - Writes to Supabase Postgres
                          |
                    Frontend reads pre-computed data
                      - web-ifc ONLY for 3D rendering
                      - Properties/quantities from Supabase DB
                      - Instant loading, no client-side parsing
```

## Database Schema

### Tables

- `ifc_models` - uploaded model metadata
- `ifc_elements` - per-element data with JSONB properties
- `ifc_spatial_tree` - spatial hierarchy (Site > Building > Storey > Space)
- `worksets` - saved element groups with filters

### Key Design Decisions

- JSONB for properties: flexible, GIN-indexed for fast queries
- Numeric columns for volume/area/height/length: enables SQL aggregation
- Separate spatial_tree table for hierarchy navigation
- Express IDs stored as integers for fast joins

## Python Worker

- `parse_ifc.py` - main parser using IfcOpenShell
- Extracts ALL property sets, quantity sets, materials, classifications
- Calculates geometry-based volumes/areas via OpenCASCADE
- Builds spatial hierarchy tree
- Batch inserts to Supabase (1000 rows at a time)

## Frontend Changes

- `src/lib/supabase.ts` - Supabase JS client
- `src/services/supabaseService.ts` - API functions
- SmartFilter/Quantification read from Supabase (not client-side index)
- Worksets stored in Supabase (not local SQLite)
- Properties panel fetches from DB on element click

## Migration Path

1. Keep web-ifc for 3D rendering (unchanged)
2. Add Supabase as data backend
3. Python worker parses on upload
4. Frontend reads pre-computed data
5. Remove old Express+SQLite server (optional, gradual)
