import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api.js';
import { Badge, Button, Card, Field, Input, Textarea } from '../ui/index.js';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await apiFetch('/projects?limit=50');
    if (r.ok) setProjects(r.data.data.projects);
    else setError(r.data?.message || 'Failed to load projects');
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createProject(e) {
    e.preventDefault();
    setError('');
    const r = await apiFetch('/projects', { method: 'POST', body: { name, description } });
    if (!r.ok) { setError(r.data?.message || 'Create failed'); return; }
    setName(''); setDescription('');
    await load();
  }

  async function deleteProject(id) {
    if (!confirm('Delete project?')) return;
    const r = await apiFetch(`/projects/${id}`, { method: 'DELETE' });
    if (!r.ok) { setError(r.data?.message || 'Delete failed'); return; }
    await load();
  }

  return (
    <div className="grid">
      <div>
        <h1 className="pageTitle">Projects</h1>
        <p className="pageSubtitle">Create projects, track progress, and manage tasks.</p>
      </div>

      <div className="grid2">
        <Card
          title="Project list"
          subtitle={loading ? 'Loading…' : `${projects.length} project(s)`}
          actions={<Button as={Link} to="/dashboard" variant="ghost">Back to dashboard</Button>}
        >
          {error && <div className="alert alertError" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="grid">
            {loading ? (
              <div className="hint">Fetching projects…</div>
            ) : projects.length ? (
              projects.map(p => (
                <div key={p.id} className="cardSoft">
                  <div className="cardInner">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div className="hint" style={{ marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description || '—'}</div>
                        <div className="row" style={{ marginTop: 10 }}>
                          <Badge tone={p.completedTaskCount > 0 ? 'done' : 'todo'}>
                            Done: {p.completedTaskCount}
                          </Badge>
                          <span className="badge">Tasks: {p.taskCount}</span>
                          <span className="badge">Status: {p.status}</span>
                        </div>
                      </div>

                      <div className="row">
                        <Button as={Link} to={`/projects/${p.id}`} variant="secondary">Open</Button>
                        <Button variant="danger" onClick={() => deleteProject(p.id)}>Delete</Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="hint">No projects yet — create one on the right.</div>
            )}
          </div>
        </Card>

        <Card title="Create project" subtitle="Organize work into a new project space">
          <form onSubmit={createProject} className="grid">
            <Field label="Project name">
              <Input placeholder="e.g., Website refresh" value={name} onChange={e => setName(e.target.value)} required />
            </Field>
            <Field label="Description" hint="Optional but recommended">
              <Textarea placeholder="Short description of the project" value={description} onChange={e => setDescription(e.target.value)} />
            </Field>
            <Button variant="primary" type="submit">Create project</Button>
            <div className="hint">Tip: You can add tasks inside the project after creation.</div>
          </form>
        </Card>
      </div>
    </div>
  );
}
