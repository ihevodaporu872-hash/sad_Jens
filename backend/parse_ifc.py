"""
IFC Parser using IfcOpenShell — extracts all properties, quantities, hierarchy
and writes them to Supabase Postgres.

Usage:
    python parse_ifc.py <path_to_ifc_file> [--model-name "My Building"]

Requires:
    pip install ifcopenshell supabase python-dotenv
"""

import sys
import os
import json
import time
import uuid
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

import ifcopenshell
import ifcopenshell.util.element
import ifcopenshell.util.placement

try:
    import ifcopenshell.geom
    HAS_GEOM = True
except ImportError:
    HAS_GEOM = False
    print("[WARN] ifcopenshell.geom not available — geometry-based volume/area calculation disabled")

from supabase import create_client, Client

# ── Supabase client ─────────────────────────────────────────────

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── IFC type constants ──────────────────────────────────────────

SPATIAL_TYPES = [
    "IfcProject", "IfcSite", "IfcBuilding", "IfcBuildingStorey", "IfcSpace"
]

# Quantity name patterns (case-insensitive matching)
VOLUME_KEYS = {"netvolume", "grossvolume", "volume"}
AREA_KEYS = {"netarea", "grossarea", "netsidearea", "grosssidearea", "area",
             "crosssectionarea", "outersurfacearea", "totalsurfacearea", "netsurfacearea"}
HEIGHT_KEYS = {"height", "overallheight", "nominalheight"}
LENGTH_KEYS = {"length", "overalllength", "nominallength", "span"}
WIDTH_KEYS = {"width", "overallwidth", "nominalwidth"}
PERIMETER_KEYS = {"perimeter", "grossperimeter", "netperimeter"}
WEIGHT_KEYS = {"weight", "grossweight", "netweight"}
CONCRETE_KEYS = {"concretestrength", "concreteclass", "concretegrade",
                 "classofconcrete", "strengthclass"}


def normalize_key(name: str) -> str:
    """Normalize property name for matching."""
    return name.lower().replace(" ", "").replace("_", "").replace("-", "")


def match_keys(name: str, key_set: set) -> bool:
    nk = normalize_key(name)
    return any(k in nk for k in key_set)


def safe_value(val) -> str | int | float | bool | None:
    """Convert IFC value to JSON-safe Python type."""
    if val is None:
        return None
    if isinstance(val, (int, float, bool)):
        return val
    if isinstance(val, str):
        return val
    # IfcOpenShell entity reference
    if hasattr(val, "is_a"):
        return str(val)
    return str(val)


# ── Extract properties & quantities ─────────────────────────────

