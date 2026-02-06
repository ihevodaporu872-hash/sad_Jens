import { useState, useRef, useEffect, useCallback } from 'react';
import type { IfcViewerRef } from '../../types/ifc';
import './Annotations.css';

// ── Types ────────────────────────────────────────────────────────

type AnnotationTool = 'text' | 'freehand' | 'cloud' | 'arrow';

interface AnnotationEntry {
  type: AnnotationTool;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  text?: string;
}

export interface AnnotationsProps {
  viewerRef: React.RefObject<IfcViewerRef | null>;
  active: boolean;
  onClose: () => void;
  className?: string;
}

// ── Constants ────────────────────────────────────────────────────

const DEFAULT_COLOR = '#ff3333';
const LINE_WIDTHS = [2, 3, 5] as const;

// ── Component ────────────────────────────────────────────────────

export function Annotations({ viewerRef, active, onClose, className }: AnnotationsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<AnnotationTool>('freehand');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [lineWidth, setLineWidth] = useState<number>(2);
  const [annotations, setAnnotations] = useState<AnnotationEntry[]>([]);

  // Drawing state (refs to avoid re-renders during draw)
  const isDrawing = useRef(false);
  const currentPoints = useRef<{ x: number; y: number }[]>([]);
  const startPoint = useRef<{ x: number; y: number } | null>(null);

  // Text input popup
  const [textPopup, setTextPopup] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);

  // ── Canvas sizing ────────────────────────────────────────────

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  useEffect(() => {
    if (!active) return;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [active, resizeCanvas]);

  // ── Redraw all annotations ────────────────────────────────────

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    for (const ann of annotations) {
      switch (ann.type) {
        case 'freehand':
          drawFreehand(ctx, ann);
          break;
        case 'cloud':
          drawCloud(ctx, ann);
          break;
        case 'arrow':
          drawArrow(ctx, ann);
          break;
        case 'text':
          drawText(ctx, ann);
          break;
      }
    }
  }, [annotations]);

  useEffect(() => {
    if (active) redraw();
  }, [active, redraw]);

  // ── Drawing helpers ───────────────────────────────────────────

  function drawFreehand(ctx: CanvasRenderingContext2D, ann: AnnotationEntry) {
    if (ann.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = ann.color;
    ctx.lineWidth = ann.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(ann.points[0].x, ann.points[0].y);
    for (let i = 1; i < ann.points.length; i++) {
      ctx.lineTo(ann.points[i].x, ann.points[i].y);
    }
    ctx.stroke();
  }

  function drawCloud(ctx: CanvasRenderingContext2D, ann: AnnotationEntry) {
    if (ann.points.length < 2) return;
    const [p0, p1] = ann.points;
    const x = Math.min(p0.x, p1.x);
    const y = Math.min(p0.y, p1.y);
    const w = Math.abs(p1.x - p0.x);
    const h = Math.abs(p1.y - p0.y);

    if (w < 4 && h < 4) return;

    ctx.strokeStyle = ann.color;
    ctx.lineWidth = ann.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Revision cloud: draw small arcs along the rectangle perimeter
    const arcRadius = 10;
    const perimeter = 2 * (w + h);
    const numArcs = Math.max(8, Math.round(perimeter / (arcRadius * 1.5)));

    // Collect points along the rectangle perimeter
    const perimeterPoints: { x: number; y: number }[] = [];
    for (let i = 0; i <= numArcs; i++) {
      const t = i / numArcs;
      const dist = t * perimeter;
      let px: number, py: number;
      if (dist <= w) {
        // top edge
        px = x + dist;
        py = y;
      } else if (dist <= w + h) {
        // right edge
        px = x + w;
        py = y + (dist - w);
      } else if (dist <= 2 * w + h) {
        // bottom edge
        px = x + w - (dist - w - h);
        py = y + h;
      } else {
        // left edge
        px = x;
        py = y + h - (dist - 2 * w - h);
      }
      perimeterPoints.push({ x: px, y: py });
    }

    // Draw arcs between consecutive perimeter points
    ctx.beginPath();
    for (let i = 0; i < perimeterPoints.length - 1; i++) {
      const a = perimeterPoints[i];
      const b = perimeterPoints[i + 1];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      // Bulge outward from the rectangle center
      const cx = (x + w / 2);
      const cy = (y + h / 2);
      const dx = mx - cx;
      const dy = my - cy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const bulge = arcRadius * 0.6;
      const cpx = mx + (dx / len) * bulge;
      const cpy = my + (dy / len) * bulge;

      if (i === 0) {
        ctx.moveTo(a.x, a.y);
      }
      ctx.quadraticCurveTo(cpx, cpy, b.x, b.y);
    }
    ctx.stroke();
  }

  function drawArrow(ctx: CanvasRenderingContext2D, ann: AnnotationEntry) {
    if (ann.points.length < 2) return;
    const [start, end] = ann.points;

    ctx.strokeStyle = ann.color;
    ctx.fillStyle = ann.color;
    ctx.lineWidth = ann.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Line
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLen = 12 + ann.width * 2;
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLen * Math.cos(angle - Math.PI / 6),
      end.y - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      end.x - headLen * Math.cos(angle + Math.PI / 6),
      end.y - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }

  function drawText(ctx: CanvasRenderingContext2D, ann: AnnotationEntry) {
    if (!ann.text || ann.points.length === 0) return;
    const { x, y } = ann.points[0];
    const fontSize = 14;

    ctx.font = `${fontSize}px sans-serif`;
    const metrics = ctx.measureText(ann.text);
    const textWidth = metrics.width;
    const textHeight = fontSize;
    const pad = 6;

    // Background pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    const rx = 4;
    const bx = x - pad;
    const by = y - textHeight - pad;
    const bw = textWidth + pad * 2;
    const bh = textHeight + pad * 2;

    ctx.beginPath();
    ctx.moveTo(bx + rx, by);
    ctx.lineTo(bx + bw - rx, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + rx);
    ctx.lineTo(bx + bw, by + bh - rx);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - rx, by + bh);
    ctx.lineTo(bx + rx, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - rx);
    ctx.lineTo(bx, by + rx);
    ctx.quadraticCurveTo(bx, by, bx + rx, by);
    ctx.closePath();
    ctx.fill();

    // Text
    ctx.fillStyle = ann.color;
    ctx.textBaseline = 'bottom';
    ctx.fillText(ann.text, x, y);
  }

  // Preview drawing (for cloud rectangle and arrow while dragging)
  function drawPreview(ctx: CanvasRenderingContext2D, endPt: { x: number; y: number }) {
    const sp = startPoint.current;
    if (!sp) return;

    if (tool === 'cloud') {
      // Rectangle preview
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(
        Math.min(sp.x, endPt.x),
        Math.min(sp.y, endPt.y),
        Math.abs(endPt.x - sp.x),
        Math.abs(endPt.y - sp.y)
      );
      ctx.setLineDash([]);
    } else if (tool === 'arrow') {
      // Arrow preview
      drawArrow(ctx, {
        type: 'arrow',
        points: [sp, endPt],
        color,
        width: lineWidth,
      });
    }
  }

  // ── Mouse event handlers ──────────────────────────────────────

  const getCanvasPos = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pos = getCanvasPos(e);

    if (tool === 'text') {
      setTextPopup(pos);
      setTextValue('');
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    isDrawing.current = true;
    startPoint.current = pos;
    currentPoints.current = [pos];
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing.current) return;
    const pos = getCanvasPos(e);

    if (tool === 'freehand') {
      currentPoints.current.push(pos);
      // Live draw
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      redraw();
      drawFreehand(ctx, {
        type: 'freehand',
        points: currentPoints.current,
        color,
        width: lineWidth,
      });
    } else if (tool === 'cloud' || tool === 'arrow') {
      // Live preview
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      redraw();
      drawPreview(ctx, pos);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const pos = getCanvasPos(e);

    if (tool === 'freehand') {
      currentPoints.current.push(pos);
      if (currentPoints.current.length >= 2) {
        setAnnotations((prev) => [
          ...prev,
          {
            type: 'freehand',
            points: [...currentPoints.current],
            color,
            width: lineWidth,
          },
        ]);
      }
    } else if (tool === 'cloud' && startPoint.current) {
      setAnnotations((prev) => [
        ...prev,
        {
          type: 'cloud',
          points: [startPoint.current!, pos],
          color,
          width: lineWidth,
        },
      ]);
    } else if (tool === 'arrow' && startPoint.current) {
      setAnnotations((prev) => [
        ...prev,
        {
          type: 'arrow',
          points: [startPoint.current!, pos],
          color,
          width: lineWidth,
        },
      ]);
    }

    currentPoints.current = [];
    startPoint.current = null;
  };

  // ── Text submit ───────────────────────────────────────────────

  const handleTextSubmit = () => {
    if (!textPopup || !textValue.trim()) {
      setTextPopup(null);
      return;
    }
    setAnnotations((prev) => [
      ...prev,
      {
        type: 'text',
        points: [textPopup],
        color,
        width: lineWidth,
        text: textValue.trim(),
      },
    ]);
    setTextPopup(null);
    setTextValue('');
  };

  const handleTextKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTextSubmit();
    } else if (e.key === 'Escape') {
      setTextPopup(null);
    }
  };

  // ── Clear all ─────────────────────────────────────────────────

  const handleClearAll = () => {
    setAnnotations([]);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      if (ctx) ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }
  };

  // ── Render ────────────────────────────────────────────────────

  if (!active) return null;

  return (
    <div className={`annotations-overlay ${className || ''}`} ref={containerRef}>
      {/* Toolbar */}
      <div className="ann-toolbar">
        <div className="ann-toolbar-group">
          <button
            className={`ann-tool-btn ${tool === 'text' ? 'active' : ''}`}
            onClick={() => setTool('text')}
            title="Text annotation"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <polyline points="4 7 4 4 20 4 20 7" />
              <line x1="9" y1="20" x2="15" y2="20" />
              <line x1="12" y1="4" x2="12" y2="20" />
            </svg>
            <span>Text</span>
          </button>

          <button
            className={`ann-tool-btn ${tool === 'freehand' ? 'active' : ''}`}
            onClick={() => setTool('freehand')}
            title="Freehand drawing"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M3 17c3.5-3.5 6-2 8-5s3.5-6.5 7-3" />
            </svg>
            <span>Freehand</span>
          </button>

          <button
            className={`ann-tool-btn ${tool === 'cloud' ? 'active' : ''}`}
            onClick={() => setTool('cloud')}
            title="Revision cloud"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
            <span>Cloud</span>
          </button>

          <button
            className={`ann-tool-btn ${tool === 'arrow' ? 'active' : ''}`}
            onClick={() => setTool('arrow')}
            title="Arrow annotation"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <line x1="5" y1="19" x2="19" y2="5" />
              <polyline points="12 5 19 5 19 12" />
            </svg>
            <span>Arrow</span>
          </button>
        </div>

        <div className="ann-separator" />

        {/* Color picker */}
        <div className="ann-toolbar-group">
          <label className="ann-color-label" title="Annotation color">
            <span className="ann-color-swatch" style={{ backgroundColor: color }} />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="ann-color-input"
            />
          </label>
        </div>

        <div className="ann-separator" />

        {/* Line width toggles */}
        <div className="ann-toolbar-group">
          {LINE_WIDTHS.map((w) => (
            <button
              key={w}
              className={`ann-tool-btn ann-width-btn ${lineWidth === w ? 'active' : ''}`}
              onClick={() => setLineWidth(w)}
              title={`Line width: ${w}px`}
            >
              <span
                className="ann-width-preview"
                style={{ height: `${w}px` }}
              />
            </button>
          ))}
        </div>

        <div className="ann-separator" />

        {/* Actions */}
        <div className="ann-toolbar-group">
          <button
            className="ann-tool-btn ann-danger"
            onClick={handleClearAll}
            title="Clear all annotations"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Clear All</span>
          </button>

          <button
            className="ann-tool-btn ann-close-btn"
            onClick={onClose}
            title="Close annotations"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Drawing canvas */}
      <canvas
        ref={canvasRef}
        className="ann-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDrawing.current) {
            isDrawing.current = false;
            currentPoints.current = [];
            startPoint.current = null;
            redraw();
          }
        }}
      />

      {/* Text input popup */}
      {textPopup && (
        <div
          className="ann-text-popup"
          style={{ left: textPopup.x, top: textPopup.y }}
        >
          <input
            ref={textInputRef}
            type="text"
            className="ann-text-input"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={handleTextKeyDown}
            onBlur={handleTextSubmit}
            placeholder="Type annotation..."
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
