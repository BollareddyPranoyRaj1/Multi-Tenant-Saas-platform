import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';
import { Button, Card, Field, Input, Select } from '../ui/index.js';

export default function Users({ me }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState('newuser@demo.com');
  const [password, setPassword] = useState('NewUser@123');
  const [fullName, setFullName] = useState('New User');
  const [role, setRole] = useState('user');

  async function load() {
    if (!me?.tenant?.id) return;
    setLoading(true);
    const r = await apiFetch(`/users/${me.tenant.id}/users?limit=100`);
    if (r.ok) setUsers(r.data.data.users);
    else setError(r.data?.message || 'Failed to load users');
    setLoading(false);
  }

  useEffect(() => { load(); }, [me?.tenant?.id]);

  async function addUser(e) {
    e.preventDefault();
    setError('');
    const r = await apiFetch(`/users/${me.tenant.id}/users`, { method: 'POST', body: { email, password, fullName, role } });
    if (!r.ok) { setError(r.data?.message || 'Create user failed'); return; }
    setPassword('NewUser@123');
    await load();
  }

  async function deleteUser(id) {
    if (!confirm('Delete user?')) return;
    const r = await apiFetch(`/users/${id}`, { method: 'DELETE' });
    if (!r.ok) { setError(r.data?.message || 'Delete failed'); return; }
    await load();
  }

  if (me?.role !== 'tenant_admin') {
    return (
      <div className="grid">
        <div>
          <h1 className="pageTitle">Users</h1>
          <p className="pageSubtitle">Manage people in your tenant.</p>
        </div>
        <div className="alert alertError">Forbidden: tenant admin only.</div>
      </div>
    );
  }

  return (
    <div className="grid">
      <div>
        <h1 className="pageTitle">Users</h1>
        <p className="pageSubtitle">Invite teammates and manage roles inside your tenant.</p>
      </div>

      {error && <div className="alert alertError">{error}</div>}

      <div className="grid2">
        <Card
          title="Team"
          subtitle={me?.tenant?.name ? `Tenant: ${me.tenant.name}` : 'Users in your tenant'}
          actions={<span className="badge">Total: {users.length}</span>}
        >
          {loading ? (
            <div className="hint">Loading users…</div>
          ) : !users.length ? (
            <div className="hint">No users yet. Create the first one on the right.</div>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Full name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.full_name || u.fullName}</td>
                      <td>{u.email}</td>
                      <td><span className="badge">{u.role}</span></td>
                      <td>
                        <Button variant="danger" onClick={() => deleteUser(u.id)}>Delete</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Add user" subtitle="Creates a login for this tenant">
          <form onSubmit={addUser} className="grid">
            <Field label="Email">
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="newuser@demo.com" required />
            </Field>
            <Field label="Full name">
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="New User" required />
            </Field>
            <Field label="Password" hint="Minimum 8 characters">
              <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="NewUser@123" type="password" required minLength={8} />
            </Field>
            <Field label="Role">
              <Select value={role} onChange={e => setRole(e.target.value)}>
                <option value="user">user</option>
                <option value="tenant_admin">tenant_admin</option>
              </Select>
            </Field>
            <Button variant="primary" type="submit">Create user</Button>
            <div className="hint">Tip: keep tenant admins to a minimum.</div>
          </form>
        </Card>
      </div>
    </div>
  );
}