def extract_element_data(element, model, storey_map: dict) -> dict:
    """Extract all properties, quantities, and key params for a single element."""
    express_id = element.id()
    global_id = getattr(element, "GlobalId", "") or ""
    name = getattr(element, "Name", "") or ""
    description = getattr(element, "Description", "") or ""
    ifc_type = element.is_a()

    # Get ALL property sets
    psets = {}
    try:
        all_psets = ifcopenshell.util.element.get_psets(element)
        for pset_name, props in all_psets.items():
            clean_props = {}
            for k, v in props.items():
                if k == "id":
                    continue
                clean_props[k] = safe_value(v)
            psets[pset_name] = clean_props
    except Exception as e:
        print(f"  [WARN] Failed to get psets for #{express_id}: {e}")

    # Get quantity sets separately
    qsets = {}
    try:
        all_qtos = ifcopenshell.util.element.get_psets(element, qtos_only=True)
        for qto_name, quantities in all_qtos.items():
            clean_q = {}
            for k, v in quantities.items():
                if k == "id":
                    continue
                clean_q[k] = safe_value(v)
            qsets[qto_name] = clean_q
    except Exception:
        pass

    # Extract key numeric values from psets + qsets
    volume = 0.0
    area = 0.0
    height = 0.0
    length = 0.0
    width = 0.0
    perimeter = 0.0
    weight = 0.0
    concrete_class = ""

    for source in [psets, qsets]:
        for pset_name, props in source.items():
            for k, v in props.items():
                if v is None:
                    continue
                nk = normalize_key(k)
                try:
                    fv = float(v) if isinstance(v, (int, float)) else None
                except (ValueError, TypeError):
                    fv = None

                if fv is not None and fv > 0:
                    if not volume and match_keys(k, VOLUME_KEYS):
                        volume = fv
                    elif not area and match_keys(k, AREA_KEYS):
                        area = fv
                    elif not height and match_keys(k, HEIGHT_KEYS):
                        height = fv
                    elif not length and match_keys(k, LENGTH_KEYS):
                        length = fv
                    elif not width and match_keys(k, WIDTH_KEYS):
                        width = fv
                    elif not perimeter and match_keys(k, PERIMETER_KEYS):
                        perimeter = fv
                    elif not weight and match_keys(k, WEIGHT_KEYS):
                        weight = fv

                if not concrete_class and isinstance(v, str) and match_keys(k, CONCRETE_KEYS):
                    concrete_class = v

    # Materials
    materials = []
    try:
        mat = ifcopenshell.util.element.get_material(element)
        if mat:
            if mat.is_a("IfcMaterial"):
                materials.append(mat.Name or "")
            elif mat.is_a("IfcMaterialLayerSetUsage") or mat.is_a("IfcMaterialLayerSet"):
                layer_set = mat if mat.is_a("IfcMaterialLayerSet") else mat.ForLayerSet
                if layer_set:
                    for layer in layer_set.MaterialLayers:
                        if layer.Material:
                            materials.append(layer.Material.Name or "")
            elif mat.is_a("IfcMaterialList"):
                for m in mat.Materials:
                    materials.append(m.Name or "")
            elif mat.is_a("IfcMaterialConstituentSet"):
                for c in mat.MaterialConstituents or []:
                    if c.Material:
                        materials.append(c.Material.Name or "")
    except Exception:
        pass

    # Classifications
    classifications = []
    try:
        for rel in getattr(element, "HasAssociations", []) or []:
            if rel.is_a("IfcRelAssociatesClassification"):
                ref = rel.RelatingClassification
                if ref:
                    code = getattr(ref, "ItemReference", None) or getattr(ref, "Identification", None) or ""
                    cname = getattr(ref, "Name", "") or ""
                    classifications.append(f"{code}: {cname}" if code else cname)
    except Exception:
        pass

    # Floor / storey from pre-built map
    floor_name = storey_map.get(express_id, "")

    # Build search text for full-text search
    search_parts = [ifc_type, name, description, floor_name, concrete_class]
    search_parts.extend(materials)
    search_parts.extend(classifications)
    for pset_name, props in psets.items():
        search_parts.append(pset_name)
        for k, v in props.items():
            search_parts.append(f"{k}={v}")
    search_text = " ".join(str(s) for s in search_parts if s)

    return {
        "express_id": express_id,
        "global_id": global_id,
        "ifc_type": ifc_type,
        "name": name,
        "description": description,
        "volume": round(volume, 6),
        "area": round(area, 6),
        "height": round(height, 6),
        "length": round(length, 6),
        "width": round(width, 6),
        "perimeter": round(perimeter, 6),
        "weight": round(weight, 6),
        "floor_name": floor_name,
        "materials": [m for m in materials if m],
        "classifications": [c for c in classifications if c],
        "concrete_class": concrete_class,
        "property_sets": psets,
        "quantity_sets": qsets,
        "search_text": search_text[:10000],  # Limit for safety
    }


# ── Build storey map ────────────────────────────────────────────

def build_storey_map(model) -> dict[int, str]:
    """Map element express_id -> storey name via IfcRelContainedInSpatialStructure."""
    storey_map = {}
    try:
        for rel in model.by_type("IfcRelContainedInSpatialStructure"):
            structure = rel.RelatingStructure
            if not structure:
                continue
            storey_name = getattr(structure, "Name", "") or getattr(structure, "LongName", "") or ""
            for element in rel.RelatedElements or []:
                storey_map[element.id()] = storey_name
    except Exception as e:
        print(f"[WARN] Failed to build storey map: {e}")
    return storey_map


# ── Build spatial hierarchy ─────────────────────────────────────

def build_spatial_tree(model) -> list[dict]:
    """Extract spatial hierarchy: Project > Site > Building > Storey > Space."""
    nodes = []

    def process_spatial(entity, parent_id=None):
        if not entity:
            return
        ifc_type = entity.is_a()
        if ifc_type not in SPATIAL_TYPES:
            return

        name = getattr(entity, "Name", "") or ""
        long_name = getattr(entity, "LongName", "") or ""
        elevation = None
        if ifc_type == "IfcBuildingStorey":
            elevation = getattr(entity, "Elevation", None)
            if elevation is not None:
                try:
                    elevation = float(elevation)
                except (ValueError, TypeError):
                    elevation = None

        # Count contained elements
        element_count = 0
        try:
            for rel in getattr(entity, "ContainsElements", []) or []:
                element_count += len(rel.RelatedElements or [])
        except Exception:
            pass

        nodes.append({
            "express_id": entity.id(),
            "ifc_type": ifc_type,
            "name": name,
            "long_name": long_name,
            "parent_express_id": parent_id,
            "elevation": elevation,
            "element_count": element_count,
        })

        # Recurse into children via IfcRelAggregates
        try:
            for rel in getattr(entity, "IsDecomposedBy", []) or []:
                for child in rel.RelatedObjects or []:
                    process_spatial(child, entity.id())
        except Exception:
            pass

    # Start from IfcProject
    for project in model.by_type("IfcProject"):
        process_spatial(project)

    return nodes


