import React, { useState, useEffect } from 'react';
import './App.css';

export function App() {
  const [backendStatus, setBackendStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const checkBackendHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/health`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      setBackendStatus(data);
    } catch (err) {
      setError(err.message || 'Failed to connect to backend');
      setBackendStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  return (
    <div className="app-container">
      <header className="header">
        <h1>AI Ticket Workspace</h1>
        <p>Microservice Scaffolding & Development Environment</p>
        <span className="badge">All Systems Configured</span>
      </header>

      <main>
        <div className="grid">
          {/* Frontend Card */}
          <div className="card">
            <div>
              <div className="card-title">Frontend</div>
              <div className="card-port">Port 3000</div>
              <p className="card-desc">
                React 18 + Vite development server running with cross-platform volume polling.
              </p>
            </div>
            <div className="card-action">
              <span style={{ color: '#4ade80', fontSize: '0.875rem' }}>● Running</span>
            </div>
          </div>

          {/* Backend Card */}
          <div className="card">
            <div>
              <div className="card-title">FastAPI Backend</div>
              <div className="card-port">Port 8000</div>
              <p className="card-desc">
                Python 3.11 FastAPI service with Uvicorn auto-reload and CORS enabled.
              </p>
            </div>
            <div className="card-action">
              <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">
                Swagger Docs →
              </a>
            </div>
          </div>

          {/* PostgreSQL Card */}
          <div className="card">
            <div>
              <div className="card-title">PostgreSQL 16</div>
              <div className="card-port">Port 5432</div>
              <p className="card-desc">
                PostgreSQL 16 Alpine container with persistent named volume <code>postgres_data</code>.
              </p>
            </div>
            <div className="card-action">
              <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Internal / Host Access</span>
            </div>
          </div>

          {/* MailDev Card */}
          <div className="card">
            <div>
              <div className="card-title">MailDev Inspector</div>
              <div className="card-port">Port 1080 (Web) / 1025 (SMTP)</div>
              <p className="card-desc">
                Local SMTP test server catching and inspecting all system transactional emails.
              </p>
            </div>
            <div className="card-action">
              <a href="http://localhost:1080" target="_blank" rel="noreferrer">
                Open MailDev →
              </a>
            </div>
          </div>
        </div>

        {/* Backend API Connectivity Box */}
        <section className="status-box">
          <h3>
            <span>Backend Healthcheck Probe</span>
            <button className="btn" onClick={checkBackendHealth} disabled={loading}>
              {loading ? 'Checking...' : 'Ping API'}
            </button>
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Target endpoint: <code>{apiUrl}/health</code>
          </p>
          {error && (
            <div className="status-result" style={{ color: '#f87171' }}>
              ⚠️ {error} (Ensure backend container is running on port 8000)
            </div>
          )}
          {backendStatus && (
            <pre className="status-result">
              {JSON.stringify(backendStatus, null, 2)}
            </pre>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
