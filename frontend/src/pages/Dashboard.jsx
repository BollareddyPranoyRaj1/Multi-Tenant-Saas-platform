import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api.js';
import { Badge, Button, Card } from '../ui/index.js';

export default function Dashboard({ me }) {
  const [projects, setProjects] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      const p = await apiFetch('/projects?limit=5');
      if (p.ok) setProjects(p.data.data.projects);
      const uid = me?.id;
      if (uid) {
        // grab tasks across projects by iterating projects after fetch (simple demo)
        const all = [];
        for (const proj of (p.ok ? p.data.data.projects : [])) {
          const t = await apiFetch(`/tasks/projects/${proj.id}/tasks?assignedTo=${uid}&limit=20`);
          if (t.ok) all.push(...t.data.data.tasks.map(x => ({ ...x, projectName: proj.name })));
        }
        setMyTasks(all.slice(0, 10));
      }
      setLoading(false);
    })().catch(() => setError('Failed to load dashboard'));
  }, [me?.id]);

  const totalProjects = projects.length;
  const totalTasks = myTasks.length;
  const doneTasks = myTasks.filter(t => t.status === 'done').length;
  const inProgressTasks = myTasks.filter(t => t.status === 'in_progress').length;
  const pendingTasks = totalTasks - doneTasks;

  const greeting = useMemo(() => {
    const name = me?.fullName || me?.email || 'there';
    return `Welcome, ${name}`;
  }, [me?.fullName, me?.email]);

  return (
    <div className="grid">
      <div>
        <h1 className="pageTitle">{greeting}</h1>
        <p className="pageSubtitle">A quick overview of what’s happening in your tenant.</p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Card title="Projects" subtitle="Active workspaces">
          <div className="cardValue">{totalProjects}</div>
          <div className="hint" style={{ marginTop: 8 }}>Create, track, and ship across teams.</div>
        </Card>
        <Card title="My tasks" subtitle="Assigned to you">
          <div className="cardValue">{totalTasks}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <Badge tone="in_progress">In progress: {inProgressTasks}</Badge>
            <Badge tone="done">Done: {doneTasks}</Badge>
          </div>
        </Card>
        <Card title="Pending" subtitle="Not done yet">
          <div className="cardValue">{pendingTasks}</div>
          <div className="hint" style={{ marginTop: 8 }}>Keep the momentum going.</div>
        </Card>
      </div>

      {error && <div className="alert alertError">{error}</div>}

      <div className="grid2">
        <section className="cardSoft">
          <div className="cardInner">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="brandTitle" style={{ fontSize: 18 }}>Recent projects</div>
                <div className="hint">Jump back into active work.</div>
              </div>
              <Button as={Link} to="/projects" variant="ghost">View all</Button>
            </div>

            <div className="grid" style={{ marginTop: 12 }}>
              {loading ? (
                <div className="hint">Loading projects…</div>
              ) : projects.length ? (
                projects.map(p => (
                  <div key={p.id} className="row" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 850 }}>{p.name}</div>
                      <div className="hint">Tasks: {p.taskCount} • Done: {p.completedTaskCount}</div>
                    </div>
                    <Button as={Link} to={`/projects/${p.id}`} variant="secondary">Open</Button>
                  </div>
                ))
              ) : (
                <div className="hint">No projects yet — create one to get started.</div>
              )}
            </div>
          </div>
        </section>

        <section className="cardSoft">
          <div className="cardInner">
            <div className="brandTitle" style={{ fontSize: 18 }}>My tasks</div>
            <div className="hint">Top 10 tasks assigned to you.</div>

            <div className="grid" style={{ marginTop: 12 }}>
              {loading ? (
                <div className="hint">Loading tasks…</div>
              ) : myTasks.length ? (
                myTasks.map(t => (
                  <div key={t.id} className="row" style={{ justifyContent: 'space-between' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                      <div className="hint">{t.projectName} • Priority: {t.priority}</div>
                    </div>
                    <Badge tone={t.status}>{t.status}</Badge>
                  </div>
                ))
              ) : (
                <div className="hint">No assigned tasks found.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