# ── Main parse function ─────────────────────────────────────────

def parse_ifc_file(file_path: str, model_name: str = None):
    """Parse an IFC file and write results to Supabase."""
    path = Path(file_path)
    if not path.exists():
        print(f"ERROR: File not found: {file_path}")
        sys.exit(1)

    file_size = path.stat().st_size
    if not model_name:
        model_name = path.stem

    print(f"[IFC Parser] Opening {path.name} ({file_size / 1024 / 1024:.1f} MB)...")
    t0 = time.time()

    model = ifcopenshell.open(str(path))
    schema = model.schema
    print(f"[IFC Parser] Schema: {schema}, opened in {time.time() - t0:.1f}s")

    # Create model record in Supabase
    model_id = str(uuid.uuid4())
    supabase.table("ifc_models").insert({
        "id": model_id,
        "name": model_name,
        "file_name": path.name,
        "file_size": file_size,
        "schema_version": schema,
        "parse_status": "parsing",
    }).execute()

    print(f"[IFC Parser] Model ID: {model_id}")

    # Build storey map
    print("[IFC Parser] Building storey map...")
    storey_map = build_storey_map(model)
    print(f"[IFC Parser] Mapped {len(storey_map)} elements to storeys")

    # Build spatial tree
    print("[IFC Parser] Building spatial tree...")
    spatial_nodes = build_spatial_tree(model)
    print(f"[IFC Parser] Found {len(spatial_nodes)} spatial nodes")

    # Insert spatial tree
    if spatial_nodes:
        for node in spatial_nodes:
            node["model_id"] = model_id
        # Batch insert
        for i in range(0, len(spatial_nodes), 500):
            batch = spatial_nodes[i:i + 500]
            supabase.table("ifc_spatial_tree").insert(batch).execute()
        print(f"[IFC Parser] Inserted {len(spatial_nodes)} spatial nodes")

    # Get all physical elements (exclude spatial structure and relationships)
    all_elements = []
    skip_types = {"IfcProject", "IfcSite", "IfcBuilding", "IfcBuildingStorey",
                  "IfcSpace", "IfcOwnerHistory", "IfcGeometricRepresentationContext",
                  "IfcRelDefinesByProperties", "IfcRelAssociatesMaterial",
                  "IfcRelContainedInSpatialStructure", "IfcRelAggregates",
                  "IfcPropertySet", "IfcPropertySingleValue", "IfcMaterial",
                  "IfcMaterialLayerSet", "IfcMaterialLayer", "IfcCartesianPoint",
                  "IfcDirection", "IfcAxis2Placement3D", "IfcLocalPlacement",
                  "IfcShapeRepresentation", "IfcProductDefinitionShape"}

    for entity in model:
        ifc_type = entity.is_a()
        # Include only product types (elements with geometry)
        if hasattr(entity, "GlobalId") and ifc_type not in skip_types:
            if hasattr(entity, "Representation") or hasattr(entity, "ObjectPlacement"):
                all_elements.append(entity)

    total = len(all_elements)
    print(f"[IFC Parser] Processing {total} elements...")

    # Process elements
    rows = []
    for i, element in enumerate(all_elements):
        try:
            data = extract_element_data(element, model, storey_map)
            data["model_id"] = model_id
            rows.append(data)
        except Exception as e:
            print(f"  [WARN] Failed to process #{element.id()} ({element.is_a()}): {e}")

        if (i + 1) % 100 == 0 or i == total - 1:
            pct = round((i + 1) / total * 100)
            print(f"  [{pct}%] Processed {i + 1}/{total} elements, {len(rows)} rows ready")

        # Batch insert every 1000 rows
        if len(rows) >= 1000:
            supabase.table("ifc_elements").insert(rows).execute()
            print(f"  -> Inserted batch of {len(rows)} rows")
            rows = []

    # Insert remaining rows
    if rows:
        supabase.table("ifc_elements").insert(rows).execute()
        print(f"  -> Inserted final batch of {len(rows)} rows")

    # Update model status
    supabase.table("ifc_models").update({
        "parse_status": "done",
        "element_count": total,
        "parsed_at": "now()",
    }).eq("id", model_id).execute()

    elapsed = time.time() - t0
    print(f"\n[IFC Parser] Done! Parsed {total} elements in {elapsed:.1f}s")
    print(f"[IFC Parser] Model ID: {model_id}")
    return model_id


# ── CLI ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python parse_ifc.py <path_to_ifc_file> [--model-name <name>]")
        sys.exit(1)

    ifc_path = sys.argv[1]
    model_name = None

    if "--model-name" in sys.argv:
        idx = sys.argv.index("--model-name")
        if idx + 1 < len(sys.argv):
            model_name = sys.argv[idx + 1]

    parse_ifc_file(ifc_path, model_name)
