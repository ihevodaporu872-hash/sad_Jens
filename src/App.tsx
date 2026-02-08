import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TabNavigation } from './components/Layout/TabNavigation';
import './App.css';

// Lazy-loaded viewers for code splitting
const ModelViewerPage = lazy(() => import('./components/ModelViewerPage/ModelViewerPage').then(m => ({ default: m.ModelViewerPage })));
const CadViewer = lazy(() => import('./components/CadViewer/CadViewer').then(m => ({ default: m.CadViewer })));
const PdfViewer = lazy(() => import('./components/PdfViewer/PdfViewer').then(m => ({ default: m.PdfViewer })));
const ExcelViewer = lazy(() => import('./components/ExcelViewer/ExcelViewer').then(m => ({ default: m.ExcelViewer })));

function LoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
      Loading...
    </div>
  );
}

// Universal Document Viewer
function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <TabNavigation />
        <div className="main-content">
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/ifc" replace />} />
              <Route path="/ifc" element={<ModelViewerPage />} />
              <Route path="/cad" element={<CadViewer />} />
              <Route path="/pdf" element={<PdfViewer />} />
              <Route path="/excel" element={<ExcelViewer />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
