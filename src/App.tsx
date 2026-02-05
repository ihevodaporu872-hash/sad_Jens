import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TabNavigation } from './components/Layout/TabNavigation';
import { ExcelPage } from './pages/ExcelPage';
import { PdfPage } from './pages/PdfPage';
import { CadPage } from './pages/CadPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <TabNavigation />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/excel" replace />} />
            <Route path="/excel" element={<ExcelPage />} />
            <Route path="/pdf" element={<PdfPage />} />
            <Route path="/cad" element={<CadPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
