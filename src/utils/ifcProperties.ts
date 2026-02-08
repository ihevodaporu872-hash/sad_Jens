/**
 * Utility to extract IFC properties from web-ifc API for a given expressId.
 *
 * web-ifc GetLine returns raw IFC entity data. We need to navigate relationships
 * to find property sets (IfcRelDefinesByProperties), materials, and classifications.
 */

import type { IfcElementInfo, IfcPropertySet, IfcProperty, IfcKeyParams, ElementIndexEntry } from '../types/ifc';

// IFC type constants from web-ifc
const IFCRELDEFINESBYPROPERTIES = 4186316022;
const IFCRELASSOCIATESMATERIAL = 2655215786;
const IFCRELASSOCIATESCLASSIFICATION = 919958153;
const IFCRELCONTAINEDINSPATIALSTRUCTURE = 3242617779;

// Pre-built relationship index for O(1) lookups
export interface RelationshipIndex {
  // expressId -> array of property definition IDs
  propertyDefs: Map<number, number[]>;
  // expressId -> array of material IDs
  materials: Map<number, number[]>;
  // expressId -> array of classification IDs
  classifications: Map<number, number[]>;
  // expressId -> spatial structure (floor) ID
  spatialContainment: Map<number, number>;
}

export function buildRelationshipIndex(
  ifcApi: unknown,
  modelId: number
): RelationshipIndex {
  const api = ifcApi as {
    GetLine: (m: number, e: number, flat?: boolean) => Record<string, unknown>;
    GetLineIDsWithType: (m: number, t: number) => { size: () => number; get: (i: number) => number };
  };

  const propertyDefs = new Map<number, number[]>();
  const materials = new Map<number, number[]>();
  const classifications = new Map<number, number[]>();
  const spatialContainment = new Map<number, number>();

  // Helper to extract expressId from reference
  const getId = (ref: unknown): number | null => {
    if (typeof ref === 'number') return ref;
    if (typeof ref === 'object' && ref !== null && 'value' in (ref as Record<string, unknown>)) {
      return (ref as { value: number }).value;
    }
    return null;
  };

  const getRelatedIds = (rel: Record<string, unknown>, field: string): number[] => {
    const arr = rel[field] as unknown[] | undefined;
    if (!Array.isArray(arr)) return [];
    const ids: number[] = [];
    for (const item of arr) {
      const id = getId(item);
      if (id !== null) ids.push(id);
    }
    return ids;
  };

  // Index IfcRelDefinesByProperties
  try {
    const relIds = api.GetLineIDsWithType(modelId, IFCRELDEFINESBYPROPERTIES);
    for (let i = 0, len = relIds.size(); i < len; i++) {
      try {
        const rel = api.GetLine(modelId, relIds.get(i), false);
        if (!rel) continue;
        const propDefId = getId(rel.RelatingPropertyDefinition);
        if (!propDefId) continue;
        const objectIds = getRelatedIds(rel, 'RelatedObjects');
        for (const eid of objectIds) {
          if (!propertyDefs.has(eid)) propertyDefs.set(eid, []);
          propertyDefs.get(eid)!.push(propDefId);
        }
      } catch { /* skip */ }
    }
  } catch { /* ignore */ }

  // Index IfcRelAssociatesMaterial
  try {
    const relIds = api.GetLineIDsWithType(modelId, IFCRELASSOCIATESMATERIAL);
    for (let i = 0, len = relIds.size(); i < len; i++) {
      try {
        const rel = api.GetLine(modelId, relIds.get(i), false);
        if (!rel) continue;
        const matId = getId(rel.RelatingMaterial);
        if (!matId) continue;
        const objectIds = getRelatedIds(rel, 'RelatedObjects');
        for (const eid of objectIds) {
          if (!materials.has(eid)) materials.set(eid, []);
          materials.get(eid)!.push(matId);
        }
      } catch { /* skip */ }
    }
  } catch { /* ignore */ }

  // Index IfcRelAssociatesClassification
  try {
    const relIds = api.GetLineIDsWithType(modelId, IFCRELASSOCIATESCLASSIFICATION);
    for (let i = 0, len = relIds.size(); i < len; i++) {
      try {
        const rel = api.GetLine(modelId, relIds.get(i), false);
        if (!rel) continue;
        const classId = getId(rel.RelatingClassification);
        if (!classId) continue;
        const objectIds = getRelatedIds(rel, 'RelatedObjects');
        for (const eid of objectIds) {
          if (!classifications.has(eid)) classifications.set(eid, []);
          classifications.get(eid)!.push(classId);
        }
      } catch { /* skip */ }
    }
  } catch { /* ignore */ }

  // Index IfcRelContainedInSpatialStructure
  try {
    const relIds = api.GetLineIDsWithType(modelId, IFCRELCONTAINEDINSPATIALSTRUCTURE);
    for (let i = 0, len = relIds.size(); i < len; i++) {
      try {
        const rel = api.GetLine(modelId, relIds.get(i), false);
        if (!rel) continue;
        const structId = getId(rel.RelatingStructure);
        if (!structId) continue;
        const elementIds = getRelatedIds(rel, 'RelatedElements');
        for (const eid of elementIds) {
          spatialContainment.set(eid, structId);
        }
      } catch { /* skip */ }
    }
  } catch { /* ignore */ }

  return { propertyDefs, materials, classifications, spatialContainment };
}

