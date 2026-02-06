import { useState, useRef } from 'react';
import type { Workset } from '../../types/ifc';
import './WorksetsWidget.css';

export interface WorksetsWidgetProps {
  worksets: Workset[];
  selectedWorksetId: string | null;
  onWorksetClick: (workset: Workset) => void;
  onCreateWorkset: () => void;
  onDeleteWorkset: (worksetId: string) => void;
  onRenameWorkset: (worksetId: string, newName: string) => void;
  onColorChange: (worksetId: string, color: string) => void;
  onOpacityChange: (worksetId: string, opacity: number) => void;
  onAddElementsToWorkset: (worksetId: string) => void;
  onRemoveElementsFromWorkset: (worksetId: string) => void;
  hasSelection: boolean;
  className?: string;
}

export function WorksetsWidget({
  worksets,
  selectedWorksetId,
  onWorksetClick,
  onCreateWorkset,
  onDeleteWorkset,
  onRenameWorkset,
  onColorChange,
  onOpacityChange,
  onAddElementsToWorkset,
  onRemoveElementsFromWorkset,
  hasSelection,
  className,
}: WorksetsWidgetProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const startRename = (workset: Workset) => {
    setEditingId(workset.id);
    setEditName(workset.name);
    setMenuOpenId(null);
  };

  const commitRename = (worksetId: string) => {
    if (editName.trim()) {
      onRenameWorkset(worksetId, editName.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, worksetId: string) => {
    if (e.key === 'Enter') {
      commitRename(worksetId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <div className={`worksets-widget ${className || ''}`}>
      <div className="worksets-header">
        <h3>Worksets</h3>
        <button
          className="worksets-create-btn"
          onClick={onCreateWorkset}
          disabled={!hasSelection}
          title={hasSelection ? 'Create workset from selected elements' : 'Select elements first'}
        >
          + Create from Selection
        </button>
      </div>

      <div className="worksets-list">
        {worksets.length === 0 ? (
          <div className="worksets-empty">
            <p>No worksets yet.</p>
            <p className="worksets-empty-hint">
              Select elements in the model and create a workset.
            </p>
          </div>
        ) : (
          worksets.map((ws) => (
            <div
              key={ws.id}
              className={`worksets-row ${selectedWorksetId === ws.id ? 'selected' : ''}`}
              onClick={() => onWorksetClick(ws)}
            >
              <div className="worksets-row-main">
                {editingId === ws.id ? (
                  <input
                    className="worksets-rename-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => commitRename(ws.id)}
                    onKeyDown={(e) => handleKeyDown(e, ws.id)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <span
                    className="worksets-row-name"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startRename(ws);
                    }}
                    title="Double-click to rename"
                  >
                    {ws.name}
                  </span>
                )}
                <span className="worksets-row-count">{ws.elementIds.expressIds.length}</span>
              </div>

              <div className="worksets-row-controls" onClick={(e) => e.stopPropagation()}>
                {/* Color picker */}
                <div className="worksets-color-wrapper">
                  <div
                    className="worksets-color-swatch"
                    style={{ backgroundColor: ws.color }}
                    onClick={() => {
                      const input = document.getElementById(`color-${ws.id}`) as HTMLInputElement;
                      input?.click();
                    }}
                  />
                  <input
                    id={`color-${ws.id}`}
                    type="color"
                    className="worksets-color-input"
                    value={ws.color}
                    onChange={(e) => onColorChange(ws.id, e.target.value)}
                  />
                </div>

                {/* Opacity slider */}
                <div className="worksets-opacity-wrapper">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ws.opacity}
                    className="worksets-opacity-slider"
                    onChange={(e) => onOpacityChange(ws.id, parseFloat(e.target.value))}
                    title={`Opacity: ${Math.round(ws.opacity * 100)}%`}
                  />
                </div>

                {/* Actions menu */}
                <div className="worksets-actions">
                  <button
                    className="worksets-menu-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === ws.id ? null : ws.id);
                    }}
                  >
                    &#8942;
                  </button>
                  {menuOpenId === ws.id && (
                    <div className="worksets-menu">
                      <button onClick={() => startRename(ws)}>Rename</button>
                      <button
                        onClick={() => {
                          onAddElementsToWorkset(ws.id);
                          setMenuOpenId(null);
                        }}
                        disabled={!hasSelection}
                      >
                        Add selected elements
                      </button>
                      <button
                        onClick={() => {
                          onRemoveElementsFromWorkset(ws.id);
                          setMenuOpenId(null);
                        }}
                        disabled={!hasSelection}
                      >
                        Remove selected elements
                      </button>
                      <button
                        className="worksets-menu-delete"
                        onClick={() => {
                          onDeleteWorkset(ws.id);
                          setMenuOpenId(null);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
