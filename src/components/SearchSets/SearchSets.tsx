import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ElementIndexEntry, SearchCriteria, SearchSet } from '../../types/ifc';
import * as supabaseApi from '../../services/supabaseService';
import './SearchSets.css';

export interface SearchSetsProps {
  elementIndex: ElementIndexEntry[];
  supabaseModelId: string | null;
  onSelectElements: (expressIds: number[]) => void;
  onHighlightElements: (expressIds: number[], color: string) => void;
  className?: string;
}

type PropOperator = 'equals' | 'contains' | 'gt' | 'lt';

interface PropFilterRow {
  property: string;
  operator: PropOperator;
  value: string;
}

/**
 * Applies SearchCriteria against the local elementIndex and returns matching expressIds.
 */
function applyCriteria(
  criteria: SearchCriteria,
  elementIndex: ElementIndexEntry[]
): number[] {
  return elementIndex
    .filter((el) => {
      // IFC Types filter
      if (criteria.ifcTypes && criteria.ifcTypes.length > 0) {
        if (!criteria.ifcTypes.includes(el.ifcType)) return false;
      }
      // Floors filter
      if (criteria.floors && criteria.floors.length > 0) {
        if (!criteria.floors.includes(el.floor)) return false;
      }
      // Materials filter
      if (criteria.materials && criteria.materials.length > 0) {
        if (!criteria.materials.includes(el.material)) return false;
      }
      // Text query filter
      if (criteria.textQuery && criteria.textQuery.trim()) {
        const lower = criteria.textQuery.toLowerCase();
        const matchesText =
          el.name.toLowerCase().includes(lower) ||
          el.ifcType.toLowerCase().includes(lower) ||
          el.floor.toLowerCase().includes(lower) ||
          el.material.toLowerCase().includes(lower) ||
          el.searchableProps.some((p) => p.toLowerCase().includes(lower));
        if (!matchesText) return false;
      }
      // Property filters
      if (criteria.propFilters && criteria.propFilters.length > 0) {
        for (const pf of criteria.propFilters) {
          if (!pf.property.trim() && !pf.value.trim()) continue;
          const propLower = pf.property.toLowerCase();
          const valueLower = pf.value.toLowerCase();

          const matched = el.searchableProps.some((sp) => {
            const eqIdx = sp.indexOf('=');
            if (eqIdx === -1) return false;
            const pName = sp.substring(0, eqIdx).toLowerCase();
            const pVal = sp.substring(eqIdx + 1).toLowerCase();

            const nameMatch = !propLower || pName.includes(propLower);
            if (!nameMatch) return false;

            switch (pf.operator) {
              case 'equals':
                return pVal === valueLower;
              case 'contains':
                return pVal.includes(valueLower);
              case 'gt': {
                const numProp = parseFloat(pVal);
                const numFilter = parseFloat(valueLower);
                return !isNaN(numProp) && !isNaN(numFilter) && numProp > numFilter;
              }
              case 'lt': {
                const numProp = parseFloat(pVal);
                const numFilter = parseFloat(valueLower);
                return !isNaN(numProp) && !isNaN(numFilter) && numProp < numFilter;
              }
              default:
                return pVal.includes(valueLower);
            }
          });
          if (!matched) return false;
        }
      }
      return true;
    })
    .map((el) => el.expressId);
}

