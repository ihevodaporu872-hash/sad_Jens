import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
import { EmbedPDF, useEmbed, type EmbedEvent } from '@simplepdf';

export function SimplePdfTest() {
  const { embedRef, actions } = useEmbed();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState('Initializing...');
  const [editorReady, setEditorReady] = useState(false);
  const [documentLoaded, setDocumentLoaded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pageInfo, setPageInfo] = useState<{ current: number; total: number } | null>(null);

  const fileToDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  const loadPdfFile = useCallback(async (file: File) => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setStatus('Error: Please select a PDF file');
      return;
    }

    setStatus(`Loading: ${file.name}...`);

    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await actions.loadDocument({ dataUrl, name: file.name });

      if (result.success) {
        setStatus(`Loaded: ${file.name}`);
        setDocumentLoaded(true);
      } else {
        setStatus(`Error: ${result.error?.message || 'Failed to load'}`);
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [actions, fileToDataUrl]);

  const handleFileUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await loadPdfFile(file);
    event.target.value = '';
  }, [loadPdfFile]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await loadPdfFile(file);
  }, [loadPdfFile]);

  const handleEmbedEvent = useCallback((event: EmbedEvent) => {
    console.log('SimplePDF Event:', event.type, event.data);

    switch (event.type) {
      case 'EDITOR_READY':
        setEditorReady(true);
        setStatus('Editor ready - upload a PDF');
        break;
      case 'DOCUMENT_LOADED':
        setDocumentLoaded(true);
        setStatus('Document loaded');
        break;
      case 'PAGE_FOCUSED':
        setPageInfo({
          current: event.data.current_page,
          total: event.data.total_pages,
        });
        break;
      case 'SUBMISSION_SENT':
        setStatus('Document submitted!');
        break;
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a1a2e' }}>
      {/* Header */}
      <div style={{
        padding: '1rem',
        background: '#16213e',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>SimplePDF Test Page</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#888', fontSize: '0.875rem' }}>
            Status: {status}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {pageInfo && (
            <span style={{ color: '#aaa' }}>
              Page {pageInfo.current} / {pageInfo.total}
            </span>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!editorReady}
            style={{
              padding: '0.5rem 1rem',
              background: editorReady ? '#646cff' : '#444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: editorReady ? 'pointer' : 'not-allowed',
            }}
          >
            Upload PDF
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Status indicators */}
      <div style={{ padding: '0.5rem 1rem', background: '#0f3460', display: 'flex', gap: '1rem' }}>
        <span style={{ color: editorReady ? '#4ade80' : '#f87171' }}>
          Editor: {editorReady ? '✓ Ready' : '○ Loading'}
        </span>
        <span style={{ color: documentLoaded ? '#4ade80' : '#888' }}>
          Document: {documentLoaded ? '✓ Loaded' : '○ None'}
        </span>
      </div>

      {/* PDF Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          flex: 1,
          position: 'relative',
          border: isDragOver ? '3px dashed #646cff' : 'none',
        }}
      >
        <EmbedPDF
          ref={embedRef}
          mode="inline"
          style={{ width: '100%', height: '100%' }}
          locale="en"
          onEmbedEvent={handleEmbedEvent}
        />

        {isDragOver && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(100, 108, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#646cff',
            fontSize: '1.5rem',
            fontWeight: 'bold',
          }}>
            Drop PDF here
          </div>
        )}
      </div>
    </div>
  );
}
