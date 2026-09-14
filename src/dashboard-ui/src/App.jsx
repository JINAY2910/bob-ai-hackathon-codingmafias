import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Layout & Components
import Sidebar from './components/Sidebar';
import './index.css';

// Pages
import OperationsPlan from './pages/OperationsPlan';
import Heatmap from './pages/Heatmap';
import BerthAssignments from './pages/BerthAssignments';
import AlternateRoutes from './pages/AlternateRoutes';
import PortReplay from './pages/PortReplay';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<OperationsPlan />} />
            <Route path="/hotspots" element={<Heatmap />} />
            <Route path="/berths" element={<BerthAssignments />} />
            <Route path="/routing" element={<AlternateRoutes />} />
            <Route path="/visualization" element={<PortReplay />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
