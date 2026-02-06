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
  onZoomToSelected?: () => void;
  onZoomToFit?: () => void;
  onBoxSelectToggle?: () => void;
  boxSelectActive?: boolean;
  onAnnotationToggle?: () => void;
  annotationActive?: boolean;
  onMeasureToggle?: () => void;
  measureActive?: boolean;
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
  onZoomToSelected,
  onZoomToFit,
  onBoxSelectToggle,
  boxSelectActive,
  onAnnotationToggle,
  annotationActive,
  onMeasureToggle,
  measureActive,
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

      <div className="ea-separator" />

      {onZoomToSelected && (
        <button
          className="ea-btn"
          onClick={onZoomToSelected}
          disabled={!hasSelection}
          title="Zoom to selected elements"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <span>Zoom Sel</span>
        </button>
      )}

      {onZoomToFit && (
        <button
          className="ea-btn"
          onClick={onZoomToFit}
          disabled={!hasModel}
          title="Zoom to fit entire model"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
          <span>Zoom Fit</span>
        </button>
      )}

      {onBoxSelectToggle && (
        <button
          className={`ea-btn ${boxSelectActive ? 'ea-btn-active' : ''}`}
          onClick={onBoxSelectToggle}
          disabled={!hasModel}
          title="Box select mode"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="5,3" />
          </svg>
          <span>Box Sel</span>
        </button>
      )}

      {onAnnotationToggle && (
        <>
          <div className="ea-separator" />
          <button
            className={`ea-btn ${annotationActive ? 'ea-btn-active' : ''}`}
            onClick={onAnnotationToggle}
            disabled={!hasModel}
            title="Annotation / redline tools"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
            <span>Annotate</span>
          </button>
        </>
      )}

      {onMeasureToggle && (
        <>
          <div className="ea-separator" />
          <button
            className={`ea-btn ${measureActive ? 'ea-btn-active' : ''}`}
            onClick={onMeasureToggle}
            disabled={!hasModel}
            title="Measure distance, area, and angle"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M2 20h20" />
              <path d="M6 20v-4" />
              <path d="M10 20v-2" />
              <path d="M14 20v-4" />
              <path d="M18 20v-2" />
              <path d="M22 20v-4" />
              <path d="M2 20v-4" />
              <line x1="4" y1="8" x2="20" y2="8" />
              <polygon points="4,5 4,11 7,8" />
              <polygon points="20,5 20,11 17,8" />
            </svg>
            <span>Measure</span>
          </button>
        </>
      )}
    </div>
  );
}
