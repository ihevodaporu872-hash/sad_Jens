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
  expressId: number
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

    try {
      const relIds = api.GetLineIDsWithType(modelId, IFCRELDEFINESBYPROPERTIES);
      const relCount = relIds.size();

      for (let i = 0; i < relCount; i++) {
        const relId = relIds.get(i);
        try {
          const rel = api.GetLine(modelId, relId, false);
          if (!rel) continue;

          // Check if this relation references our expressId
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

          // Get the property definition
          const propDefRef = rel.RelatingPropertyDefinition;
          const propDefId =
            typeof propDefRef === 'object' && propDefRef !== null
              ? (propDefRef as { value: number }).value
              : (propDefRef as number);

          if (!propDefId) continue;

          try {
            const propDef = api.GetLine(modelId, propDefId, false);
            if (!propDef) continue;

            const psetName = safeStr(propDef.Name) || 'PropertySet';
            const properties: IfcProperty[] = [];

            const hasProperties = propDef.HasProperties as
              | { value: number }[]
              | number[]
              | undefined;

            if (Array.isArray(hasProperties)) {
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
            }

            if (properties.length > 0) {
              propertySets.push({ name: psetName, properties });
            }
          } catch {
            // skip property definition
          }
        } catch {
          // skip relation
        }
      }
    } catch (e) {
      console.warn('[IFC Properties] Error reading property sets:', e);
    }

    // Find materials via IfcRelAssociatesMaterial
    const materials: string[] = [];
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
            try {
              const mat = api.GetLine(modelId, matId, false);
              if (mat) {
                const matName = safeStr(mat.Name);
                if (matName) materials.push(matName);
              }
            } catch {
              // skip
            }
          }
        } catch {
          // skip relation
        }
      }
    } catch {
      // ignore material errors
    }

    // Find classifications via IfcRelAssociatesClassification
    const classifications: string[] = [];
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
          }
        } catch {
          // skip
        }
      }
    } catch {
      // ignore classification errors
    }

    // ── Extract quantity sets (IfcElementQuantity) ──
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

          try {
            const propDef = api.GetLine(modelId, propDefId, false);
            if (!propDef) continue;

            // Check if this is an IfcElementQuantity (has Quantities instead of HasProperties)
            const quantities = propDef.Quantities as
              | { value: number }[]
              | number[]
              | undefined;

            if (quantities && Array.isArray(quantities)) {
              const qtoName = safeStr(propDef.Name) || 'QuantitySet';
              const qtoProperties: IfcProperty[] = [];

              // Check if this pset was already added as a property set (avoid duplicates)
              const alreadyAdded = propertySets.some((ps) => ps.name === qtoName);
              if (alreadyAdded) continue;

              for (const qRef of quantities) {
                const qId =
                  typeof qRef === 'object' && qRef !== null
                    ? (qRef as { value: number }).value
                    : (qRef as number);

                try {
                  const q = api.GetLine(modelId, qId, false);
                  if (!q) continue;

                  const qName = safeStr(q.Name);
                  // IfcQuantityLength/Area/Volume/Count/Weight all have value fields
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
            // skip
          }
        } catch {
          // skip
        }
      }
    } catch {
      // ignore quantity set errors
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
  const entries: ElementIndexEntry[] = [];
  const total = expressIds.length;
  const BATCH = 50;

  for (let i = 0; i < total; i += BATCH) {
    const batch = expressIds.slice(i, i + BATCH);
    for (const eid of batch) {
      try {
        const info = getElementProperties(ifcApi, modelId, eid);
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
