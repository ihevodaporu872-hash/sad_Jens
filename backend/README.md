# IFC Parser Backend (Python + IfcOpenShell)

Parses IFC files server-side and writes extracted data to Supabase Postgres.

## Setup

1. Install Python dependencies:
```bash
cd backend
pip install -r requirements.txt
```

2. Copy `.env.example` to `.env` and fill in Supabase credentials:
```bash
cp .env.example .env
```

3. Run the SQL migration in Supabase SQL Editor:
   - Open `supabase/migrations/001_initial_schema.sql`
   - Paste into Supabase Dashboard > SQL Editor > Run

4. Parse an IFC file:
```bash
python parse_ifc.py ../public/louis.ifc --model-name "Louis Building"
```

## What it extracts

- All property sets (Pset_WallCommon, etc.)
- All quantity sets (Qto_WallBaseQuantities, etc.)
- Key quantities: volume, area, height, length, width, perimeter, weight
- Materials (layers, constituents, single)
- Classifications
- Concrete class
- Floor/storey assignment
- Spatial hierarchy (Project > Site > Building > Storey > Space)
- Full-text search index

## Architecture

```
IFC File --> IfcOpenShell (Python) --> Supabase Postgres
                                          |
                                    React Frontend
                                    (reads pre-computed data)
```
