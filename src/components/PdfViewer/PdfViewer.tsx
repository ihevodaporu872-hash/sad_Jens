import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
import { EmbedPDF, useEmbed, type EmbedEvent } from '@simplepdf';
import './PdfViewer.css';

// Re-export types from SimplePDF for consumers
export type { EmbedEvent };

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

interface PdfViewerProps {
  /** URL to the PDF document to display */
  documentURL?: string;
  /** Optional company identifier for SimplePDF */
  companyIdentifier?: string;
  /** Locale for the editor interface */
  locale?: 'en' | 'de' | 'es' | 'fr' | 'it' | 'pt' | 'nl';
  /** Callback for PDF events */
  onEmbedEvent?: (event: EmbedEvent) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
  /** Callback when a document is loaded */
  onDocumentLoaded?: (name: string) => void;
}

export function PdfViewer({
  documentURL,
  companyIdentifier,
  locale = 'en',
  onEmbedEvent,
  onError,
  onDocumentLoaded,
}: PdfViewerProps) {
  const { embedRef, actions } = useEmbed();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [documentInfo, setDocumentInfo] = useState<DocumentInfo | null>(null);

  const setErrorWithCallback = useCallback((errorMessage: string) => {
    setError(errorMessage);
    onError?.(errorMessage);
  }, [onError]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Convert file to data URL
  const fileToDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  // Load PDF file
  const loadPdfFile = useCallback(async (file: File) => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorWithCallback('Please select a valid PDF file');
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await actions.loadDocument({ dataUrl, name: file.name });

      if (result.success) {
        setDocumentInfo({
          name: file.name,
          size: file.size,
          currentPage: 1,
          totalPages: 0,
        });
        onDocumentLoaded?.(file.name);
      } else {
        setErrorWithCallback(result.error?.message || 'Failed to load PDF');
      }
    } catch (err) {
      console.error('Failed to load PDF:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load PDF file';
      setErrorWithCallback(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [actions, fileToDataUrl, setErrorWithCallback, clearError, onDocumentLoaded]);

  // Handle file upload via input
  const handleFileUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await loadPdfFile(file);
    }
    // Reset input to allow re-uploading same file
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
      const file = files[0];
      await loadPdfFile(file);
    }
  }, [loadPdfFile]);

  const handleEmbedEvent = useCallback((event: EmbedEvent) => {
    console.log('PDF event:', event.type, event.data);

    if (event.type === 'EDITOR_READY') {
      setEditorReady(true);
    }

    if (event.type === 'DOCUMENT_LOADED') {
      setIsLoading(false);
    }

    if (event.type === 'PAGE_FOCUSED') {
      const { current_page, total_pages } = event.data;
      setDocumentInfo((prev) => prev ? {
        ...prev,
        currentPage: current_page,
        totalPages: total_pages,
      } : null);
    }

    onEmbedEvent?.(event);
  }, [onEmbedEvent]);

  // Handle click on upload button
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-header">
          <h2>{documentInfo?.name || 'PDF Viewer'}</h2>
          <p>Powered by SimplePDF - View, edit, and sign PDF documents</p>
        </div>
        <div className="pdf-toolbar-actions">
          {documentInfo && (
            <div className="pdf-document-info">
              {documentInfo.totalPages > 0 && (
                <span className="pdf-page-info">
                  Page {documentInfo.currentPage} / {documentInfo.totalPages}
                </span>
              )}
              <span className="pdf-size-info">
                {formatFileSize(documentInfo.size)}
              </span>
            </div>
          )}
          <button
            className="pdf-upload-btn"
            onClick={handleUploadClick}
            disabled={!editorReady || isLoading}
          >
            Upload PDF
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileUpload}
            className="pdf-file-input"
            disabled={!editorReady || isLoading}
          />
        </div>
      </div>
      <div
        className={`pdf-container ${isDragOver ? 'pdf-drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <EmbedPDF
          ref={embedRef}
          mode="inline"
          style={{ width: '100%', height: '100%' }}
          documentURL={documentURL}
          companyIdentifier={companyIdentifier}
          locale={locale}
          onEmbedEvent={handleEmbedEvent}
        />

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
      </div>
    </div>
  );
}

// Export the useEmbed hook actions for programmatic control
export { useEmbed };
