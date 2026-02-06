import { useState, useCallback, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import './PdfViewer.css';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Helper function to format file size
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

export function PdfViewer() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [documentInfo, setDocumentInfo] = useState<DocumentInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Render a single page to canvas
  const renderPage = useCallback(async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number, container: HTMLDivElement, renderScale: number) => {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: renderScale });

    const pageDiv = document.createElement('div');
    pageDiv.className = 'pdf-page';
    pageDiv.setAttribute('data-page-number', String(pageNum));

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto 16px auto';

    pageDiv.appendChild(canvas);

    // Page number label
    const label = document.createElement('div');
    label.className = 'pdf-page-label';
    label.textContent = `Page ${pageNum}`;
    pageDiv.appendChild(label);

    container.appendChild(pageDiv);

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;
  }, []);

  // Render all pages
  const renderAllPages = useCallback(async (pdf: pdfjsLib.PDFDocumentProxy, renderScale: number) => {
    if (!containerRef.current) return;

    // Clear previous content
    containerRef.current.innerHTML = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      await renderPage(pdf, i, containerRef.current, renderScale);
    }
  }, [renderPage]);

  // Load PDF from ArrayBuffer
  const loadPdfData = useCallback(async (data: ArrayBuffer, fileName: string, fileSize: number) => {
    setIsLoading(true);
    setError(null);

    try {
      // Dispose previous document
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

  // Handle file upload via input
  const handleFileUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await loadPdfFile(file);
    }
    event.target.value = '';
  }, [loadPdfFile]);

  // Drag & Drop handlers
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

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      await loadPdfFile(files[0]);
    }
  }, [loadPdfFile]);

  // Handle click on upload button
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Load test file
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

  // Navigation
  const goToPage = useCallback((pageNum: number) => {
    if (!containerRef.current || !documentInfo) return;
    const clampedPage = Math.max(1, Math.min(pageNum, documentInfo.totalPages));
    setCurrentPage(clampedPage);
    const pageEl = containerRef.current.querySelector(`[data-page-number="${clampedPage}"]`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [documentInfo]);

  // Zoom
  const handleZoomIn = useCallback(async () => {
    const newScale = Math.min(scale + 0.25, 4);
    setScale(newScale);
    if (pdfDocRef.current) {
      await renderAllPages(pdfDocRef.current, newScale);
    }
  }, [scale, renderAllPages]);

  const handleZoomOut = useCallback(async () => {
    const newScale = Math.max(scale - 0.25, 0.5);
    setScale(newScale);
    if (pdfDocRef.current) {
      await renderAllPages(pdfDocRef.current, newScale);
    }
  }, [scale, renderAllPages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-header">
          <h2>{documentInfo?.name || 'PDF Viewer'}</h2>
          <p>View PDF documents locally with pdf.js</p>
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
              <button className="pdf-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
                Prev
              </button>
              <button className="pdf-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= documentInfo.totalPages}>
                Next
              </button>
              <button className="pdf-btn" onClick={handleZoomOut} disabled={scale <= 0.5}>
                -
              </button>
              <span style={{ color: '#e0e0e0', fontSize: '0.8rem' }}>{Math.round(scale * 100)}%</span>
              <button className="pdf-btn" onClick={handleZoomIn} disabled={scale >= 4}>
                +
              </button>
            </>
          )}
          <button
            className="pdf-upload-btn"
            onClick={handleUploadClick}
            disabled={isLoading}
          >
            Upload PDF
          </button>
          <button
            className="pdf-btn"
            onClick={loadTestFile}
            disabled={isLoading}
            data-testid="load-test-pdf"
          >
            Load Test PDF
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileUpload}
            className="pdf-file-input"
            disabled={isLoading}
          />
        </div>
      </div>
      <div
        className={`pdf-container ${isDragOver ? 'pdf-drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div ref={containerRef} className="pdf-pages-container" data-testid="pdf-pages-container" />

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
            <p>Drop PDF file here</p>
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
              <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Drop a PDF file here</p>
              <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>or click "Upload PDF" / "Load Test PDF" button above</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
