import { useMemo, useCallback } from 'react';
import type { AnnotationItem, AnnotationLayer, AnnotationPoint } from './types';

interface PdfOverlayProps {
  pageIndex: number; // 1-based
  viewportWidth: number;
  viewportHeight: number;
  layers: AnnotationLayer[];
  selectedItemId: string | null;
  onItemClick: (item: AnnotationItem) => void;
}

/**
 * Compute centroid of a polygon for label placement
 */
function computeCentroid(points: AnnotationPoint[]): AnnotationPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / points.length, y: cy / points.length };
}

/**
 * Compute area of a polygon using the Shoelace formula (in PDF coordinate units)
 */
function computePolygonArea(points: AnnotationPoint[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Format area value with units
 */
function formatArea(area: number, scaleX?: number, scaleUnits?: string): string {
  if (scaleX && scaleX > 0 && scaleUnits) {
    // Convert from PDF units² to real units²
    const realArea = area / (scaleX * scaleX);
    if (realArea >= 1) {
      return `${realArea.toFixed(2)} ${scaleUnits}²`;
    }
    return `${realArea.toFixed(4)} ${scaleUnits}²`;
  }
  return `${area.toFixed(1)} px²`;
}

export function PdfOverlay({
  pageIndex,
  viewportWidth,
  viewportHeight,
  layers,
  selectedItemId,
  onItemClick,
}: PdfOverlayProps) {
  // Collect all visible items for this page across all visible layers
  const pageItems = useMemo(() => {
    const items: Array<{ item: AnnotationItem; layerColor: string; layerOpacity: number }> = [];
    for (const layer of layers) {
      if (!layer.visible) continue;
      for (const item of layer.items) {
        if (item.page === pageIndex) {
          items.push({
            item,
            layerColor: layer.color,
            layerOpacity: layer.opacity,
          });
        }
      }
    }
    return items;
  }, [layers, pageIndex]);

  const handleItemClick = useCallback(
    (e: React.MouseEvent, item: AnnotationItem) => {
      e.stopPropagation();
      onItemClick(item);
    },
    [onItemClick],
  );

  if (pageItems.length === 0) return null;

  return (
    <svg
      className="pdf-annotation-overlay"
      width={viewportWidth}
      height={viewportHeight}
      viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    >
      {pageItems.map(({ item, layerColor, layerOpacity }) => {
        const color = item.color || layerColor;
        const opacity = item.opacity ?? layerOpacity;
        const isSelected = item.id === selectedItemId;

        switch (item.kind) {
          case 'count_point':
            return (
              <CountPointMarker
                key={item.id}
                item={item}
                color={color}
                opacity={opacity}
                isSelected={isSelected}
                onClick={handleItemClick}
              />
            );

          case 'dimension_line':
            return (
              <DimensionLineMarker
                key={item.id}
                item={item}
                color={color}
                opacity={opacity}
                isSelected={isSelected}
                onClick={handleItemClick}
              />
            );

          case 'area_polygon':
            return (
              <AreaPolygonMarker
                key={item.id}
                item={item}
                color={color}
                opacity={opacity}
                isSelected={isSelected}
                onClick={handleItemClick}
              />
            );

          default:
            return null;
        }
      })}
    </svg>
  );
}

// --- Sub-components for each annotation type ---

interface MarkerProps {
  item: AnnotationItem;
  color: string;
  opacity: number;
  isSelected: boolean;
  onClick: (e: React.MouseEvent, item: AnnotationItem) => void;
}

function CountPointMarker({ item, color, opacity, isSelected, onClick }: MarkerProps) {
  const point = item.points[0];
  if (!point) return null;

  const radius = isSelected ? 8 : 6;

  return (
    <g
      style={{ pointerEvents: 'all', cursor: 'pointer' }}
      onClick={(e) => onClick(e, item)}
    >
      {/* Hit area (larger invisible circle) */}
      <circle
        cx={point.x}
        cy={point.y}
        r={12}
        fill="transparent"
      />
      {/* Visible marker */}
      <circle
        cx={point.x}
        cy={point.y}
        r={radius}
        fill={color}
        fillOpacity={opacity * 0.6}
        stroke={isSelected ? '#ffffff' : color}
        strokeWidth={isSelected ? 3 : 2}
        strokeOpacity={opacity}
      />
      {/* Selection ring */}
      {isSelected && (
        <circle
          cx={point.x}
          cy={point.y}
          r={radius + 4}
          fill="none"
          stroke="#ffffff"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          opacity={0.8}
        />
      )}
      {/* Label */}
      {item.label && (
        <text
          x={point.x + radius + 4}
          y={point.y + 4}
          fill={color}
          fontSize={12}
          fontFamily="Arial, sans-serif"
          fontWeight={isSelected ? 'bold' : 'normal'}
          opacity={opacity}
          style={{ pointerEvents: 'none' }}
        >
          {item.label}
        </text>
      )}
    </g>
  );
}

function DimensionLineMarker({ item, color, opacity, isSelected, onClick }: MarkerProps) {
  if (item.points.length < 2) {
    return <CountPointMarker item={item} color={color} opacity={opacity} isSelected={isSelected} onClick={onClick} />;
  }

  const [p1, p2] = item.points;
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  return (
    <g
      style={{ pointerEvents: 'all', cursor: 'pointer' }}
      onClick={(e) => onClick(e, item)}
    >
      {/* Hit area (thicker invisible line) */}
      <line
        x1={p1.x} y1={p1.y}
        x2={p2.x} y2={p2.y}
        stroke="transparent"
        strokeWidth={12}
      />
      {/* Visible line */}
      <line
        x1={p1.x} y1={p1.y}
        x2={p2.x} y2={p2.y}
        stroke={isSelected ? '#ffffff' : color}
        strokeWidth={isSelected ? 3 : 2}
        strokeOpacity={opacity}
        markerStart="url(#arrowStart)"
        markerEnd="url(#arrowEnd)"
      />
      {/* Endpoint circles */}
      <circle cx={p1.x} cy={p1.y} r={4} fill={color} fillOpacity={opacity} />
      <circle cx={p2.x} cy={p2.y} r={4} fill={color} fillOpacity={opacity} />
      {/* Selection highlight */}
      {isSelected && (
        <line
          x1={p1.x} y1={p1.y}
          x2={p2.x} y2={p2.y}
          stroke="#ffffff"
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.6}
        />
      )}
      {/* Label at midpoint */}
      {item.label && (
        <text
          x={midX}
          y={midY - 8}
          fill={color}
          fontSize={12}
          fontFamily="Arial, sans-serif"
          fontWeight={isSelected ? 'bold' : 'normal'}
          textAnchor="middle"
          opacity={opacity}
          style={{ pointerEvents: 'none' }}
        >
          {item.label}
        </text>
      )}
    </g>
  );
}

function AreaPolygonMarker({ item, color, opacity, isSelected, onClick }: MarkerProps) {
  if (item.points.length < 3) {
    return <DimensionLineMarker item={item} color={color} opacity={opacity} isSelected={isSelected} onClick={onClick} />;
  }

  const pathData = item.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ') + ' Z';

  const centroid = computeCentroid(item.points);
  const area = computePolygonArea(item.points);
  const meta = item.meta as Record<string, unknown> | undefined;
  const scaleX = meta?.scaleX as number | undefined;
  const scaleUnits = meta?.scaleUnits as string | undefined;
  const areaLabel = item.label || formatArea(area, scaleX, scaleUnits);

  return (
    <g
      style={{ pointerEvents: 'all', cursor: 'pointer' }}
      onClick={(e) => onClick(e, item)}
    >
      {/* Fill */}
      <path
        d={pathData}
        fill={color}
        fillOpacity={opacity * 0.25}
        stroke={isSelected ? '#ffffff' : color}
        strokeWidth={isSelected ? 3 : 2}
        strokeOpacity={opacity}
        strokeLinejoin="round"
      />
      {/* Selection outline */}
      {isSelected && (
        <path
          d={pathData}
          fill="none"
          stroke="#ffffff"
          strokeWidth={1.5}
          strokeDasharray="5 5"
          opacity={0.7}
        />
      )}
      {/* Vertex dots */}
      {item.points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3}
          fill={color}
          fillOpacity={opacity}
        />
      ))}
      {/* Area label at centroid */}
      <text
        x={centroid.x}
        y={centroid.y}
        fill={isSelected ? '#ffffff' : color}
        fontSize={13}
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="central"
        opacity={Math.min(opacity + 0.2, 1)}
        style={{ pointerEvents: 'none' }}
      >
        {areaLabel}
      </text>
    </g>
  );
}
