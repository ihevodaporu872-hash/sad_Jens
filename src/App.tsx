import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { IfcViewer } from './components/IfcViewer';
import { CadViewer } from './components/CadViewer';
import { PdfViewer } from './components/PdfViewer/PdfViewer';
// TODO: Fix ExcelViewer - @univerjs packages require decorator support
// import { ExcelViewer } from './components/ExcelViewer/ExcelViewer';
import './App.css';

// Placeholder for ExcelViewer while it's disabled
function ExcelViewerPlaceholder() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Excel Viewer</h2>
      <p>Excel Viewer is temporarily disabled due to build configuration issues.</p>
    </div>
  );
}

// Universal Document Viewer
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/ifc" replace />} />
        <Route path="/ifc" element={<IfcViewer />} />
        <Route path="/cad" element={<CadViewer />} />
        <Route path="/pdf" element={<PdfViewer />} />
        <Route path="/excel" element={<ExcelViewerPlaceholder />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
