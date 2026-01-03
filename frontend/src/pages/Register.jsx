import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api.js';
import { Button, Field, Input } from '../ui/index.js';

export default function Register() {
  const [tenantName, setTenantName] = useState('Test Company Alpha');
  const [subdomain, setSubdomain] = useState('testalpha');
  const [adminEmail, setAdminEmail] = useState('admin@testalpha.com');
  const [adminFullName, setAdminFullName] = useState('Alpha Admin');
  const [adminPassword, setAdminPassword] = useState('TestPass@123');
  const [confirmPassword, setConfirmPassword] = useState('TestPass@123');
  const [terms, setTerms] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (adminPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!terms) {
      setError('You must accept Terms & Conditions');
      return;
    }
    setLoading(true);
    const r = await apiFetch('/auth/register-tenant', {
      method: 'POST',
      body: { tenantName, subdomain, adminEmail, adminPassword, adminFullName },
    });
    setLoading(false);
    if (!r.ok) {
      setError(r.data?.message || 'Registration failed');
      return;
    }
    setSuccess('Tenant registered successfully. Redirecting to login…');
    setTimeout(() => navigate('/login'), 1200);
  }

  return (
    <div className="authWrap">
      <div className="authCard">
        <div className="authGrid">
          <div className="authLeft">
            <h1 className="miniTitle">Create your workspace</h1>
            <p className="miniText">
              Start with a tenant admin account. You can invite users and create projects right away.
            </p>
            <div className="footerNote">
              Subdomain becomes your tenant identifier (e.g., <span className="kbd">demo</span>).
            </div>
          </div>

          <div className="authRight">
            <h2 className="pageTitle" style={{ fontSize: 24, margin: 0 }}>Register Tenant</h2>
            <p className="pageSubtitle">Provision a new organization and admin user.</p>

            <form onSubmit={onSubmit} className="grid" style={{ marginTop: 14 }}>
              <Field label="Organization name">
                <Input value={tenantName} onChange={e => setTenantName(e.target.value)} required />
              </Field>
              <Field label="Subdomain" hint={`${subdomain}.yourapp.com`}>
                <Input value={subdomain} onChange={e => setSubdomain(e.target.value)} required />
              </Field>
              <Field label="Admin email">
                <Input value={adminEmail} onChange={e => setAdminEmail(e.target.value)} type="email" autoComplete="email" required />
              </Field>
              <Field label="Admin full name">
                <Input value={adminFullName} onChange={e => setAdminFullName(e.target.value)} required />
              </Field>
              <Field label="Password" hint="Minimum 8 characters">
                <Input value={adminPassword} onChange={e => setAdminPassword(e.target.value)} type="password" required minLength={8} />
              </Field>
              <Field label="Confirm password">
                <Input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password" required minLength={8} />
              </Field>

              <label className="row" style={{ justifyContent: 'space-between' }}>
                <span className="hint">
                  <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} style={{ marginRight: 8 }} />
                  Accept Terms & Conditions
                </span>
              </label>

              {error && <div className="alert alertError">{error}</div>}
              {success && <div className="alert alertSuccess">{success}</div>}

              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="hint">Already have an account? <Link to="/login">Login</Link></span>
                <Button variant="primary" disabled={loading} type="submit">{loading ? 'Creating…' : 'Create Tenant'}</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
