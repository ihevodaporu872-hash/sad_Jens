import type { AnnotationModel, AnnotationLayer, AnnotationItem, AnnotationPoint, AnnotationKind } from './types';

/**
 * Parse Windows COLORREF integer (0x00BBGGRR) to CSS hex color
 */
function colorRefToHex(colorRef: number): string {
  const r = colorRef & 0xff;
  const g = (colorRef >> 8) & 0xff;
  const b = (colorRef >> 16) & 0xff;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Parse transparency value (0-255 scale, where 255 = most opaque) to CSS opacity (0-1)
 */
function transparencyToOpacity(transparency: number): number {
  return Math.round((transparency / 255) * 100) / 100;
}

/**
 * Extract a named property value from an Item's Properties
 */
function getProperty(item: Element, name: string): string | null {
  const props = item.querySelectorAll('Property');
  for (const prop of props) {
    if (prop.getAttribute('Name') === name) {
      return prop.textContent?.trim() ?? null;
    }
  }
  return null;
}

/**
 * Parse DigitizerData XML string to extract points
 */
function parseDigitizerData(digitizerXml: string): AnnotationPoint[] {
  const points: AnnotationPoint[] = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(digitizerXml, 'text/xml');
    const pointElements = doc.querySelectorAll('Point');
    for (const pt of pointElements) {
      const x = parseFloat(pt.getAttribute('X') ?? '0');
      const y = parseFloat(pt.getAttribute('Y') ?? '0');
      if (!isNaN(x) && !isNaN(y)) {
        points.push({ x, y });
      }
    }
  } catch {
    console.warn('Failed to parse DigitizerData:', digitizerXml);
  }
  return points;
}

/**
 * Determine annotation kind based on number of points and item class
 */
function determineKind(points: AnnotationPoint[], itemClass: string): AnnotationKind {
  if (itemClass.toLowerCase().includes('area') || itemClass.toLowerCase().includes('polygon')) {
    return 'area_polygon';
  }
  if (itemClass.toLowerCase().includes('count')) {
    return 'count_point';
  }
  // For Dimension class or unknown
  if (points.length >= 3) return 'area_polygon';
  if (points.length === 2) return 'dimension_line';
  return 'count_point';
}

interface PageInfo {
  guid: string;
  name: string;
  pageIndex: number;
  scaleX: number;
  scaleY: number;
  scaleUnits: string;
  width: number;
  height: number;
}

/**
 * Parse multiple XML items (pages + annotations) into AnnotationModel.
 * The input can contain multiple XML documents separated by XML declarations,
 * or be wrapped in a root element.
 */
export function parseXmlMarkup(xmlText: string): AnnotationModel {
  // Normalize: wrap multiple XML declarations into a single document
  const normalizedXml = normalizeMultipleXmlDocs(xmlText);

  const parser = new DOMParser();
  const doc = parser.parseFromString(normalizedXml, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML parse error: ${parseError.textContent}`);
  }

  const items = doc.querySelectorAll('Item');
  if (items.length === 0) {
    throw new Error('No Item elements found in XML markup');
  }

  // First pass: collect pages
  const pages = new Map<string, PageInfo>();
  let pageIndex = 1;

  for (const item of items) {
    const itemClass = item.getAttribute('Class') ?? '';
    if (itemClass === 'Page') {
      const guid = getProperty(item, 'GUID') ?? item.getAttribute('GUID') ?? '';
      const name = getProperty(item, 'Name') ?? item.getAttribute('Name') ?? `Page ${pageIndex}`;
      const scaleX = parseFloat((getProperty(item, 'ScaleX') ?? '1').replace(',', '.'));
      const scaleY = parseFloat((getProperty(item, 'ScaleY') ?? '1').replace(',', '.'));
      const scaleUnits = getProperty(item, 'Scale Units') ?? '';
      const width = parseFloat((getProperty(item, 'PageWidth') ?? '0').replace(',', '.'));
      const height = parseFloat((getProperty(item, 'PageHeight') ?? '0').replace(',', '.'));

      pages.set(guid, {
        guid,
        name,
        pageIndex,
        scaleX: isNaN(scaleX) ? 1 : scaleX,
        scaleY: isNaN(scaleY) ? 1 : scaleY,
        scaleUnits,
        width,
        height,
      });
      pageIndex++;
    }
  }

  // Second pass: collect annotation items, group by layer (using item Name or Class)
  const layerMap = new Map<string, AnnotationLayer>();

  for (const item of items) {
    const itemClass = item.getAttribute('Class') ?? '';
    if (itemClass === 'Page') continue;

    const itemName = item.getAttribute('Name') ?? 'Unknown';
    const itemGuid = getProperty(item, 'GUID') ?? item.getAttribute('GUID') ?? crypto.randomUUID();
    const pageGuid = getProperty(item, 'PageGUID') ?? '';
    const colorStr = getProperty(item, 'Color');
    const transparencyStr = getProperty(item, 'Transparency');
    const digitizerData = getProperty(item, 'DigitizerData');

    if (!digitizerData) continue;

    const points = parseDigitizerData(digitizerData);
    if (points.length === 0) continue;

    // Resolve page number
    const pageInfo = pages.get(pageGuid);
    const pageNum = pageInfo ? pageInfo.pageIndex : 1;

    // Parse color
    const colorInt = colorStr ? parseInt(colorStr, 10) : null;
    const color = colorInt !== null && !isNaN(colorInt) ? colorRefToHex(colorInt) : undefined;

    // Parse transparency
    const transparency = transparencyStr ? parseInt(transparencyStr, 10) : 196;
    const opacity = transparencyToOpacity(isNaN(transparency) ? 196 : transparency);

    const kind = determineKind(points, itemClass);

    // Build annotation item
    const annotationItem: AnnotationItem = {
      id: itemGuid,
      page: pageNum,
      kind,
      color,
      opacity,
      label: itemName,
      points,
      closed: kind === 'area_polygon',
      meta: {
        class: itemClass,
        pageGuid,
        scaleX: pageInfo?.scaleX,
        scaleY: pageInfo?.scaleY,
        scaleUnits: pageInfo?.scaleUnits,
      },
    };

    // Group into layers by itemClass (e.g., "Dimension", "Area", "Count")
    const layerKey = itemClass || 'Default';
    if (!layerMap.has(layerKey)) {
      layerMap.set(layerKey, {
        id: layerKey.toLowerCase().replace(/\s+/g, '-'),
        name: layerKey,
        color: color ?? '#646cff',
        opacity,
        visible: true,
        items: [],
      });
    }

    layerMap.get(layerKey)!.items.push(annotationItem);
  }

  return {
    version: '1.0',
    pageCount: pages.size || undefined,
    layers: Array.from(layerMap.values()),
  };
}

/**
 * Handle XML text that may contain multiple XML documents
 * by wrapping them in a single root element
 */
function normalizeMultipleXmlDocs(xmlText: string): string {
  const trimmed = xmlText.trim();

  // If already wrapped in a root element, return as-is
  if (trimmed.startsWith('<Root') || trimmed.startsWith('<root') || trimmed.startsWith('<Items')) {
    return trimmed;
  }

  // Remove all XML declarations and wrap in root
  const cleaned = trimmed.replace(/<\?xml[^?]*\?>\s*/g, '');
  return `<?xml version="1.0" encoding="UTF-8"?><Root>${cleaned}</Root>`;
}