// Property name patterns for key params extraction
const VOLUME_NAMES = ['netvolume', 'grossvolume', 'volume', 'объем', 'объём'];
const AREA_NAMES = ['netarea', 'grossarea', 'netsidearea', 'grosssidearea', 'area', 'площадь', 'crosssectionarea', 'outersurfacearea', 'totalsurfacearea', 'netsurfacearea'];
const HEIGHT_NAMES = ['height', 'overallheight', 'nominalheight', 'высота'];
const LENGTH_NAMES = ['length', 'overalllength', 'nominallength', 'длина', 'span'];
const CONCRETE_CLASS_NAMES = ['concretestrength', 'concreteclass', 'concretegrade', 'класс бетона', 'класс_бетона', 'classofconcrete', 'strengthclass', 'марка бетона'];

function matchesAny(name: string, patterns: string[]): boolean {
  const lower = name.toLowerCase().replace(/[\s_-]/g, '');
  return patterns.some((p) => lower.includes(p.replace(/[\s_-]/g, '')));
}

function formatValue(val: string | number | boolean | null): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    // Round to 3 decimals for readability
    return Number.isInteger(val) ? String(val) : val.toFixed(3);
  }
  return String(val);
}

function safeStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && 'value' in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>).value ?? '');
  }
  return String(val);
}

function getTypeName(ifcApi: unknown, modelId: number, expressId: number): string {
  try {
    const api = ifcApi as { GetLine: (m: number, e: number, flat?: boolean) => Record<string, unknown> };
    const entity = api.GetLine(modelId, expressId, false);
    if (!entity) return 'Unknown';
    const typeName = entity.constructor?.name || entity.type?.toString() || 'Unknown';
    return typeName.replace('Ifc', 'IFC ');
  } catch {
    return 'Unknown';
  }
}

