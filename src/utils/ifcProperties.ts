/**
 * Utility to extract IFC properties from web-ifc API for a given expressId.
 *
 * web-ifc GetLine returns raw IFC entity data. We need to navigate relationships
 * to find property sets (IfcRelDefinesByProperties), materials, and classifications.
 */

import type { IfcElementInfo, IfcPropertySet, IfcProperty } from '../types/ifc';

// IFC type constants from web-ifc
const IFCRELDEFINESBYPROPERTIES = 4186316022;
const IFCPROPERTYSET = 1451395588;
const IFCPROPERTYSINGLEVALUE = 3972844353;
const IFCRELMATERIALSINGLE = 3268803585;
const IFCRELASSOCIATESMATERIAL = 2655215786;
const IFCRELASSOCIATESCLASSIFICATION = 919958153;
const IFCMATERIAL = 1838606355;
const IFCMATERIALLAYERSETUSAGE = 1303795690;
const IFCMATERIALLAYERSET = 3303938423;
const IFCMATERIALLAYER = 248100487;

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

    return {
      expressId,
      globalId,
      ifcType,
      name,
      description: description || undefined,
      propertySets,
      materials,
      classifications,
    };
  } catch (e) {
    console.error('[IFC Properties] Failed to get element properties:', e);
    return null;
  }
}
