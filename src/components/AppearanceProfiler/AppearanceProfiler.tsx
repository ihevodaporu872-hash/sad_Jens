import { useState, useMemo, useCallback } from 'react';
import type { ElementIndexEntry } from '../../types/ifc';
import './AppearanceProfiler.css';

export interface AppearanceProfilerProps {
  elementIndex: ElementIndexEntry[];
  onColorElements: (expressIds: number[], color: string) => void;
  onResetColors: () => void;
  className?: string;
}

type ProfileProperty =
  | 'ifcType'
  | 'floor'
  | 'material'
  | 'volume'
  | 'area'
  | 'height'
  | 'length';

const CATEGORICAL_PROPERTIES: ProfileProperty[] = ['ifcType', 'floor', 'material'];
const NUMERIC_PROPERTIES: ProfileProperty[] = ['volume', 'area', 'height', 'length'];

const PROPERTY_LABELS: Record<ProfileProperty, string> = {
  ifcType: 'IFC Type',
  floor: 'Floor',
  material: 'Material',
  volume: 'Volume',
  area: 'Area',
  height: 'Height',
  length: 'Length',
};

/**
 * Generate N distinct colors evenly distributed in HSL hue space.
 */
function generatePaletteColors(count: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = Math.round((i * 360) / Math.max(count, 1));
    colors.push(`hsl(${hue}, 70%, 55%)`);
  }
  return colors;
}

/**
 * Convert HSL to hex string for passing to viewer.
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Generate palette as hex colors.
 */
function generatePaletteHex(count: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = Math.round((i * 360) / Math.max(count, 1));
    colors.push(hslToHex(hue, 70, 55));
  }
  return colors;
}

/**
 * Interpolate a numeric value to a color on a blue -> yellow -> red gradient.
 * t in [0, 1]: 0 = blue, 0.5 = yellow, 1 = red.
 */
function numericToColor(t: number): string {
  let r: number, g: number, b: number;
  if (t <= 0.5) {
    // blue (0,100,255) -> yellow (255,220,0)
    const u = t * 2; // 0..1
    r = Math.round(0 + u * 255);
    g = Math.round(100 + u * 120);
    b = Math.round(255 - u * 255);
  } else {
    // yellow (255,220,0) -> red (220,30,0)
    const u = (t - 0.5) * 2; // 0..1
    r = Math.round(255 - u * 35);
    g = Math.round(220 - u * 190);
    b = Math.round(0);
  }
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, v))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

interface CategoricalGroup {
  value: string;
  color: string;
  expressIds: number[];
}

interface AppliedProfile {
  property: ProfileProperty;
  type: 'categorical' | 'numeric';
}

