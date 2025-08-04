import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/common';
import { Dashboard, Containers, AppStore } from './pages';
import { useWebSocket } from './hooks';

function App() {
  const { connect } = useWebSocket();

  useEffect(() => {
    // Connect to WebSocket on app start
    connect().catch(console.error);
  }, [connect]);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/containers" element={<Containers />} />
          <Route path="/apps" element={<AppStore />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
