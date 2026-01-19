import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Forecast } from './pages/Forecast';
import { Scenarios } from './pages/Scenarios';
import { ScenarioComparison } from './pages/ScenarioComparison';
import { Import } from './pages/Import';
import { Overrides } from './pages/Overrides';
import { Assignments } from './pages/Assignments';
import { MasterSkus } from './pages/masters/Skus';
import { MasterChannelSkus } from './pages/masters/ChannelSkus';
import { MasterVariables } from './pages/masters/Variables';
import { Audit } from './pages/Audit';
import { Analysis } from './pages/Analysis';
import { Settings } from './pages/Settings';
import { initializeData } from './storage';

function App() {
  useEffect(() => {
    // Initialize DB on load
    initializeData();
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes wrapped in persistent Layout */}
        <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/scenarios" element={<Scenarios />} />
            <Route path="/scenarios/compare" element={<ScenarioComparison />} />
            <Route path="/assignments" element={<Assignments />} />
            <Route path="/overrides" element={<Overrides />} />
            <Route path="/import" element={<Import />} />
            
            {/* Masters Routes */}
            <Route path="/masters/skus" element={<MasterSkus />} />
            <Route path="/masters/channel-sku" element={<MasterChannelSkus />} />
            <Route path="/masters/variables" element={<MasterVariables />} />
            
            {/* Audit */}
            <Route path="/audit" element={<Audit />} />

            {/* Analysis */}
            <Route path="/analysis" element={<Analysis />} />

            {/* Settings */}
            <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;