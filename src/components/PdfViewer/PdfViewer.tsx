import { useState, useCallback, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { AnnotationModel, AnnotationLayer, AnnotationItem } from './types';
import { parseXmlMarkup } from './xmlMarkupParser';
import { parseJsonMarkup } from './jsonMarkupParser';
import { PdfOverlay } from './PdfOverlay';
import { AnnotationSidebar } from './AnnotationSidebar';
import './PdfViewer.css';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface DocumentInfo {
  name: string;
  size: number;
  currentPage: number;
  totalPages: number;
}

interface PageRenderInfo {
  pageIndex: number;
  width: number;       // rendered (scaled) width
  height: number;      // rendered (scaled) height
  baseWidth: number;   // base width at scale=1 (PDF coordinate space)
  baseHeight: number;  // base height at scale=1 (PDF coordinate space)
}

export function PdfViewer() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const markupInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [documentInfo, setDocumentInfo] = useState<DocumentInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);

  // Annotation state
  const [, setAnnotationModel] = useState<AnnotationModel | null>(null);
  const [layers, setLayers] = useState<AnnotationLayer[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [markupFileName, setMarkupFileName] = useState<string | null>(null);
  const [pageViewports, setPageViewports] = useState<PageRenderInfo[]>([]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Render a single page to canvas and return viewport info (including base dimensions)
  const renderPage = useCallback(async (
    pdf: pdfjsLib.PDFDocumentProxy,
    pageNum: number,
    container: HTMLDivElement,
    renderScale: number,
  ): Promise<PageRenderInfo> => {
    const page = await pdf.getPage(pageNum);

    // Get base viewport (scale=1) for coordinate mapping
    const baseViewport = page.getViewport({ scale: 1 });
    // Get scaled viewport for rendering
    const viewport = page.getViewport({ scale: renderScale });

    const pageDiv = document.createElement('div');
    pageDiv.className = 'pdf-page';
    pageDiv.setAttribute('data-page-number', String(pageNum));
    pageDiv.style.position = 'relative';
    pageDiv.style.width = `${viewport.width}px`;
    pageDiv.style.height = 'auto';

    const canvas = document.createElement('canvas');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    canvas.style.display = 'block';

    pageDiv.appendChild(canvas);

    // Page number label
    const label = document.createElement('div');
    label.className = 'pdf-page-label';
    label.textContent = `Page ${pageNum}`;
    pageDiv.appendChild(label);

    container.appendChild(pageDiv);

    await page.render({
      canvas,
      viewport,
    }).promise;

    return {
      pageIndex: pageNum,
      width: viewport.width,
      height: viewport.height,
      baseWidth: baseViewport.width,
      baseHeight: baseViewport.height,
    };
  }, []);

  // Render all pages
  const renderAllPages = useCallback(async (pdf: pdfjsLib.PDFDocumentProxy, renderScale: number) => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const viewports: PageRenderInfo[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const info = await renderPage(pdf, i, containerRef.current, renderScale);
      viewports.push(info);
    }
    setPageViewports(viewports);
  }, [renderPage]);

  // Load PDF from ArrayBuffer
  const loadPdfData = useCallback(async (data: ArrayBuffer, fileName: string, fileSize: number) => {
    setIsLoading(true);
    setError(null);

    try {
      if (pdfDocRef.current) {
        await pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }

      const pdf = await pdfjsLib.getDocument({ data }).promise;
      pdfDocRef.current = pdf;

      setDocumentInfo({
        name: fileName,
        size: fileSize,
        currentPage: 1,
        totalPages: pdf.numPages,
      });
      setCurrentPage(1);

      await renderAllPages(pdf, scale);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to load PDF file');
      setIsLoading(false);
    }
  }, [scale, renderAllPages]);

  // Load PDF file
  const loadPdfFile = useCallback(async (file: File) => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF file');
      return;
    }
    const arrayBuffer = await file.arrayBuffer();
    await loadPdfData(arrayBuffer, file.name, file.size);
  }, [loadPdfData]);

  // --- Markup loading (from text) ---
  const loadMarkupFromText = useCallback((text: string, fileName: string) => {
    try {
      let model: AnnotationModel;
      const lowerName = fileName.toLowerCase();

      if (lowerName.endsWith('.xml')) {
        model = parseXmlMarkup(text);
      } else if (lowerName.endsWith('.json')) {
        model = parseJsonMarkup(text);
      } else {
        const trimmed = text.trim();
        if (trimmed.startsWith('<') || trimmed.startsWith('<?xml')) {
          model = parseXmlMarkup(text);
        } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          model = parseJsonMarkup(text);
        } else {
          setError('Unsupported markup format. Use XML or JSON.');
          return;
        }
      }

      setAnnotationModel(model);
      setLayers(model.layers);
      setMarkupFileName(fileName);
      setShowSidebar(true);
      setSelectedItemId(null);
      console.log('Markup loaded:', fileName, '— layers:', model.layers.length, '— items:', model.layers.reduce((s, l) => s + l.items.length, 0));
    } catch (err) {
      console.error('Failed to parse markup:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse markup file');
    }
  }, []);

  // Load markup from File
  const loadMarkupFile = useCallback(async (file: File) => {
    const text = await file.text();
    loadMarkupFromText(text, file.name);
  }, [loadMarkupFromText]);

  // Handle file uploads
  const handleFileUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await loadPdfFile(file);
    event.target.value = '';
  }, [loadPdfFile]);

  const handleMarkupUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await loadMarkupFile(file);
    event.target.value = '';
  }, [loadMarkupFile]);

  // Drag & Drop
  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(event.dataTransfer.files);
    for (const file of files) {
      const name = file.name.toLowerCase();
      if (name.endsWith('.pdf') || file.type.includes('pdf')) {
        await loadPdfFile(file);
      } else if (name.endsWith('.xml') || name.endsWith('.json')) {
        await loadMarkupFile(file);
      }
    }
  }, [loadPdfFile, loadMarkupFile]);

  const handleUploadClick = useCallback(() => fileInputRef.current?.click(), []);
  const handleMarkupUploadClick = useCallback(() => markupInputRef.current?.click(), []);

  // Load test PDF
  const loadTestFile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/test-files/test.pdf');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      await loadPdfData(arrayBuffer, 'test.pdf', arrayBuffer.byteLength);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test file');
      setIsLoading(false);
    }
  }, [loadPdfData]);

  // Load test markup (XML)
  const loadTestMarkup = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/test-files/test-markup.xml');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      loadMarkupFromText(text, 'test-markup.xml');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test markup');
    }
  }, [loadMarkupFromText]);

  // Navigation
  const goToPage = useCallback((pageNum: number) => {
    if (!containerRef.current || !documentInfo) return;
    const clampedPage = Math.max(1, Math.min(pageNum, documentInfo.totalPages));
    setCurrentPage(clampedPage);
    const pageEl = containerRef.current.querySelector(`[data-page-number="${clampedPage}"]`);
    if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [documentInfo]);

  // Zoom
  const handleZoomIn = useCallback(async () => {
    const newScale = Math.min(scale + 0.25, 4);
    setScale(newScale);
    if (pdfDocRef.current) await renderAllPages(pdfDocRef.current, newScale);
  }, [scale, renderAllPages]);

  const handleZoomOut = useCallback(async () => {
    const newScale = Math.max(scale - 0.25, 0.5);
    setScale(newScale);
    if (pdfDocRef.current) await renderAllPages(pdfDocRef.current, newScale);
  }, [scale, renderAllPages]);

  // --- Annotation layer controls ---
  const handleToggleLayer = useCallback((layerId: string) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l));
  }, []);

  const handleChangeLayerColor = useCallback((layerId: string, color: string) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, color } : l));
  }, []);

  const handleChangeLayerOpacity = useCallback((layerId: string, opacity: number) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, opacity } : l));
  }, []);

  const handleSelectItem = useCallback((item: AnnotationItem) => {
    setSelectedItemId(prev => prev === item.id ? null : item.id);
    if (containerRef.current) {
      const pageEl = containerRef.current.querySelector(`[data-page-number="${item.page}"]`);
      if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleOverlayItemClick = useCallback((item: AnnotationItem) => {
    setSelectedItemId(prev => prev === item.id ? null : item.id);
  }, []);

  const handleCloseSidebar = useCallback(() => setShowSidebar(false), []);

  // Cleanup
  useEffect(() => {
    return () => { if (pdfDocRef.current) pdfDocRef.current.destroy(); };
  }, []);

  return (
    <div className="pdf-viewer-wrapper">
      <div className={`pdf-viewer ${showSidebar ? 'with-sidebar' : ''}`}>
        <div className="pdf-toolbar">
          <div className="pdf-toolbar-header">
            <h2>{documentInfo?.name || 'PDF Viewer'}</h2>
            <p>
              View PDF with annotation overlay
              {markupFileName && (
                <span className="markup-file-badge"> | Markup: {markupFileName}</span>
              )}
            </p>
          </div>
          <div className="pdf-toolbar-actions">
            {documentInfo && (
              <div className="pdf-document-info">
                <span className="pdf-page-info">
                  Page {currentPage} / {documentInfo.totalPages}
                </span>
                <span className="pdf-size-info">
                  {formatFileSize(documentInfo.size)}
                </span>
              </div>
            )}
            {documentInfo && (
              <>
                <button className="pdf-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>Prev</button>
                <button className="pdf-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= documentInfo.totalPages}>Next</button>
                <button className="pdf-btn" onClick={handleZoomOut} disabled={scale <= 0.5}>-</button>
                <span style={{ color: '#e0e0e0', fontSize: '0.8rem' }}>{Math.round(scale * 100)}%</span>
                <button className="pdf-btn" onClick={handleZoomIn} disabled={scale >= 4}>+</button>
              </>
            )}
            <button className="pdf-upload-btn" onClick={handleUploadClick} disabled={isLoading}>
              Upload PDF
            </button>
            <button
              className="pdf-btn pdf-markup-btn"
              onClick={handleMarkupUploadClick}
              disabled={isLoading || !documentInfo}
              title="Load XML or JSON markup file"
            >
              Load Markup
            </button>
            {layers.length > 0 && (
              <button
                className={`pdf-btn ${showSidebar ? 'pdf-btn-active' : ''}`}
                onClick={() => setShowSidebar(!showSidebar)}
              >
                Layers
              </button>
            )}
            <button className="pdf-btn" onClick={loadTestFile} disabled={isLoading} data-testid="load-test-pdf">
              Load Test PDF
            </button>
            <button
              className="pdf-btn pdf-test-markup-btn"
              onClick={loadTestMarkup}
              disabled={isLoading || !documentInfo}
              data-testid="load-test-markup"
              title="Load test-markup.xml from server"
            >
              Load Test Markup
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={handleFileUpload} className="pdf-file-input" disabled={isLoading} />
            <input ref={markupInputRef} type="file" accept=".xml,.json,application/xml,application/json,text/xml" onChange={handleMarkupUpload} className="pdf-file-input" disabled={isLoading} />
          </div>
        </div>
        <div
          className={`pdf-container ${isDragOver ? 'pdf-drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div ref={containerRef} className="pdf-pages-container" data-testid="pdf-pages-container" />

          {/* SVG Overlays — use base dimensions for viewBox so coordinates map correctly */}
          {layers.length > 0 && pageViewports.map(({ pageIndex, width, height, baseWidth, baseHeight }) => (
            <PdfPageOverlay
              key={`overlay-${pageIndex}-${scale}`}
              containerRef={containerRef}
              pageIndex={pageIndex}
              width={width}
              height={height}
              baseWidth={baseWidth}
              baseHeight={baseHeight}
              layers={layers}
              selectedItemId={selectedItemId}
              onItemClick={handleOverlayItemClick}
              scale={scale}
            />
          ))}

          {isLoading && (
            <div className="pdf-overlay">
              <div className="pdf-spinner" />
              <p>Loading PDF...</p>
            </div>
          )}

          {error && (
            <div className="pdf-overlay pdf-error">
              <p>Error: {error}</p>
              <button className="pdf-btn" onClick={clearError}>Dismiss</button>
            </div>
          )}

          {isDragOver && (
            <div className="pdf-overlay pdf-drag-overlay">
              <p>Drop PDF or markup file here</p>
            </div>
          )}

          {!documentInfo && !isLoading && !error && (
            <div className="pdf-overlay">
              <div style={{ textAlign: 'center' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.5 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Drop PDF + markup files here</p>
                <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>or use buttons above</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showSidebar && layers.length > 0 && (
        <AnnotationSidebar
          layers={layers}
          selectedItemId={selectedItemId}
          onToggleLayer={handleToggleLayer}
          onChangeLayerColor={handleChangeLayerColor}
          onChangeLayerOpacity={handleChangeLayerOpacity}
          onSelectItem={handleSelectItem}
          onClose={handleCloseSidebar}
        />
      )}
    </div>
  );
}

// --- Helper: position SVG overlay on a specific PDF page ---

interface PdfPageOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  pageIndex: number;
  width: number;       // rendered (scaled)
  height: number;      // rendered (scaled)
  baseWidth: number;   // base at scale=1
  baseHeight: number;  // base at scale=1
  layers: AnnotationLayer[];
  selectedItemId: string | null;
  onItemClick: (item: AnnotationItem) => void;
  scale: number;
}

function PdfPageOverlay({
  containerRef,
  pageIndex,
  width,
  height,
  baseWidth,
  baseHeight,
  layers,
  selectedItemId,
  onItemClick,
  scale,
}: PdfPageOverlayProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const pageEl = containerRef.current.querySelector(`[data-page-number="${pageIndex}"]`) as HTMLElement;
    if (!pageEl) return;

    const updatePosition = () => {
      const containerRect = containerRef.current!.getBoundingClientRect();
      const pageRect = pageEl.getBoundingClientRect();
      setPosition({
        top: pageRect.top - containerRect.top + containerRef.current!.scrollTop,
        left: pageRect.left - containerRect.left + containerRef.current!.scrollLeft,
      });
    };

    updatePosition();

    const scrollContainer = containerRef.current.parentElement;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', updatePosition);
      return () => scrollContainer.removeEventListener('scroll', updatePosition);
    }
  }, [containerRef, pageIndex, scale, width, height]);

  if (!position) return null;

  const hasItems = layers.some(l => l.visible && l.items.some(i => i.page === pageIndex));
  if (!hasItems) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        width,
        height,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <PdfOverlay
        pageIndex={pageIndex}
        viewportWidth={width}
        viewportHeight={height}
        baseWidth={baseWidth}
        baseHeight={baseHeight}
        layers={layers}
        selectedItemId={selectedItemId}
        onItemClick={onItemClick}
      />
    </div>
  );
}