export function SearchSets({
  elementIndex,
  supabaseModelId,
  onSelectElements,
  onHighlightElements,
  className,
}: SearchSetsProps) {
  // Saved search sets from DB
  const [searchSets, setSearchSets] = useState<SearchSet[]>([]);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorName, setEditorName] = useState('');
  const [editorIfcTypes, setEditorIfcTypes] = useState<string[]>([]);
  const [editorFloors, setEditorFloors] = useState<string[]>([]);
  const [editorMaterials, setEditorMaterials] = useState<string[]>([]);
  const [editorTextQuery, setEditorTextQuery] = useState('');
  const [editorPropFilters, setEditorPropFilters] = useState<PropFilterRow[]>([]);

  // ── Distinct values for multi-select ──────────────────────────

  const distinctIfcTypes = useMemo(() => {
    const set = new Set<string>();
    for (const el of elementIndex) {
      if (el.ifcType) set.add(el.ifcType);
    }
    return Array.from(set).sort();
  }, [elementIndex]);

  const distinctFloors = useMemo(() => {
    const set = new Set<string>();
    for (const el of elementIndex) {
      if (el.floor) set.add(el.floor);
    }
    return Array.from(set).sort();
  }, [elementIndex]);

  const distinctMaterials = useMemo(() => {
    const set = new Set<string>();
    for (const el of elementIndex) {
      if (el.material) set.add(el.material);
    }
    return Array.from(set).sort();
  }, [elementIndex]);

  // ── Load saved search sets from Supabase ──────────────────────

  useEffect(() => {
    if (!supabaseModelId) return;
    let cancelled = false;
    const fetchSets = async () => {
      setLoading(true);
      try {
        const sets = await supabaseApi.getSearchSets(supabaseModelId);
        if (!cancelled) setSearchSets(sets);
      } catch (err) {
        console.warn('[SearchSets] Failed to load:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchSets();
    return () => { cancelled = true; };
  }, [supabaseModelId]);

  // ── Build criteria from editor state ──────────────────────────

  const buildCriteriaFromEditor = useCallback((): SearchCriteria => {
    const criteria: SearchCriteria = {};
    if (editorIfcTypes.length > 0) criteria.ifcTypes = [...editorIfcTypes];
    if (editorFloors.length > 0) criteria.floors = [...editorFloors];
    if (editorMaterials.length > 0) criteria.materials = [...editorMaterials];
    if (editorTextQuery.trim()) criteria.textQuery = editorTextQuery.trim();
    const validProps = editorPropFilters.filter((p) => p.property.trim() || p.value.trim());
    if (validProps.length > 0) criteria.propFilters = validProps;
    return criteria;
  }, [editorIfcTypes, editorFloors, editorMaterials, editorTextQuery, editorPropFilters]);

  // ── Live preview count ────────────────────────────────────────

  const previewIds = useMemo(() => {
    if (!editorOpen) return [];
    const criteria = buildCriteriaFromEditor();
    return applyCriteria(criteria, elementIndex);
  }, [editorOpen, buildCriteriaFromEditor, elementIndex]);

  // ── Handlers ──────────────────────────────────────────────────

  const resetEditor = useCallback(() => {
    setEditorName('');
    setEditorIfcTypes([]);
    setEditorFloors([]);
    setEditorMaterials([]);
    setEditorTextQuery('');
    setEditorPropFilters([]);
  }, []);

  const handleNewSearchSet = useCallback(() => {
    resetEditor();
    setEditorOpen(true);
  }, [resetEditor]);

  const handleCancelEditor = useCallback(() => {
    setEditorOpen(false);
    resetEditor();
  }, [resetEditor]);

  const handleApplyEditor = useCallback(() => {
    const criteria = buildCriteriaFromEditor();
    const ids = applyCriteria(criteria, elementIndex);
    onSelectElements(ids);
  }, [buildCriteriaFromEditor, elementIndex, onSelectElements]);

  const handleSaveSearchSet = useCallback(async () => {
    if (!supabaseModelId || !editorName.trim()) return;
    const criteria = buildCriteriaFromEditor();
    try {
      const saved = await supabaseApi.createSearchSet(supabaseModelId, {
        name: editorName.trim(),
        criteria,
      });
      setSearchSets((prev) => [...prev, saved]);
      setEditorOpen(false);
      resetEditor();
    } catch (err) {
      console.error('[SearchSets] Failed to save:', err);
    }
  }, [supabaseModelId, editorName, buildCriteriaFromEditor, resetEditor]);

  const handleDeleteSearchSet = useCallback(async (id: string) => {
    try {
      await supabaseApi.deleteSearchSet(id);
      setSearchSets((prev) => prev.filter((s) => s.id !== id));
      if (activeSetId === id) setActiveSetId(null);
    } catch (err) {
      console.error('[SearchSets] Failed to delete:', err);
    }
  }, [activeSetId]);

  const handleApplySavedSet = useCallback(
    (set: SearchSet) => {
      setActiveSetId(set.id);
      const ids = applyCriteria(set.criteria, elementIndex);
      onSelectElements(ids);
    },
    [elementIndex, onSelectElements]
  );

  const handleHighlightSavedSet = useCallback(
    (set: SearchSet) => {
      const ids = applyCriteria(set.criteria, elementIndex);
      onHighlightElements(ids, '#ff8800');
    },
    [elementIndex, onHighlightElements]
  );

  // ── Checkbox toggle helpers ───────────────────────────────────

  const toggleIfcType = useCallback((type: string) => {
    setEditorIfcTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  const toggleFloor = useCallback((floor: string) => {
    setEditorFloors((prev) =>
      prev.includes(floor) ? prev.filter((f) => f !== floor) : [...prev, floor]
    );
  }, []);

  const toggleMaterial = useCallback((material: string) => {
    setEditorMaterials((prev) =>
      prev.includes(material) ? prev.filter((m) => m !== material) : [...prev, material]
    );
  }, []);

  // ── Property filter helpers ───────────────────────────────────

  const addPropFilter = useCallback(() => {
    setEditorPropFilters((prev) => [...prev, { property: '', operator: 'contains', value: '' }]);
  }, []);

  const removePropFilter = useCallback((index: number) => {
    setEditorPropFilters((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updatePropFilter = useCallback((index: number, field: keyof PropFilterRow, val: string) => {
    setEditorPropFilters((prev) =>
      prev.map((pf, i) => (i === index ? { ...pf, [field]: val } : pf))
    );
  }, []);

  // ── Criteria summary text ─────────────────────────────────────

  const criteriaToSummary = useCallback((c: SearchCriteria): string => {
    const parts: string[] = [];
    if (c.ifcTypes && c.ifcTypes.length > 0)
      parts.push(`${c.ifcTypes.length} type${c.ifcTypes.length > 1 ? 's' : ''}`);
    if (c.floors && c.floors.length > 0)
      parts.push(`${c.floors.length} floor${c.floors.length > 1 ? 's' : ''}`);
    if (c.materials && c.materials.length > 0)
      parts.push(`${c.materials.length} material${c.materials.length > 1 ? 's' : ''}`);
    if (c.textQuery) parts.push(`"${c.textQuery}"`);
    if (c.propFilters && c.propFilters.length > 0)
      parts.push(`${c.propFilters.length} prop filter${c.propFilters.length > 1 ? 's' : ''}`);
    return parts.length > 0 ? parts.join(', ') : 'No criteria';
  }, []);

  return (
    <div className={`search-sets ${className || ''}`}>
      <div className="ss-header">
        <h3>Search Sets</h3>
        <button className="ss-btn-new" onClick={handleNewSearchSet}>
          + New
        </button>
      </div>

      <div className="ss-content">
        {/* ── Criteria Editor ─────────────────────────────── */}
        {editorOpen && (
          <div className="ss-editor">
            <div className="ss-editor-title">New Search Set</div>

            {/* Name */}
            <div className="ss-field">
              <div className="ss-field-label">Name</div>
              <input
                className="ss-name-input"
                type="text"
                placeholder="Search set name..."
                value={editorName}
                onChange={(e) => setEditorName(e.target.value)}
              />
            </div>

            {/* IFC Types */}
            {distinctIfcTypes.length > 0 && (
              <div className="ss-field">
                <div className="ss-field-label">IFC Types</div>
                <div className="ss-checkbox-list">
                  {distinctIfcTypes.map((type) => (
                    <label key={type} className="ss-checkbox-item">
                      <input
                        type="checkbox"
                        checked={editorIfcTypes.includes(type)}
                        onChange={() => toggleIfcType(type)}
                      />
                      <span className="ss-checkbox-label">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Floors */}
            {distinctFloors.length > 0 && (
              <div className="ss-field">
                <div className="ss-field-label">Floors</div>
                <div className="ss-checkbox-list">
                  {distinctFloors.map((floor) => (
                    <label key={floor} className="ss-checkbox-item">
                      <input
                        type="checkbox"
                        checked={editorFloors.includes(floor)}
                        onChange={() => toggleFloor(floor)}
                      />
                      <span className="ss-checkbox-label">{floor}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Materials */}
            {distinctMaterials.length > 0 && (
              <div className="ss-field">
                <div className="ss-field-label">Materials</div>
                <div className="ss-checkbox-list">
                  {distinctMaterials.map((mat) => (
                    <label key={mat} className="ss-checkbox-item">
                      <input
                        type="checkbox"
                        checked={editorMaterials.includes(mat)}
                        onChange={() => toggleMaterial(mat)}
                      />
                      <span className="ss-checkbox-label">{mat}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Text Search */}
            <div className="ss-field">
              <div className="ss-field-label">Text Search</div>
              <input
                className="ss-text-input"
                type="text"
                placeholder="Search name, type, property..."
                value={editorTextQuery}
                onChange={(e) => setEditorTextQuery(e.target.value)}
              />
            </div>

            {/* Property Filters */}
            <div className="ss-field">
              <div className="ss-field-label">Property Filters</div>
              <div className="ss-prop-filters">
                {editorPropFilters.map((pf, i) => (
                  <div key={i} className="ss-prop-row">
                    <input
                      className="ss-prop-input"
                      type="text"
                      placeholder="Property"
                      value={pf.property}
                      onChange={(e) => updatePropFilter(i, 'property', e.target.value)}
                    />
                    <select
                      className="ss-prop-select"
                      value={pf.operator}
                      onChange={(e) => updatePropFilter(i, 'operator', e.target.value)}
                    >
                      <option value="equals">= </option>
                      <option value="contains">~</option>
                      <option value="gt">&gt;</option>
                      <option value="lt">&lt;</option>
                    </select>
                    <input
                      className="ss-prop-input"
                      type="text"
                      placeholder="Value"
                      value={pf.value}
                      onChange={(e) => updatePropFilter(i, 'value', e.target.value)}
                    />
                    <button
                      className="ss-btn-remove-prop"
                      onClick={() => removePropFilter(i)}
                      title="Remove filter"
                    >
                      x
                    </button>
                  </div>
                ))}
                <button className="ss-btn-add-prop" onClick={addPropFilter}>
                  + Add property filter
                </button>
              </div>
            </div>

            {/* Preview count */}
            <div className="ss-result-bar">
              <span className="ss-result-count">
                {previewIds.length} element{previewIds.length !== 1 ? 's' : ''} match
              </span>
            </div>

            {/* Actions */}
            <div className="ss-editor-actions">
              <button
                className="ss-btn-save"
                onClick={handleSaveSearchSet}
                disabled={!editorName.trim() || !supabaseModelId}
                title={!supabaseModelId ? 'No model loaded' : !editorName.trim() ? 'Enter a name' : 'Save search set'}
              >
                Save
              </button>
              <button className="ss-btn-editor-apply" onClick={handleApplyEditor}>
                Apply
              </button>
              <button className="ss-btn-cancel" onClick={handleCancelEditor}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Saved Search Sets List ─────────────────────── */}
        <div className="ss-saved-list">
          {loading && <div className="ss-empty">Loading search sets...</div>}
          {!loading && searchSets.length === 0 && !editorOpen && (
            <div className="ss-empty">
              No saved search sets. Click "+ New" to create one.
            </div>
          )}
          {searchSets.map((set) => (
            <div
              key={set.id}
              className={`ss-saved-item ${activeSetId === set.id ? 'active' : ''}`}
              onClick={() => handleApplySavedSet(set)}
            >
              <div className="ss-saved-item-info">
                <div className="ss-saved-item-name">{set.name}</div>
                <div className="ss-saved-item-meta">{criteriaToSummary(set.criteria)}</div>
              </div>
              <div className="ss-saved-item-actions">
                <button
                  className="ss-btn-apply"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleHighlightSavedSet(set);
                  }}
                  title="Highlight matching elements"
                >
                  Highlight
                </button>
                <button
                  className="ss-btn-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSearchSet(set.id);
                  }}
                  title="Delete search set"
                >
                  Del
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
