import { CadViewer } from '../components/CadViewer/CadViewer';

export function CadTest() {
  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <CadViewer 
        onDocumentLoaded={(title) => console.log('CAD loaded:', title)}
        onError={(error) => console.error('CAD error:', error)}
      />
    </div>
  );
}
