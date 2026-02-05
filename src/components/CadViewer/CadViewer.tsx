import { useEffect, useRef, useState } from 'react';
import type { AcApDocManager as AcApDocManagerType } from '@mlightcad/cad-simple-viewer';
import './CadViewer.css';

export function CadViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const docManagerRef = useRef<AcApDocManagerType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerReady, setViewerReady] = useState(false);

  useEffect(() => {
    const initViewer = async () => {
      if (!containerRef.current) return;

      try {
        setIsLoading(true);
        setError(null);

        const { AcApDocManager } = await import('@mlightcad/cad-simple-viewer');

        const docManager = AcApDocManager.createInstance({
          container: containerRef.current,
          autoResize: true,
        });

        if (docManager) {
          docManagerRef.current = docManager;
          setViewerReady(true);
        } else {
          setError('Failed to create CAD viewer instance');
        }
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize CAD viewer:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize viewer');
        setIsLoading(false);
      }
    };

    initViewer();

    return () => {
      docManagerRef.current = null;
    };
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !docManagerRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const success = await docManagerRef.current.openDocument(file.name, arrayBuffer, {});

      if (!success) {
        setError('Failed to open the CAD file');
      }
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load file:', err);
      setError(err instanceof Error ? err.message : 'Failed to load file');
      setIsLoading(false);
    }
  };

  return (
    <div className="cad-viewer">
      <div className="cad-toolbar">
        <div className="cad-toolbar-header">
          <h2>CAD Viewer</h2>
          <p>Powered by mlightcad - View DWG/DXF files with zoom and pan</p>
        </div>
        <div className="cad-toolbar-actions">
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
