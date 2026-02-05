import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { IfcViewer } from './components/IFCViewer';
import './App.css';

// IFC/BIM Viewer mode
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/ifc" replace />} />
        <Route path="/ifc" element={<IfcViewer />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
