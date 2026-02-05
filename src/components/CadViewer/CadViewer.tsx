import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  AcApDocManager as AcApDocManagerType,
  AcApDocManagerOptions,
  AcDbDocumentEventArgs
} from '@mlightcad/cad-simple-viewer';
import './CadViewer.css';

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
}

export function CadViewer({
  initialUrl,
  onDocumentLoaded,
  onError,
  viewerOptions
}: CadViewerProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const docManagerRef = useRef<AcApDocManagerType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [documentTitle, setDocumentTitle] = useState<string | null>(null);

  // Handle document activated event
  const handleDocumentActivated = useCallback((args: AcDbDocumentEventArgs) => {
    const title = args.doc.docTitle;
    setDocumentTitle(title);
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
            const success = await docManager.openUrl(initialUrl);
            if (!success) {
              setErrorWithCallback('Failed to load initial CAD file');
            }
          }
        } else {
          setErrorWithCallback('Failed to create CAD viewer instance');
        }
        setIsLoading(false);
      } catch (err) {
        if (isDestroyed) return;
        console.error('Failed to initialize CAD viewer:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize viewer';
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !docManagerRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const success = await docManagerRef.current.openDocument(file.name, arrayBuffer, {});

      if (!success) {
        setErrorWithCallback('Failed to open the CAD file');
      }
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load file:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load file';
      setErrorWithCallback(errorMessage);
      setIsLoading(false);
    }
  };

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    docManagerRef.current?.sendStringToExecute('zoom');
  }, []);

  const handleZoomFit = useCallback(() => {
    docManagerRef.current?.curView?.zoomToFitDrawing();
  }, []);

  const handleRegen = useCallback(() => {
    docManagerRef.current?.regen();
  }, []);

  return (
    <div className="cad-viewer">
      <div className="cad-toolbar">
        <div className="cad-toolbar-header">
          <h2>{documentTitle || 'CAD Viewer'}</h2>
          <p>Powered by mlightcad - View DWG/DXF files with zoom and pan</p>
        </div>
        <div className="cad-toolbar-actions">
          {viewerReady && documentTitle && (
            <>
              <button
                className="cad-btn"
                onClick={handleZoomIn}
                disabled={isLoading}
                title="Zoom"
              >
                Zoom
              </button>
              <button
                className="cad-btn"
                onClick={handleZoomFit}
                disabled={isLoading}
                title="Fit to view"
              >
                Fit
              </button>
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
      <div ref={containerRef} className="cad-container">
        {isLoading && (
          <div className="cad-overlay">
            <div className="cad-spinner" />
            <p>Loading...</p>
          </div>
        )}
        {error && (
          <div className="cad-overlay cad-error">
            <p>Error: {error}</p>
          </div>
        )}
        {!viewerReady && !isLoading && !error && (
          <div className="cad-overlay">
            <p>Initializing CAD viewer...</p>
          </div>
        )}
      </div>
    </div>
  );
}
