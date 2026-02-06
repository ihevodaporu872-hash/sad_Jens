import { useState } from 'react';
import type { IfcElementInfo } from '../../types/ifc';
import './PropertiesPanel.css';

export interface PropertiesPanelProps {
  elementInfo: IfcElementInfo | null;
  className?: string;
}

export function PropertiesPanel({ elementInfo, className }: PropertiesPanelProps) {
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());

  const toggleSet = (name: string) => {
    setExpandedSets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  if (!elementInfo) {
    return (
      <div className={`properties-panel ${className || ''}`}>
        <div className="properties-header">
          <h3>Properties</h3>
        </div>
        <div className="properties-empty">
          <div className="properties-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          </div>
          <p>Click an element in the 3D model to view its properties</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`properties-panel ${className || ''}`}>
      <div className="properties-header">
        <h3>Properties</h3>
      </div>

      <div className="properties-content">
        {/* Element header */}
        <div className="properties-element-header">
          <span className="properties-type-badge">{elementInfo.ifcType}</span>
          <span className="properties-element-name">{elementInfo.name || 'Unnamed'}</span>
        </div>

        {/* Key parameters — shown only when they exist */}
        {(elementInfo.keyParams.volume || elementInfo.keyParams.area || elementInfo.keyParams.floor ||
          elementInfo.keyParams.concreteClass || elementInfo.keyParams.height || elementInfo.keyParams.length) && (
          <div className="properties-section properties-key-params">
            <div className="properties-section-title">Key Parameters</div>
            {elementInfo.keyParams.floor && (
              <div className="properties-kv">
                <span className="properties-key">Floor</span>
                <span className="properties-value">{elementInfo.keyParams.floor}</span>
              </div>
            )}
            {elementInfo.keyParams.volume && (
              <div className="properties-kv">
                <span className="properties-key">Volume</span>
                <span className="properties-value">{elementInfo.keyParams.volume} m³</span>
              </div>
            )}
            {elementInfo.keyParams.area && (
              <div className="properties-kv">
                <span className="properties-key">Area</span>
                <span className="properties-value">{elementInfo.keyParams.area} m²</span>
              </div>
            )}
            {elementInfo.keyParams.height && (
              <div className="properties-kv">
                <span className="properties-key">Height</span>
                <span className="properties-value">{elementInfo.keyParams.height}</span>
              </div>
            )}
            {elementInfo.keyParams.length && (
              <div className="properties-kv">
                <span className="properties-key">Length</span>
                <span className="properties-value">{elementInfo.keyParams.length}</span>
              </div>
            )}
            {elementInfo.keyParams.concreteClass && (
              <div className="properties-kv">
                <span className="properties-key">Concrete Class</span>
                <span className="properties-value">{elementInfo.keyParams.concreteClass}</span>
              </div>
            )}
          </div>
        )}

        {/* Basic info */}
        <div className="properties-section">
          <div className="properties-section-title">Basic Info</div>
          <div className="properties-kv">
            <span className="properties-key">Express ID</span>
            <span className="properties-value">{elementInfo.expressId}</span>
          </div>
          <div className="properties-kv">
            <span className="properties-key">GlobalId</span>
            <span className="properties-value properties-value-mono">{elementInfo.globalId}</span>
          </div>
          {elementInfo.description && (
            <div className="properties-kv">
              <span className="properties-key">Description</span>
              <span className="properties-value">{elementInfo.description}</span>
            </div>
          )}
        </div>

        {/* Property Sets */}
        {elementInfo.propertySets.length > 0 && (
          <div className="properties-section">
            <div className="properties-section-title">Property Sets</div>
            {elementInfo.propertySets.map((pset) => (
              <div key={pset.name} className="properties-pset">
                <button
                  className={`properties-pset-header ${expandedSets.has(pset.name) ? 'expanded' : ''}`}
                  onClick={() => toggleSet(pset.name)}
                >
                  <svg className="properties-pset-arrow" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>{pset.name}</span>
                  <span className="properties-pset-count">{pset.properties.length}</span>
                </button>
                {expandedSets.has(pset.name) && (
                  <div className="properties-pset-body">
                    {pset.properties.map((prop, idx) => (
                      <div key={`${prop.name}-${idx}`} className="properties-kv">
                        <span className="properties-key">{prop.name}</span>
                        <span className="properties-value">
                          {prop.value !== null && prop.value !== undefined
                            ? String(prop.value)
                            : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Materials */}
        {elementInfo.materials.length > 0 && (
          <div className="properties-section">
            <div className="properties-section-title">Materials</div>
            {elementInfo.materials.map((mat, i) => (
              <div key={i} className="properties-kv">
                <span className="properties-value">{mat}</span>
              </div>
            ))}
          </div>
        )}

        {/* Classifications */}
        {elementInfo.classifications.length > 0 && (
          <div className="properties-section">
            <div className="properties-section-title">Classifications</div>
            {elementInfo.classifications.map((cls, i) => (
              <div key={i} className="properties-kv">
                <span className="properties-value">{cls}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
