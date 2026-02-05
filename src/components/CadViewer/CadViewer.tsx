import { useEffect, useRef, useState, useCallback, DragEvent } from 'react';
import type {
  AcApDocManager as AcApDocManagerType,
  AcApDocManagerOptions,
  AcDbDocumentEventArgs
} from '@mlightcad/cad-simple-viewer';
import './CadViewer.css';

/** Supported CAD file extensions */
const SUPPORTED_EXTENSIONS = ['.dwg', '.dxf'];

/** Helper function to get user-friendly error messages */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('wasm') || msg.includes('webassembly')) {
      return 'Failed to load WebAssembly module. Please refresh the page or try a different browser.';
    }
    if (msg.includes('memory') || msg.includes('heap')) {
      return 'Not enough memory to load this file. Try a smaller CAD file.';
    }
    if (msg.includes('invalid') || msg.includes('parse') || msg.includes('syntax')) {
      return 'Invalid CAD file format. Please check that the file is a valid DWG or DXF file.';
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return 'Network error. Please check your internet connection.';
    }
    if (msg.includes('timeout')) {
      return 'Loading timed out. The file may be too large or the connection is slow.';
    }
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

/** Check if file has a valid CAD extension */
function isValidCadFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

/** Props for the CadViewer component */
export interface CadViewerProps {
  /** Initial URL to load a CAD file from */
  initialUrl?: string;
  /** Callback when a document is loaded */
  onDocumentLoaded?: (title: string) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
  /** Custom options for the CAD viewer */
  viewerOptions?: Partial<AcApDocManagerOptions>;
  /** Additional CSS class name */
  className?: string;
}

