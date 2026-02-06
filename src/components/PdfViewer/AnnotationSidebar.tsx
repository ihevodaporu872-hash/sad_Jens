import { useCallback } from 'react';
import type { AnnotationLayer, AnnotationItem } from './types';
import './AnnotationSidebar.css';

interface AnnotationSidebarProps {
  layers: AnnotationLayer[];
  selectedItemId: string | null;
  onToggleLayer: (layerId: string) => void;
  onChangeLayerColor: (layerId: string, color: string) => void;
  onChangeLayerOpacity: (layerId: string, opacity: number) => void;
  onSelectItem: (item: AnnotationItem) => void;
  onClose: () => void;
}

export function AnnotationSidebar({
  layers,
  selectedItemId,
  onToggleLayer,
  onChangeLayerColor,
  onChangeLayerOpacity,
  onSelectItem,
  onClose,
}: AnnotationSidebarProps) {
  const totalPoints = layers.reduce(
    (sum, l) => sum + l.items.filter(i => i.kind === 'count_point').length,
    0,
  );
  const totalPolygons = layers.reduce(
    (sum, l) => sum + l.items.filter(i => i.kind === 'area_polygon').length,
    0,
  );
  const totalDimensions = layers.reduce(
    (sum, l) => sum + l.items.filter(i => i.kind === 'dimension_line').length,
    0,
  );

  return (
    <div className="annotation-sidebar">
      <div className="annotation-sidebar-header">
        <h3>Markup Layers</h3>
        <button className="annotation-sidebar-close" onClick={onClose} title="Close sidebar">
          &times;
        </button>
      </div>

      <div className="annotation-sidebar-stats">
        {totalPoints > 0 && <span className="stat-badge stat-points">{totalPoints} points</span>}
        {totalDimensions > 0 && <span className="stat-badge stat-dimensions">{totalDimensions} dimensions</span>}
        {totalPolygons > 0 && <span className="stat-badge stat-polygons">{totalPolygons} polygons</span>}
      </div>

      <div className="annotation-sidebar-layers">
        {layers.map(layer => (
          <LayerControl
            key={layer.id}
            layer={layer}
            selectedItemId={selectedItemId}
            onToggle={onToggleLayer}
            onChangeColor={onChangeLayerColor}
            onChangeOpacity={onChangeLayerOpacity}
            onSelectItem={onSelectItem}
          />
        ))}
      </div>
    </div>
  );
}

// --- Layer control sub-component ---

interface LayerControlProps {
  layer: AnnotationLayer;
  selectedItemId: string | null;
  onToggle: (layerId: string) => void;
  onChangeColor: (layerId: string, color: string) => void;
  onChangeOpacity: (layerId: string, opacity: number) => void;
  onSelectItem: (item: AnnotationItem) => void;
}

function LayerControl({
  layer,
  selectedItemId,
  onToggle,
  onChangeColor,
  onChangeOpacity,
  onSelectItem,
}: LayerControlProps) {
  const handleToggle = useCallback(() => {
    onToggle(layer.id);
  }, [layer.id, onToggle]);

  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChangeColor(layer.id, e.target.value);
    },
    [layer.id, onChangeColor],
  );

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChangeOpacity(layer.id, parseFloat(e.target.value));
    },
    [layer.id, onChangeOpacity],
  );

  const pointCount = layer.items.filter(i => i.kind === 'count_point').length;
  const polygonCount = layer.items.filter(i => i.kind === 'area_polygon').length;
  const dimensionCount = layer.items.filter(i => i.kind === 'dimension_line').length;

  return (
    <div className={`layer-control ${!layer.visible ? 'layer-hidden' : ''}`}>
      <div className="layer-header">
        <label className="layer-visibility">
          <input
            type="checkbox"
            checked={layer.visible}
            onChange={handleToggle}
          />
          <span className="layer-name">{layer.name}</span>
        </label>

        <div className="layer-controls">
          <input
            type="color"
            value={layer.color}
            onChange={handleColorChange}
            className="layer-color-picker"
            title="Layer color"
          />
        </div>
      </div>

      <div className="layer-opacity-row">
        <span className="layer-opacity-label">Opacity</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={layer.opacity}
          onChange={handleOpacityChange}
          className="layer-opacity-slider"
        />
        <span className="layer-opacity-value">{Math.round(layer.opacity * 100)}%</span>
      </div>

      <div className="layer-item-counts">
        {pointCount > 0 && <span>{pointCount} pt</span>}
        {dimensionCount > 0 && <span>{dimensionCount} dim</span>}
        {polygonCount > 0 && <span>{polygonCount} poly</span>}
      </div>

      {/* Item list */}
      <div className="layer-items">
        {layer.items.map(item => (
          <button
            key={item.id}
            className={`layer-item-row ${item.id === selectedItemId ? 'selected' : ''}`}
            onClick={() => onSelectItem(item)}
            title={`Page ${item.page} — ${item.kind}`}
          >
            <span className="item-icon">
              {item.kind === 'count_point' ? '●' : item.kind === 'dimension_line' ? '↔' : '⬡'}
            </span>
            <span className="item-label">{item.label || item.id.slice(0, 8)}</span>
            <span className="item-page">p.{item.page}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
