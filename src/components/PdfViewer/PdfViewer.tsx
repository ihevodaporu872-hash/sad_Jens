import { EmbedPDF, useEmbed, type EmbedEvent } from '@simplepdf';
import './PdfViewer.css';

// Re-export types from SimplePDF for consumers
export type { EmbedEvent };

interface PdfViewerProps {
  /** URL to the PDF document to display */
  documentURL?: string;
  /** Optional company identifier for SimplePDF */
  companyIdentifier?: string;
  /** Locale for the editor interface */
  locale?: 'en' | 'de' | 'es' | 'fr' | 'it' | 'pt' | 'nl';
  /** Callback for PDF events */
  onEmbedEvent?: (event: EmbedEvent) => void;
}

export function PdfViewer({
  documentURL = '/sample-files/sample.pdf',
  companyIdentifier,
  locale = 'en',
  onEmbedEvent,
}: PdfViewerProps) {
  const { embedRef, actions } = useEmbed();

  const handleEmbedEvent = (event: EmbedEvent) => {
    console.log('PDF event:', event.type, event.data);
    onEmbedEvent?.(event);
  };

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <h2>PDF Viewer</h2>
        <p>Powered by SimplePDF - View, edit, and sign PDF documents</p>
      </div>
      <div className="pdf-container">
        <EmbedPDF
          ref={embedRef}
          mode="inline"
          style={{ width: '100%', height: '100%' }}
          documentURL={documentURL}
          companyIdentifier={companyIdentifier}
          locale={locale}
          onEmbedEvent={handleEmbedEvent}
        />
      </div>
    </div>
  );
}

// Export the useEmbed hook actions for programmatic control
export { useEmbed };
