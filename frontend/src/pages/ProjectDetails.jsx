import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../api.js';
import { Badge, Button, Card, Field, Input, Textarea } from '../ui/index.js';

export default function ProjectDetails() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  async function load() {
    setError('');
    setLoading(true);
    // backend doesn't have GET /api/projects/:id in spec; project details can be derived from list
    const p = await apiFetch('/projects?limit=100');
    if (p.ok) {
      const found = p.data.data.projects.find(x => x.id === projectId);
      setProject(found || null);
    }
    const t = await apiFetch(`/tasks/projects/${projectId}/tasks?limit=100`);
    if (t.ok) setTasks(t.data.data.tasks);
    setLoading(false);
  }

  useEffect(() => { load().catch(() => setError('Failed to load')); }, [projectId]);

  async function createTask(e) {
    e.preventDefault();
    const r = await apiFetch(`/tasks/projects/${projectId}/tasks`, { method: 'POST', body: { title: newTitle, description: newDesc } });
    if (!r.ok) { setError(r.data?.message || 'Create task failed'); return; }
    setNewTitle(''); setNewDesc('');
    await load();
  }

  async function setStatus(taskId, status) {
    const r = await apiFetch(`/tasks/${taskId}/status`, { method: 'PATCH', body: { status } });
    if (!r.ok) { setError(r.data?.message || 'Update status failed'); return; }
    await load();
  }

  function statusTone(status) {
    if (status === 'todo') return 'todo';
    if (status === 'in_progress') return 'in_progress';
    if (status === 'done') return 'done';
    if (status === 'cancelled') return 'cancelled';
    return 'neutral';
  }

  return (
    <div className="grid">
      <div>
        <h1 className="pageTitle">Project</h1>
        <p className="pageSubtitle">Manage tasks, status, and progress.</p>
      </div>

      {error && <div className="alert alertError">{error}</div>}

      <div className="grid2">
        <Card
          title={project?.name || 'Project details'}
          subtitle={project?.description || (loading ? 'Loading…' : 'Project not found in list (tasks may still load)')}
          actions={project?.status ? <span className="badge">Status: {project.status}</span> : null}
        >
          <div className="grid" style={{ gap: 10 }}>
            {loading ? <div className="hint">Loading tasks…</div> : null}
            {!loading && !tasks.length ? <div className="hint">No tasks yet — create one on the right.</div> : null}

            {tasks.map(t => (
              <div key={t.id} className="cardSoft">
                <div className="cardInner">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                      <div className="hint" style={{ marginTop: 4 }}>
                        Priority: {t.priority} • Due: {t.dueDate || '—'}
                      </div>
                      {t.description ? <div className="hint" style={{ marginTop: 8 }}>{t.description}</div> : null}
                    </div>
                    <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                  </div>

                  <div className="row" style={{ marginTop: 12 }}>
                    <Button variant="ghost" onClick={() => setStatus(t.id, 'todo')}>Todo</Button>
                    <Button variant="ghost" onClick={() => setStatus(t.id, 'in_progress')}>In progress</Button>
                    <Button variant="ghost" onClick={() => setStatus(t.id, 'done')}>Done</Button>
                    <Button variant="ghost" onClick={() => setStatus(t.id, 'cancelled')}>Cancel</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Add task" subtitle="Create a new task in this project">
          <form onSubmit={createTask} className="grid">
            <Field label="Title">
              <Input placeholder="e.g., Finalize UI" value={newTitle} onChange={e => setNewTitle(e.target.value)} required />
            </Field>
            <Field label="Description" hint="Optional">
              <Textarea placeholder="What needs to be done?" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            </Field>
            <Button variant="primary" type="submit">Create task</Button>
            <div className="hint">Status defaults to <span className="kbd">todo</span>.</div>
          </form>
        </Card>
      </div>
    </div>
  );
}
