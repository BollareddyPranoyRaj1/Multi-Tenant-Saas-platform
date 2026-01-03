import express from 'express';
import { query } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { authRequired } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

router.post('/', authRequired, async(req, res) => {
    const { name, description, status = 'active' } = req.body;
    const { tenantId, userId } = req.auth;
    if (req.auth.role === 'super_admin') return res.status(403).json(fail('Forbidden'));
    if (!name) return res.status(400).json(fail('Validation errors'));
    try {
        const t = await query('SELECT max_projects FROM tenants WHERE id=$1', [tenantId]);
        if (!t.rowCount) return res.status(404).json(fail('Tenant not found'));
        const maxProjects = t.rows[0].max_projects;
        const c = await query('SELECT COUNT(*)::int AS c FROM projects WHERE tenant_id=$1', [tenantId]);
        if (c.rows[0].c >= maxProjects) return res.status(403).json(fail('Project limit reached'));

        const p = await query(
            `INSERT INTO projects (id, tenant_id, name, description, status, created_by, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, tenant_id, name, description, status, created_by, created_at`, [tenantId, name, description || null, status, userId]
        );

        await logAudit({ tenantId, userId, action: 'CREATE_PROJECT', entityType: 'project', entityId: p.rows[0].id, ipAddress: req.ip });

        return res.status(201).json(ok(p.rows[0]));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

router.get('/', authRequired, async(req, res) => {
    const { tenantId } = req.auth;
    const { status, search, page = 1, limit = 20 } = req.query;
    if (req.auth.role === 'super_admin') return res.status(403).json(fail('Forbidden'));
    try {
        const l = Math.min(100, parseInt(limit, 10));
        const pg = parseInt(page, 10);
        const offset = (pg - 1) * l;

        let where = 'WHERE p.tenant_id=$1';
        const params = [tenantId];
        let idx = 2;
        if (status) {
            where += ` AND p.status=$${idx}`;
            params.push(status);
            idx++;
        }
        if (search) {
            where += ` AND LOWER(p.name) LIKE $${idx}`;
            params.push('%' + search.toLowerCase() + '%');
            idx++;
        }

        const rows = await query(
            `SELECT p.id, p.name, p.description, p.status, p.created_at, u.id as creator_id, u.full_name as creator_name,
              COALESCE(tc.count,0) as task_count, COALESCE(cc.count,0) as completed_task_count
       FROM projects p
       JOIN users u ON u.id=p.created_by
       LEFT JOIN (
         SELECT project_id, COUNT(*)::int as count FROM tasks GROUP BY project_id
       ) tc ON tc.project_id=p.id
       LEFT JOIN (
                 SELECT project_id, COUNT(*)::int as count FROM tasks WHERE status='done' GROUP BY project_id
       ) cc ON cc.project_id=p.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ${l} OFFSET ${offset}`,
            params
        );

        const count = await query(`SELECT COUNT(*)::int AS c FROM projects p ${where}`, params);

        const projects = rows.rows.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            status: r.status,
            createdBy: { id: r.creator_id, fullName: r.creator_name },
            taskCount: r.task_count,
            completedTaskCount: r.completed_task_count,
            createdAt: r.created_at,
        }));

        return res.json(ok({ projects, total: count.rows[0].c, pagination: { currentPage: pg, totalPages: Math.ceil(count.rows[0].c / l), limit: l } }));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

router.put('/:projectId', authRequired, async(req, res) => {
    const { projectId } = req.params;
    const { name, description, status } = req.body;
    if (req.auth.role === 'super_admin') return res.status(403).json(fail('Forbidden'));
    try {
        const p = await query('SELECT * FROM projects WHERE id=$1', [projectId]);
        if (!p.rowCount) return res.status(404).json(fail('Project not found'));
        const proj = p.rows[0];
        if (req.auth.tenantId !== proj.tenant_id) return res.status(403).json(fail('Forbidden'));
        if (req.auth.role !== 'tenant_admin' && req.auth.userId !== proj.created_by) return res.status(403).json(fail('Not authorized'));

        let fields = [];
        let values = [];
        let idx = 1;
        if (name) {
            fields.push(`name=$${idx++}`);
            values.push(name);
        }
        if (description !== undefined) {
            fields.push(`description=$${idx++}`);
            values.push(description || null);
        }
        if (status) {
            fields.push(`status=$${idx++}`);
            values.push(status);
        }

        if (!fields.length) return res.status(400).json(fail('No fields to update'));

        values.push(projectId);
        const u = await query(`UPDATE projects SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${idx} RETURNING id, name, description, status, updated_at`, values);

        await logAudit({ tenantId: proj.tenant_id, userId: req.auth.userId, action: 'UPDATE_PROJECT', entityType: 'project', entityId: projectId, ipAddress: req.ip });

        return res.json(ok(u.rows[0], 'Project updated successfully'));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

router.delete('/:projectId', authRequired, async(req, res) => {
    const { projectId } = req.params;
    if (req.auth.role === 'super_admin') return res.status(403).json(fail('Forbidden'));
    try {
        const p = await query('SELECT * FROM projects WHERE id=$1', [projectId]);
        if (!p.rowCount) return res.status(404).json(fail('Project not found'));
        const proj = p.rows[0];
        if (req.auth.tenantId !== proj.tenant_id) return res.status(403).json(fail('Forbidden'));
        if (req.auth.role !== 'tenant_admin' && req.auth.userId !== proj.created_by) return res.status(403).json(fail('Not authorized'));

        // cascade tasks by FK; but ensure order
        await query('DELETE FROM tasks WHERE project_id=$1', [projectId]);
        await query('DELETE FROM projects WHERE id=$1', [projectId]);

        await logAudit({ tenantId: proj.tenant_id, userId: req.auth.userId, action: 'DELETE_PROJECT', entityType: 'project', entityId: projectId, ipAddress: req.ip });

        return res.json(ok(null, 'Project deleted successfully'));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

export default router;