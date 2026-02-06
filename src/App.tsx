import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TabNavigation } from './components/Layout/TabNavigation';
import { IfcViewer } from './components/IfcViewer';
import { CadViewer } from './components/CadViewer';
import { PdfViewer } from './components/PdfViewer/PdfViewer';
import { ExcelViewer } from './components/ExcelViewer/ExcelViewer';
import './App.css';

// Universal Document Viewer
function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <TabNavigation />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/ifc" replace />} />
            <Route path="/ifc" element={<IfcViewer />} />
            <Route path="/cad" element={<CadViewer />} />
            <Route path="/pdf" element={<PdfViewer />} />
            <Route path="/excel" element={<ExcelViewer />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