export function CadViewer({
  initialUrl,
  onDocumentLoaded,
  onError,
  viewerOptions,
  className
}: CadViewerProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const docManagerRef = useRef<AcApDocManagerType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [error, setError] = useState<string | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [documentTitle, setDocumentTitle] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasDocument, setHasDocument] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);

  // Handle document activated event
  const handleDocumentActivated = useCallback((args: AcDbDocumentEventArgs) => {
    const title = args.doc.docTitle;
    setDocumentTitle(title);
    setHasDocument(true);
    onDocumentLoaded?.(title);
  }, [onDocumentLoaded]);

  // Set error with callback
  const setErrorWithCallback = useCallback((errorMessage: string) => {
    setError(errorMessage);
    onError?.(errorMessage);
  }, [onError]);

  useEffect(() => {
    let isDestroyed = false;

    const initViewer = async () => {
      if (!containerRef.current) return;

      try {
        setIsLoading(true);
        setLoadingMessage('Initializing CAD viewer...');
        setError(null);

        const { AcApDocManager } = await import('@mlightcad/cad-simple-viewer');

        if (isDestroyed) return;

        const docManager = AcApDocManager.createInstance({
          container: containerRef.current,
          autoResize: true,
          ...viewerOptions,
        });

        if (docManager) {
          docManagerRef.current = docManager;

          // Subscribe to document events
          docManager.events.documentActivated.addEventListener(handleDocumentActivated);

          setViewerReady(true);

          // Load initial URL if provided
          if (initialUrl) {
            setLoadingMessage('Loading CAD file...');
            const success = await docManager.openUrl(initialUrl);
            if (!success) {
              setErrorWithCallback('Failed to load initial CAD file. Please check the file format.');
            }
          }
        } else {
          setErrorWithCallback('Failed to create CAD viewer instance. Please refresh the page.');
        }
        setIsLoading(false);
      } catch (err) {
        if (isDestroyed) return;
        console.error('Failed to initialize CAD viewer:', err);
        const errorMessage = getErrorMessage(err);
        setErrorWithCallback(errorMessage);
        setIsLoading(false);
      }
    };

    initViewer();

    return () => {
      isDestroyed = true;
      if (docManagerRef.current) {
        // Unsubscribe from events
        docManagerRef.current.events.documentActivated.removeEventListener(handleDocumentActivated);
        // Destroy the viewer instance
        docManagerRef.current.destroy();
        docManagerRef.current = null;
      }
    };
  }, [initialUrl, viewerOptions, handleDocumentActivated, setErrorWithCallback]);

  // Process file (shared between upload and drag&drop)
  const processFile = useCallback(async (file: File) => {
    if (!docManagerRef.current) {
      setErrorWithCallback('Viewer not initialized. Please wait and try again.');
      return;
    }

    if (!isValidCadFile(file.name)) {
      setErrorWithCallback(`Unsupported file format. Please use DWG or DXF files.`);
      return;
    }

    setIsLoading(true);
    setLoadingMessage(`Loading ${file.name}...`);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const success = await docManagerRef.current.openDocument(file.name, arrayBuffer, {});

      if (success) {
        setFileInfo({ name: file.name, size: file.size });
      } else {
        setErrorWithCallback('Failed to open the CAD file. The file may be corrupted or in an unsupported format.');
        setFileInfo(null);
      }
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load file:', err);
      const errorMessage = getErrorMessage(err);
      setErrorWithCallback(errorMessage);
      setFileInfo(null);
      setIsLoading(false);
    }
  }, [setErrorWithCallback]);

  // Handle file upload via input
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await processFile(file);

    // Reset input to allow re-uploading the same file
    event.target.value = '';
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (viewerReady && !isLoading) {
      setIsDragging(true);
    }
  }, [viewerReady, isLoading]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging false if we're leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!viewerReady || isLoading) return;

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    await processFile(file);
  }, [viewerReady, isLoading, processFile]);

  // Navigation and view controls
  const handleZoomIn = useCallback(() => {
    docManagerRef.current?.sendStringToExecute('zoom');
  }, []);

  const handleZoomFit = useCallback(() => {
    docManagerRef.current?.curView?.zoomToFitDrawing();
  }, []);

  const handleRegen = useCallback(() => {
    docManagerRef.current?.regen();
  }, []);

  const handlePan = useCallback(() => {
    docManagerRef.current?.sendStringToExecute('pan');
  }, []);

  const handleZoomWindow = useCallback(() => {
    docManagerRef.current?.sendStringToExecute('zoom w');
  }, []);

  const handleZoomPrevious = useCallback(() => {
    docManagerRef.current?.sendStringToExecute('zoom p');
  }, []);

  /** Format file size for display */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className={`cad-viewer ${className || ''}`}>
      <div className="cad-toolbar">
        <div className="cad-toolbar-header">
          <h2>{documentTitle || 'CAD Viewer'}</h2>
          <p>Powered by mlightcad - View DWG/DXF files with zoom and pan</p>
          {fileInfo && (
            <div className="cad-file-info">
              <span className="cad-file-name" title={fileInfo.name}>{fileInfo.name}</span>
              <span className="cad-file-size">{formatFileSize(fileInfo.size)}</span>
            </div>
          )}
        </div>
        <div className="cad-toolbar-actions">
          {viewerReady && hasDocument && (
            <>
              <div className="cad-btn-group">
                <button
                  className="cad-btn"
                  onClick={handlePan}
                  disabled={isLoading}
                  title="Pan (click and drag to move around)"
                >
                  Pan
                </button>
                <button
                  className="cad-btn"
                  onClick={handleZoomIn}
                  disabled={isLoading}
                  title="Interactive zoom"
                >
                  Zoom
                </button>
                <button
                  className="cad-btn"
                  onClick={handleZoomWindow}
                  disabled={isLoading}
                  title="Zoom to window selection"
                >
                  Window
                </button>
                <button
                  className="cad-btn"
                  onClick={handleZoomFit}
                  disabled={isLoading}
                  title="Fit drawing to view"
                >
                  Fit
                </button>
                <button
                  className="cad-btn"
                  onClick={handleZoomPrevious}
                  disabled={isLoading}
                  title="Previous zoom level"
                >
                  Previous
                </button>
              </div>
              <div className="cad-btn-separator" />
              <button
                className="cad-btn"
                onClick={handleRegen}
                disabled={isLoading}
                title="Regenerate view"
              >
                Regen
              </button>
            </>
          )}
          <label className="file-upload-btn">
            Upload DWG/DXF
            <input
              type="file"
              accept=".dwg,.dxf"
              onChange={handleFileUpload}
              disabled={!viewerReady || isLoading}
            />
          </label>
        </div>
      </div>
      <div
        ref={dropZoneRef}
        className={`cad-drop-zone ${isDragging ? 'cad-dragging' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div ref={containerRef} className="cad-container">
          {isLoading && (
            <div className="cad-overlay">
              <div className="cad-spinner" />
              <p>{loadingMessage}</p>
            </div>
          )}
          {error && (
            <div className="cad-overlay cad-error">
              <div className="cad-error-icon">!</div>
              <p className="cad-error-title">Error</p>
              <p className="cad-error-message">{error}</p>
              <button
                className="cad-btn cad-retry-btn"
                onClick={() => setError(null)}
              >
                Dismiss
              </button>
            </div>
          )}
          {!viewerReady && !isLoading && !error && (
            <div className="cad-overlay">
              <div className="cad-spinner" />
              <p>Initializing CAD viewer...</p>
            </div>
          )}
          {viewerReady && !hasDocument && !isLoading && !error && (
            <div className="cad-overlay cad-empty-state">
              <div className="cad-drop-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <p className="cad-drop-title">Drop a CAD file here</p>
              <p className="cad-drop-subtitle">or click "Upload DWG/DXF" button above</p>
              <p className="cad-drop-formats">Supported formats: DWG, DXF</p>
            </div>
          )}
          {isDragging && (
            <div className="cad-overlay cad-drag-overlay">
              <div className="cad-drop-icon cad-drop-icon-active">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="cad-drop-title">Drop to load file</p>
            </div>
          )}
        </div>
      </div>
      {hasDocument && (
        <div className="cad-controls-hint">
          <span>Scroll: Zoom</span>
          <span>Click + drag: Pan</span>
        </div>
      )}
    </div>
  );
}
