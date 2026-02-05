import { EmbedPDF, type EmbedEvent } from '@simplepdf/react-embed-pdf';
import './PdfViewer.css';

export function PdfViewer() {
  const handleEmbedEvent = (event: EmbedEvent) => {
    console.log('PDF event:', event.type, event.data);
  };

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <h2>PDF Viewer</h2>
        <p>Powered by SimplePDF - View, edit, and sign PDF documents</p>
      </div>
      <div className="pdf-container">
        <EmbedPDF
          mode="inline"
          style={{ width: '100%', height: '100%' }}
          documentURL="/sample-files/sample.pdf"
          onEmbedEvent={handleEmbedEvent}
        />
      </div>
    </div>
  );
}
