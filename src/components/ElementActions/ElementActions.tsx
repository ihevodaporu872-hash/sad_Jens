import { useState, useRef } from 'react';
import './ElementActions.css';

export interface ElementActionsProps {
  hasSelection: boolean;
  hasModel: boolean;
  onHideSelected: () => void;
  onShowAll: () => void;
  onIsolateSelected: () => void;
  onColorSelected: (color: string) => void;
  onResetColors: () => void;
  onInvertSelection: () => void;
  className?: string;
}

export function ElementActions({
  hasSelection,
  hasModel,
  onHideSelected,
  onShowAll,
  onIsolateSelected,
  onColorSelected,
  onResetColors,
  onInvertSelection,
  className,
}: ElementActionsProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorRef = useRef<HTMLInputElement>(null);

  const handleColorClick = () => {
    if (colorRef.current) {
      colorRef.current.click();
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onColorSelected(e.target.value);
    setShowColorPicker(false);
  };

  return (
    <div className={`element-actions ${className || ''}`}>
      <button
        className="ea-btn"
        onClick={onHideSelected}
        disabled={!hasSelection}
        title="Hide selected elements"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
        <span>Hide</span>
      </button>

      <button
        className="ea-btn"
        onClick={onShowAll}
        disabled={!hasModel}
        title="Show all hidden elements"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>Show All</span>
      </button>

      <button
        className="ea-btn"
        onClick={onIsolateSelected}
        disabled={!hasSelection}
        title="Isolate selected elements"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="12" cy="12" r="4" />
        </svg>
        <span>Isolate</span>
      </button>

      <div className="ea-color-wrapper">
        <button
          className="ea-btn ea-btn-color"
          onClick={handleColorClick}
          disabled={!hasSelection}
          title="Color selected elements"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          </svg>
          <span>Color</span>
        </button>
        <input
          ref={colorRef}
          type="color"
          className="ea-color-input"
          defaultValue="#ff8800"
          onChange={handleColorChange}
        />
      </div>

      <button
        className="ea-btn"
        onClick={onResetColors}
        disabled={!hasModel}
        title="Reset all colors to default"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
        <span>Reset</span>
      </button>

      <button
        className="ea-btn"
        onClick={onInvertSelection}
        disabled={!hasSelection}
        title="Invert selection"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        <span>Invert</span>
      </button>
    </div>
  );
}