export function getElementProperties(
  ifcApi: unknown,
  modelId: number,
  expressId: number,
  index?: RelationshipIndex
): IfcElementInfo | null {
  try {
    const api = ifcApi as {
      GetLine: (m: number, e: number, flat?: boolean) => Record<string, unknown>;
      GetLineIDsWithType: (m: number, t: number) => { size: () => number; get: (i: number) => number };
    };

    // Get the entity itself
    const entity = api.GetLine(modelId, expressId, false);
    if (!entity) return null;

    const globalId = safeStr(entity.GlobalId);
    const name = safeStr(entity.Name);
    const description = safeStr(entity.Description);
    const ifcType = getTypeName(ifcApi, modelId, expressId);

    // Find property sets via IfcRelDefinesByProperties
    const propertySets: IfcPropertySet[] = [];

    // Helper to extract properties from a propDefId
    const extractPropDef = (propDefId: number) => {
      try {
        const propDef = api.GetLine(modelId, propDefId, false);
        if (!propDef) return;

        const psetName = safeStr(propDef.Name) || 'PropertySet';

        // Extract regular properties (IfcPropertySet)
        const hasProperties = propDef.HasProperties as
          | { value: number }[]
          | number[]
          | undefined;

        if (Array.isArray(hasProperties)) {
          const properties: IfcProperty[] = [];
          for (const propRef of hasProperties) {
            const propId =
              typeof propRef === 'object' && propRef !== null
                ? (propRef as { value: number }).value
                : (propRef as number);

            try {
              const prop = api.GetLine(modelId, propId, false);
              if (!prop) continue;

              const propName = safeStr(prop.Name);
              let propValue: string | number | boolean | null = null;

              if (prop.NominalValue !== undefined && prop.NominalValue !== null) {
                const nomVal = prop.NominalValue;
                if (typeof nomVal === 'object' && nomVal !== null && 'value' in (nomVal as Record<string, unknown>)) {
                  propValue = (nomVal as Record<string, unknown>).value as string | number | boolean;
                } else {
                  propValue = nomVal as string | number | boolean;
                }
              }

              properties.push({ name: propName, value: propValue });
            } catch {
              // skip individual property
            }
          }

          if (properties.length > 0) {
            propertySets.push({ name: psetName, properties });
          }
        }

        // Extract quantity sets (IfcElementQuantity — has Quantities instead of HasProperties)
        const quantities = propDef.Quantities as
          | { value: number }[]
          | number[]
          | undefined;

        if (quantities && Array.isArray(quantities)) {
          const qtoName = safeStr(propDef.Name) || 'QuantitySet';
          // Check if this pset was already added as a property set (avoid duplicates)
          const alreadyAdded = propertySets.some((ps) => ps.name === qtoName);
          if (alreadyAdded) return;

          const qtoProperties: IfcProperty[] = [];

          for (const qRef of quantities) {
            const qId =
              typeof qRef === 'object' && qRef !== null
                ? (qRef as { value: number }).value
                : (qRef as number);

            try {
              const q = api.GetLine(modelId, qId, false);
              if (!q) continue;

              const qName = safeStr(q.Name);
              let qValue: string | number | boolean | null = null;
              for (const field of ['LengthValue', 'AreaValue', 'VolumeValue', 'CountValue', 'WeightValue', 'TimeValue']) {
                if (q[field] !== undefined && q[field] !== null) {
                  const v = q[field];
                  if (typeof v === 'object' && v !== null && 'value' in (v as Record<string, unknown>)) {
                    qValue = (v as Record<string, unknown>).value as string | number | boolean;
                  } else {
                    qValue = v as string | number | boolean;
                  }
                  break;
                }
              }

              if (qName) {
                qtoProperties.push({ name: qName, value: qValue });
              }
            } catch {
              // skip individual quantity
            }
          }

          if (qtoProperties.length > 0) {
            propertySets.push({ name: qtoName, properties: qtoProperties });
          }
        }
      } catch {
        // skip property definition
      }
    };

    if (index) {
      // ── FAST PATH: use pre-built index for O(1) lookups ──
      const propDefIds = index.propertyDefs.get(expressId) || [];
      for (const propDefId of propDefIds) {
        extractPropDef(propDefId);
      }
    } else {
      // ── SLOW PATH: full scan of all relationships (fallback) ──
      try {
        const relIds = api.GetLineIDsWithType(modelId, IFCRELDEFINESBYPROPERTIES);
        const relCount = relIds.size();

        for (let i = 0; i < relCount; i++) {
          const relId = relIds.get(i);
          try {
            const rel = api.GetLine(modelId, relId, false);
            if (!rel) continue;

            const relatedObjects = rel.RelatedObjects as
              | { value: number }[]
              | number[]
              | undefined;
            if (!relatedObjects) continue;

            let found = false;
            if (Array.isArray(relatedObjects)) {
              for (const obj of relatedObjects) {
                const objId = typeof obj === 'object' && obj !== null ? (obj as { value: number }).value : obj;
                if (objId === expressId) {
                  found = true;
                  break;
                }
              }
            }
            if (!found) continue;

            const propDefRef = rel.RelatingPropertyDefinition;
            const propDefId =
              typeof propDefRef === 'object' && propDefRef !== null
                ? (propDefRef as { value: number }).value
                : (propDefRef as number);

            if (!propDefId) continue;
            extractPropDef(propDefId);
          } catch {
            // skip relation
          }
        }
      } catch (e) {
        console.warn('[IFC Properties] Error reading property sets:', e);
      }
    }

    // Find materials via IfcRelAssociatesMaterial
    const materials: string[] = [];

    // Helper to resolve material name from matId
    const resolveMaterial = (matId: number) => {
      try {
        const mat = api.GetLine(modelId, matId, false);
        if (mat) {
          const matName = safeStr(mat.Name);
          if (matName) materials.push(matName);
        }
      } catch {
        // skip
      }
    };

    if (index) {
      // ── FAST PATH ──
      const matIds = index.materials.get(expressId) || [];
      for (const matId of matIds) {
        resolveMaterial(matId);
      }
    } else {
      // ── SLOW PATH ──
      try {
        const matRelIds = api.GetLineIDsWithType(modelId, IFCRELASSOCIATESMATERIAL);
        const matRelCount = matRelIds.size();

        for (let i = 0; i < matRelCount; i++) {
          const relId = matRelIds.get(i);
          try {
            const rel = api.GetLine(modelId, relId, false);
            if (!rel) continue;

            const relatedObjects = rel.RelatedObjects as { value: number }[] | number[] | undefined;
            if (!relatedObjects) continue;

            let found = false;
            if (Array.isArray(relatedObjects)) {
              for (const obj of relatedObjects) {
                const objId = typeof obj === 'object' && obj !== null ? (obj as { value: number }).value : obj;
                if (objId === expressId) {
                  found = true;
                  break;
                }
              }
            }
            if (!found) continue;

            const matRef = rel.RelatingMaterial;
            const matId =
              typeof matRef === 'object' && matRef !== null
                ? (matRef as { value: number }).value
                : (matRef as number);

            if (matId) {
              resolveMaterial(matId);
            }
          } catch {
            // skip relation
          }
        }
      } catch {
        // ignore material errors
      }
    }

    // Find classifications via IfcRelAssociatesClassification
    const classifications: string[] = [];

    // Helper to resolve classification from classId
    const resolveClassification = (classId: number) => {
      try {
        const classEntity = api.GetLine(modelId, classId, false);
        if (classEntity) {
          const className = safeStr(classEntity.Name);
          const classCode = safeStr(classEntity.ItemReference || classEntity.Identification);
          if (className || classCode) {
            classifications.push(classCode ? `${classCode}: ${className}` : className);
          }
        }
      } catch {
        // skip
      }
    };

    if (index) {
      // ── FAST PATH ──
      const classIds = index.classifications.get(expressId) || [];
      for (const classId of classIds) {
        resolveClassification(classId);
      }
    } else {
      // ── SLOW PATH ──
      try {
        const classRelIds = api.GetLineIDsWithType(modelId, IFCRELASSOCIATESCLASSIFICATION);
        const classRelCount = classRelIds.size();

        for (let i = 0; i < classRelCount; i++) {
          const relId = classRelIds.get(i);
          try {
            const rel = api.GetLine(modelId, relId, false);
            if (!rel) continue;

            const relatedObjects = rel.RelatedObjects as { value: number }[] | number[] | undefined;
            if (!relatedObjects) continue;

            let found = false;
            if (Array.isArray(relatedObjects)) {
              for (const obj of relatedObjects) {
                const objId = typeof obj === 'object' && obj !== null ? (obj as { value: number }).value : obj;
                if (objId === expressId) {
                  found = true;
                  break;
                }
              }
            }
            if (!found) continue;

            const classRef = rel.RelatingClassification;
            const classId =
              typeof classRef === 'object' && classRef !== null
                ? (classRef as { value: number }).value
                : (classRef as number);

            if (classId) {
              resolveClassification(classId);
            }
          } catch {
            // skip
          }
        }
      } catch {
        // ignore classification errors
      }
    }

    // ── Extract key parameters from property sets (including quantity sets) ──
    const keyParams: IfcKeyParams = {};

    for (const pset of propertySets) {
      for (const prop of pset.properties) {
        const pName = prop.name;
        const pVal = formatValue(prop.value);
        if (!pVal) continue;

        if (!keyParams.volume && matchesAny(pName, VOLUME_NAMES)) {
          keyParams.volume = pVal;
        }
        if (!keyParams.area && matchesAny(pName, AREA_NAMES)) {
          keyParams.area = pVal;
        }
        if (!keyParams.height && matchesAny(pName, HEIGHT_NAMES)) {
          keyParams.height = pVal;
        }
        if (!keyParams.length && matchesAny(pName, LENGTH_NAMES)) {
          keyParams.length = pVal;
        }
        if (!keyParams.concreteClass && matchesAny(pName, CONCRETE_CLASS_NAMES)) {
          keyParams.concreteClass = pVal;
        }
      }
    }

    // ── Find floor (IfcBuildingStorey) via spatial containment ──
    if (index) {
      // ── FAST PATH ──
      const structId = index.spatialContainment.get(expressId);
      if (structId) {
        try {
          const struct = api.GetLine(modelId, structId, false);
          if (struct) {
            const floorName = safeStr(struct.Name) || safeStr(struct.LongName);
            if (floorName) keyParams.floor = floorName;
          }
        } catch { /* skip */ }
      }
    } else {
      // ── SLOW PATH ──
      try {
        const contRelIds = api.GetLineIDsWithType(modelId, IFCRELCONTAINEDINSPATIALSTRUCTURE);
        const contRelCount = contRelIds.size();

        for (let i = 0; i < contRelCount; i++) {
          if (keyParams.floor) break;
          const relId = contRelIds.get(i);
          try {
            const rel = api.GetLine(modelId, relId, false);
            if (!rel) continue;

            const relatedElements = rel.RelatedElements as { value: number }[] | number[] | undefined;
            if (!relatedElements || !Array.isArray(relatedElements)) continue;

            let found = false;
            for (const elem of relatedElements) {
              const elemId = typeof elem === 'object' && elem !== null ? (elem as { value: number }).value : elem;
              if (elemId === expressId) { found = true; break; }
            }
            if (!found) continue;

            const structRef = rel.RelatingStructure;
            const structId = typeof structRef === 'object' && structRef !== null
              ? (structRef as { value: number }).value
              : (structRef as number);
            if (structId) {
              const struct = api.GetLine(modelId, structId, false);
              if (struct) {
                const floorName = safeStr(struct.Name) || safeStr(struct.LongName);
                if (floorName) keyParams.floor = floorName;
              }
            }
          } catch { /* skip */ }
        }
      } catch { /* ignore */ }
    }

    return {
      expressId,
      globalId,
      ifcType,
      name,
      description: description || undefined,
      keyParams,
      propertySets,
      materials,
      classifications,
    };
  } catch (e) {
    console.error('[IFC Properties] Failed to get element properties:', e);
    return null;
  }
}

