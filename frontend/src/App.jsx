import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { apiFetch, clearToken, getToken } from './api.js';
import Register from './pages/Register.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Projects from './pages/Projects.jsx';
import ProjectDetails from './pages/ProjectDetails.jsx';
import Users from './pages/Users.jsx';

import { Button, Badge } from './ui/index.js';

function Protected({ children }) {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function Layout({ me, onLogout, children }) {
  const tenantName = me?.tenant?.name || (me?.role === 'super_admin' ? 'System' : '—');
  const tenantBadgeTone = me?.role === 'super_admin' ? 'in_progress' : 'done';

  return (
    <div className="shell">
      <header className="topbar">
        <div className="container topbarInner">
          <div className="brand">
            <div className="logo" aria-hidden="true" />
            <div>
              <div className="brandTitle">Multi‑Tenant SaaS</div>
              <div className="brandSubtitle">
                <span style={{ marginRight: 10 }}>Signed in as <span className="kbd">{me?.role || 'user'}</span></span>
                <Badge tone={tenantBadgeTone}>{tenantName}</Badge>
              </div>
            </div>
          </div>

          <nav className="nav">
            <NavLink to="/dashboard" className={({ isActive }) => `pill ${isActive ? 'pillActive' : ''}`}>Dashboard</NavLink>
            <NavLink to="/projects" className={({ isActive }) => `pill ${isActive ? 'pillActive' : ''}`}>Projects</NavLink>
            {(me?.role === 'tenant_admin') && (
              <NavLink to="/users" className={({ isActive }) => `pill ${isActive ? 'pillActive' : ''}`}>Users</NavLink>
            )}
            <Button variant="ghost" onClick={onLogout}>Logout</Button>
          </nav>
        </div>
      </header>

      <main className="main">
        <div className="container">{children}</div>
      </main>
    </div>
  );
}

export default function App() {
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const navigate = useNavigate();

  async function loadMe() {
    const token = getToken();
    if (!token) {
      setMe(null);
      setLoadingMe(false);
      return;
    }
    const r = await apiFetch('/auth/me');
    if (!r.ok) {
      clearToken();
      setMe(null);
    } else {
      setMe(r.data.data);
    }
    setLoadingMe(false);
  }

  useEffect(() => { loadMe(); }, []);

  async function onLogout() {
    await apiFetch('/auth/logout', { method: 'POST' });
    clearToken();
    setMe(null);
    navigate('/login');
  }

  if (loadingMe) {
    return (
      <div className="authWrap">
        <div className="authCard" style={{ padding: 18 }}>
          <div className="container" style={{ width: '100%' }}>
            <div className="pageTitle">Loading…</div>
            <p className="pageSubtitle">Warming up the app and checking your session.</p>
          </div>
        </div>
      </div>
    );
  }

  const token = getToken();

  return (
    token ? (
      <Layout me={me} onLogout={onLogout}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard" element={<Protected><Dashboard me={me} /></Protected>} />
          <Route path="/projects" element={<Protected><Projects me={me} /></Protected>} />
          <Route path="/projects/:projectId" element={<Protected><ProjectDetails me={me} /></Protected>} />
          <Route path="/users" element={<Protected><Users me={me} /></Protected>} />

          <Route path="*" element={<div className="cardSoft"><div className="cardInner">Not found</div></div>} />
        </Routes>
      </Layout>
    ) : (
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login onLoggedIn={() => loadMe()} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  );
}
