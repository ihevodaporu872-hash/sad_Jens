import { useState, useMemo, useCallback } from 'react';
import type { ElementIndexEntry } from '../../types/ifc';
import './SmartFilter.css';

export interface SmartFilterProps {
  elementIndex: ElementIndexEntry[];
  onSelectElements: (expressIds: number[]) => void;
  onHighlightElements: (expressIds: number[], color: string) => void;
  className?: string;
}

type GroupByField = 'ifcType' | 'floor' | 'material';

export function SmartFilter({
  elementIndex,
  onSelectElements,
  onHighlightElements,
  className,
}: SmartFilterProps) {
  const [searchText, setSearchText] = useState('');
  const [groupBy, setGroupBy] = useState<GroupByField>('ifcType');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [filterPropName, setFilterPropName] = useState('');
  const [filterPropValue, setFilterPropValue] = useState('');

  // Group elements by selected field
  const groups = useMemo(() => {
    const map = new Map<string, ElementIndexEntry[]>();
    for (const entry of elementIndex) {
      let key = '';
      switch (groupBy) {
        case 'ifcType':
          key = entry.ifcType || 'Unknown';
          break;
        case 'floor':
          key = entry.floor || 'No Floor';
          break;
        case 'material':
          key = entry.material || 'No Material';
          break;
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    // Sort by count descending
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [elementIndex, groupBy]);

  // Text search results
  const searchResults = useMemo(() => {
    if (!searchText.trim()) return null;
    const lower = searchText.toLowerCase();
    return elementIndex.filter((e) => {
      if (e.name.toLowerCase().includes(lower)) return true;
      if (e.ifcType.toLowerCase().includes(lower)) return true;
      if (e.floor.toLowerCase().includes(lower)) return true;
      if (e.material.toLowerCase().includes(lower)) return true;
      return e.searchableProps.some((p) => p.toLowerCase().includes(lower));
    });
  }, [elementIndex, searchText]);

  // Property filter results
  const propFilterResults = useMemo(() => {
    if (!filterPropName.trim() && !filterPropValue.trim()) return null;
    const nameLower = filterPropName.toLowerCase();
    const valueLower = filterPropValue.toLowerCase();
    return elementIndex.filter((e) =>
      e.searchableProps.some((p) => {
        const pLower = p.toLowerCase();
        const [pName, pVal] = pLower.split('=');
        const nameMatch = !nameLower || (pName && pName.includes(nameLower));
        const valueMatch = !valueLower || (pVal && pVal.includes(valueLower));
        return nameMatch && valueMatch;
      })
    );
  }, [elementIndex, filterPropName, filterPropValue]);

  const handleGroupClick = useCallback(
    (key: string, entries: ElementIndexEntry[]) => {
      if (selectedGroup === key) {
        setSelectedGroup(null);
        onSelectElements([]);
      } else {
        setSelectedGroup(key);
        const ids = entries.map((e) => e.expressId);
        onSelectElements(ids);
      }
    },
    [selectedGroup, onSelectElements]
  );

  const handleSelectSearchResults = useCallback(() => {
    if (searchResults && searchResults.length > 0) {
      onSelectElements(searchResults.map((e) => e.expressId));
    }
  }, [searchResults, onSelectElements]);

  const handleHighlightSearchResults = useCallback(() => {
    if (searchResults && searchResults.length > 0) {
      onHighlightElements(searchResults.map((e) => e.expressId), '#ff8800');
    }
  }, [searchResults, onHighlightElements]);

  const handleSelectPropResults = useCallback(() => {
    if (propFilterResults && propFilterResults.length > 0) {
      onSelectElements(propFilterResults.map((e) => e.expressId));
    }
  }, [propFilterResults, onSelectElements]);

  const handleHighlightPropResults = useCallback(() => {
    if (propFilterResults && propFilterResults.length > 0) {
      onHighlightElements(propFilterResults.map((e) => e.expressId), '#00cc88');
    }
  }, [propFilterResults, onHighlightElements]);

  return (
    <div className={`smart-filter ${className || ''}`}>
      <div className="sf-header">
        <h3>Smart Filter</h3>
      </div>

      <div className="sf-content">
        {/* Text search */}
        <div className="sf-section">
          <div className="sf-section-title">Search</div>
          <input
            className="sf-search-input"
            type="text"
            placeholder="Type, name, property..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          {searchResults && (
            <div className="sf-search-result">
              <span className="sf-result-count">{searchResults.length} elements found</span>
              <div className="sf-result-actions">
                <button className="sf-btn sf-btn-select" onClick={handleSelectSearchResults}>
                  Select
                </button>
                <button className="sf-btn sf-btn-highlight" onClick={handleHighlightSearchResults}>
                  Highlight
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Property filter */}
        <div className="sf-section">
          <div className="sf-section-title">Property Filter</div>
          <div className="sf-prop-filter">
            <input
              className="sf-prop-input"
              type="text"
              placeholder="Property name"
              value={filterPropName}
              onChange={(e) => setFilterPropName(e.target.value)}
            />
            <input
              className="sf-prop-input"
              type="text"
              placeholder="Property value"
              value={filterPropValue}
              onChange={(e) => setFilterPropValue(e.target.value)}
            />
          </div>
          {propFilterResults && (
            <div className="sf-search-result">
              <span className="sf-result-count">{propFilterResults.length} elements match</span>
              <div className="sf-result-actions">
                <button className="sf-btn sf-btn-select" onClick={handleSelectPropResults}>
                  Select
                </button>
                <button className="sf-btn sf-btn-highlight" onClick={handleHighlightPropResults}>
                  Highlight
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Group by */}
        <div className="sf-section">
          <div className="sf-section-title">Group By</div>
          <div className="sf-group-toggle">
            {(['ifcType', 'floor', 'material'] as GroupByField[]).map((field) => (
              <button
                key={field}
                className={`sf-toggle-btn ${groupBy === field ? 'active' : ''}`}
                onClick={() => {
                  setGroupBy(field);
                  setSelectedGroup(null);
                }}
              >
                {field === 'ifcType' ? 'Type' : field === 'floor' ? 'Floor' : 'Material'}
              </button>
            ))}
          </div>
        </div>

        {/* Group list */}
        <div className="sf-groups-list">
          {groups.map(([key, entries]) => (
            <div
              key={key}
              className={`sf-group-row ${selectedGroup === key ? 'selected' : ''}`}
              onClick={() => handleGroupClick(key, entries)}
            >
              <span className="sf-group-name" title={key}>{key}</span>
              <span className="sf-group-count">{entries.length}</span>
            </div>
          ))}
          {groups.length === 0 && (
            <div className="sf-empty">No elements indexed yet. Load a model first.</div>
          )}
        </div>
      </div>
    </div>
  );
}