/**
 * Build a lightweight index of ALL elements in the model for filtering/quantification.
 * Processes in batches to avoid blocking the UI.
 */
export async function buildElementIndex(
  ifcApi: unknown,
  modelId: number,
  expressIds: number[],
  onProgress?: (done: number, total: number) => void
): Promise<ElementIndexEntry[]> {
  // Build relationship index once — O(R) where R = total relationships
  const relIndex = buildRelationshipIndex(ifcApi, modelId);

  const entries: ElementIndexEntry[] = [];
  const total = expressIds.length;
  const BATCH = 50;

  for (let i = 0; i < total; i += BATCH) {
    const batch = expressIds.slice(i, i + BATCH);
    for (const eid of batch) {
      try {
        const info = getElementProperties(ifcApi, modelId, eid, relIndex);
        if (!info) continue;

        const searchableProps: string[] = [];
        for (const pset of info.propertySets) {
          for (const p of pset.properties) {
            if (p.value !== null && p.value !== undefined) {
              searchableProps.push(`${p.name}=${String(p.value)}`);
            }
          }
        }

        entries.push({
          expressId: eid,
          ifcType: info.ifcType,
          name: info.name,
          floor: info.keyParams.floor || '',
          volume: parseFloat(info.keyParams.volume || '0') || 0,
          area: parseFloat(info.keyParams.area || '0') || 0,
          height: parseFloat(info.keyParams.height || '0') || 0,
          length: parseFloat(info.keyParams.length || '0') || 0,
          material: info.materials[0] || '',
          searchableProps,
        });
      } catch {
        // skip element
      }
    }
    onProgress?.(Math.min(i + BATCH, total), total);
    // Yield to UI thread
    await new Promise((r) => setTimeout(r, 0));
  }

  return entries;
}
