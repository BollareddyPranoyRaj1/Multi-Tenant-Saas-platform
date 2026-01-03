import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch, setToken } from '../api.js';
import { Button, Field, Input } from '../ui/index.js';

export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState('admin@demo.com');
  const [password, setPassword] = useState('Demo@123');
  const [tenantSubdomain, setTenantSubdomain] = useState('demo');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const r = await apiFetch('/auth/login', {
      method: 'POST',
      body: { email, password, tenantSubdomain },
    });
    setLoading(false);
    if (!r.ok) {
      setError(r.data?.message || 'Login failed');
      return;
    }
    setToken(r.data.data.token);
    await onLoggedIn?.();
    navigate('/dashboard');
  }

  return (
    <div className="authWrap">
      <div className="authCard">
        <div className="authGrid">
          <div className="authLeft">
            <h1 className="miniTitle">Welcome back</h1>
            <p className="miniText">
              Sign in to manage users, projects, and tasks — securely isolated per tenant.
            </p>
            <div className="footerNote">
              Tip: Use <span className="kbd">demo</span> with <span className="kbd">admin@demo.com</span>.
            </div>
          </div>

          <div className="authRight">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h2 className="pageTitle" style={{ fontSize: 24, margin: 0 }}>Login</h2>
                <p className="pageSubtitle">Enter your credentials to continue.</p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="grid" style={{ marginTop: 14 }}>
              <Field label="Email">
                <Input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" required />
              </Field>
              <Field label="Password">
                <Input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" required />
              </Field>
              <Field label="Tenant subdomain" hint="Example: demo">
                <Input value={tenantSubdomain} onChange={e => setTenantSubdomain(e.target.value)} required />
              </Field>

              {error && <div className="alert alertError">{error}</div>}

              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="hint">Don’t have an account? <Link to="/register">Register tenant</Link></span>
                <Button variant="primary" disabled={loading} type="submit">{loading ? 'Logging in…' : 'Login'}</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