export function AppearanceProfiler({
  elementIndex,
  onColorElements,
  onResetColors,
  className,
}: AppearanceProfilerProps) {
  const [selectedProperty, setSelectedProperty] = useState<ProfileProperty>('ifcType');
  const [appliedProfile, setAppliedProfile] = useState<AppliedProfile | null>(null);

  const isCategorical = CATEGORICAL_PROPERTIES.includes(selectedProperty);

  // ── Categorical data ──────────────────────────────────────────

  const categoricalGroups = useMemo((): CategoricalGroup[] => {
    if (!isCategorical) return [];

    const map = new Map<string, number[]>();
    for (const entry of elementIndex) {
      const value = entry[selectedProperty as 'ifcType' | 'floor' | 'material'] || 'Unknown';
      const strValue = String(value);
      if (!map.has(strValue)) map.set(strValue, []);
      map.get(strValue)!.push(entry.expressId);
    }

    const keys = Array.from(map.keys()).sort();
    const palette = generatePaletteHex(Math.max(keys.length, 12));

    return keys.map((value, i) => ({
      value,
      color: palette[i % palette.length],
      expressIds: map.get(value)!,
    }));
  }, [elementIndex, selectedProperty, isCategorical]);

  // ── Numeric data ──────────────────────────────────────────────

  const numericStats = useMemo(() => {
    if (isCategorical) return { min: 0, max: 0, mid: 0 };
    const prop = selectedProperty as 'volume' | 'area' | 'height' | 'length';
    let min = Infinity;
    let max = -Infinity;
    for (const entry of elementIndex) {
      const v = entry[prop];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!isFinite(min)) min = 0;
    if (!isFinite(max)) max = 0;
    return { min, max, mid: (min + max) / 2 };
  }, [elementIndex, selectedProperty, isCategorical]);

  // ── Apply profiling ───────────────────────────────────────────

  const handleApply = useCallback(() => {
    if (elementIndex.length === 0) return;

    if (isCategorical) {
      for (const group of categoricalGroups) {
        if (group.expressIds.length > 0) {
          onColorElements(group.expressIds, group.color);
        }
      }
    } else {
      const prop = selectedProperty as 'volume' | 'area' | 'height' | 'length';
      const { min, max } = numericStats;
      const range = max - min;
      const STEPS = 64;

      // Group elements by quantized color step
      const groups = new Map<number, number[]>();
      for (const entry of elementIndex) {
        const v = entry[prop];
        const t = range > 0 ? (v - min) / range : 0.5;
        const step = Math.min(STEPS - 1, Math.floor(t * STEPS));
        if (!groups.has(step)) groups.set(step, []);
        groups.get(step)!.push(entry.expressId);
      }

      // One call per color group instead of per element
      for (const [step, ids] of groups) {
        const t = (step + 0.5) / STEPS;
        const color = numericToColor(t);
        onColorElements(ids, color);
      }
    }

    setAppliedProfile({
      property: selectedProperty,
      type: isCategorical ? 'categorical' : 'numeric',
    });
  }, [elementIndex, selectedProperty, isCategorical, categoricalGroups, numericStats, onColorElements]);

  // ── Reset ─────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    onResetColors();
    setAppliedProfile(null);
  }, [onResetColors]);

  // ── Format numeric values ─────────────────────────────────────

  const formatValue = (v: number): string => {
    if (v >= 1000) return v.toFixed(1);
    if (v >= 1) return v.toFixed(2);
    return v.toFixed(4);
  };

  return (
    <div className={`appearance-profiler ${className || ''}`}>
      <div className="ap-header">
        <h3>Appearance Profiler</h3>
        {appliedProfile && (
          <span className="ap-active-badge">
            Active: {PROPERTY_LABELS[appliedProfile.property]}
          </span>
        )}
      </div>

      <div className="ap-content">
        {/* Property selector */}
        <div className="ap-section">
          <div className="ap-section-title">Profile By</div>
          <select
            className="ap-select"
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value as ProfileProperty)}
          >
            <optgroup label="Categorical">
              {CATEGORICAL_PROPERTIES.map((p) => (
                <option key={p} value={p}>
                  {PROPERTY_LABELS[p]}
                </option>
              ))}
            </optgroup>
            <optgroup label="Numeric">
              {NUMERIC_PROPERTIES.map((p) => (
                <option key={p} value={p}>
                  {PROPERTY_LABELS[p]}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Action buttons */}
        <div className="ap-section ap-actions">
          <button
            className="ap-btn ap-btn-apply"
            onClick={handleApply}
            disabled={elementIndex.length === 0}
          >
            Apply
          </button>
          <button className="ap-btn ap-btn-reset" onClick={handleReset}>
            Reset
          </button>
        </div>

        {/* Legend */}
        <div className="ap-section">
          <div className="ap-section-title">Legend</div>

          {isCategorical ? (
            <div className="ap-legend-categorical">
              {categoricalGroups.length === 0 && (
                <div className="ap-empty">No elements indexed yet. Load a model first.</div>
              )}
              {categoricalGroups.map((group) => (
                <div key={group.value} className="ap-legend-item">
                  <span
                    className="ap-color-swatch"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="ap-legend-label" title={group.value}>
                    {group.value}
                  </span>
                  <span className="ap-legend-count">{group.expressIds.length}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="ap-legend-numeric">
              {elementIndex.length === 0 ? (
                <div className="ap-empty">No elements indexed yet. Load a model first.</div>
              ) : (
                <>
                  <div className="ap-gradient-bar">
                    <div className="ap-gradient" />
                  </div>
                  <div className="ap-gradient-labels">
                    <span className="ap-gradient-label">{formatValue(numericStats.min)}</span>
                    <span className="ap-gradient-label">{formatValue(numericStats.mid)}</span>
                    <span className="ap-gradient-label">{formatValue(numericStats.max)}</span>
                  </div>
                  <div className="ap-gradient-sublabels">
                    <span>Min</span>
                    <span>Mid</span>
                    <span>Max</span>
                  </div>
                  <div className="ap-numeric-info">
                    {elementIndex.length} elements &middot; {PROPERTY_LABELS[selectedProperty]}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
