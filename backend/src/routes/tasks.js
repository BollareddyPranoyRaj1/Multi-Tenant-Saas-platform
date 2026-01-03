import express from 'express';
import { query } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { authRequired } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

const ALLOWED_TASK_STATUS = new Set(['todo', 'in_progress', 'done', 'cancelled']);
const ALLOWED_TASK_PRIORITY = new Set(['low', 'medium', 'high', 'urgent']);

function normalizeDateOnly(input) {
    if (input === undefined) return { hasValue: false };
    if (input === null || input === '') return { hasValue: true, value: null };

    if (typeof input !== 'string') return { hasValue: true, error: 'dueDate must be a string (YYYY-MM-DD) or null' };
    const s = input.trim();
    if (!s) return { hasValue: true, value: null };

    // If already YYYY-MM-DD, keep it.
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { hasValue: true, value: s };

    // Otherwise try parsing and converting to UTC date-only.
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return { hasValue: true, error: 'dueDate is not a valid date' };

    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return { hasValue: true, value: `${yyyy}-${mm}-${dd}` };
}

router.post('/projects/:projectId/tasks', authRequired, async(req, res) => {
    const { projectId } = req.params;
    const { title, description, assignedTo, priority = 'medium', dueDate } = req.body;
    if (req.auth.role === 'super_admin') return res.status(403).json(fail('Forbidden'));
    if (!title) return res.status(400).json(fail('Validation errors'));
    if (!ALLOWED_TASK_PRIORITY.has(priority)) return res.status(400).json(fail('Invalid priority'));

    const due = normalizeDateOnly(dueDate);
    if (due.hasValue && due.error) return res.status(400).json(fail(due.error));
    try {
        const p = await query('SELECT * FROM projects WHERE id=$1', [projectId]);
        if (!p.rowCount) return res.status(404).json(fail('Project not found'));
        const proj = p.rows[0];
        if (req.auth.tenantId !== proj.tenant_id) return res.status(403).json(fail('Project does not belong to tenant'));

        if (assignedTo) {
            const u = await query('SELECT 1 FROM users WHERE id=$1 AND tenant_id=$2', [assignedTo, proj.tenant_id]);
            if (!u.rowCount) return res.status(400).json(fail('assignedTo user invalid'));
        }

        const t = await query(
            `INSERT INTO tasks (id, project_id, tenant_id, title, description, status, priority, assigned_to, due_date, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'todo', $5, $6, $7, NOW(), NOW())
       RETURNING id, project_id, tenant_id, title, description, status, priority, assigned_to, due_date, created_at`, [projectId, proj.tenant_id, title, description || null, priority, assignedTo || null, (due.hasValue ? due.value : null)]
        );

        await logAudit({ tenantId: proj.tenant_id, userId: req.auth.userId, action: 'CREATE_TASK', entityType: 'task', entityId: t.rows[0].id, ipAddress: req.ip });

        return res.status(201).json(ok(t.rows[0]));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

router.get('/projects/:projectId/tasks', authRequired, async(req, res) => {
    const { projectId } = req.params;
    const { status, assignedTo, priority, search, page = 1, limit = 50 } = req.query;
    if (req.auth.role === 'super_admin') return res.status(403).json(fail('Forbidden'));
    if (status && !ALLOWED_TASK_STATUS.has(status)) return res.status(400).json(fail('Invalid status'));
    if (priority && !ALLOWED_TASK_PRIORITY.has(priority)) return res.status(400).json(fail('Invalid priority'));
    try {
        const p = await query('SELECT * FROM projects WHERE id=$1', [projectId]);
        if (!p.rowCount) return res.status(404).json(fail('Project not found'));
        const proj = p.rows[0];
        if (req.auth.tenantId !== proj.tenant_id) return res.status(403).json(fail('Forbidden'));

        const l = Math.min(100, parseInt(limit, 10));
        const pg = parseInt(page, 10);
        const offset = (pg - 1) * l;

        let where = 'WHERE t.project_id=$1';
        const params = [projectId];
        let idx = 2;
        if (status) {
            where += ` AND t.status=$${idx}`;
            params.push(status);
            idx++;
        }
        if (assignedTo) {
            where += ` AND t.assigned_to=$${idx}`;
            params.push(assignedTo);
            idx++;
        }
        if (priority) {
            where += ` AND t.priority=$${idx}`;
            params.push(priority);
            idx++;
        }
        if (search) {
            where += ` AND LOWER(t.title) LIKE $${idx}`;
            params.push('%' + search.toLowerCase() + '%');
            idx++;
        }

        const rows = await query(
            `SELECT t.id, t.title, t.description, t.status, t.priority, t.assigned_to, t.due_date, t.created_at,
              u.id as assigned_id, u.full_name as assigned_name, u.email as assigned_email
       FROM tasks t
       LEFT JOIN users u ON u.id=t.assigned_to
       ${where}
       ORDER BY CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC, t.due_date ASC NULLS LAST
       LIMIT ${l} OFFSET ${offset}`,
            params
        );

        const count = await query(`SELECT COUNT(*)::int AS c FROM tasks t ${where}`, params);

        const tasks = rows.rows.map(r => ({
            id: r.id,
            title: r.title,
            description: r.description,
            status: r.status,
            priority: r.priority,
            assignedTo: r.assigned_id ? { id: r.assigned_id, fullName: r.assigned_name, email: r.assigned_email } : null,
            dueDate: r.due_date,
            createdAt: r.created_at,
        }));

        return res.json(ok({ tasks, total: count.rows[0].c, pagination: { currentPage: pg, totalPages: Math.ceil(count.rows[0].c / l), limit: l } }));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

router.patch('/:taskId/status', authRequired, async(req, res) => {
    const { taskId } = req.params;
    const { status } = req.body;
    if (req.auth.role === 'super_admin') return res.status(403).json(fail('Forbidden'));
    if (!status) return res.status(400).json(fail('Validation errors'));
    if (!ALLOWED_TASK_STATUS.has(status)) return res.status(400).json(fail('Invalid status'));
    try {
        const t = await query('SELECT * FROM tasks WHERE id=$1', [taskId]);
        if (!t.rowCount) return res.status(404).json(fail('Task not found'));
        const task = t.rows[0];
        if (req.auth.tenantId !== task.tenant_id) return res.status(403).json(fail('Forbidden'));

        const u = await query('UPDATE tasks SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, status, updated_at', [status, taskId]);

        return res.json(ok(u.rows[0]));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

router.put('/:taskId', authRequired, async(req, res) => {
    const { taskId } = req.params;
    const { title, description, status, priority, assignedTo, dueDate } = req.body;
    if (req.auth.role === 'super_admin') return res.status(403).json(fail('Forbidden'));
    if (status && !ALLOWED_TASK_STATUS.has(status)) return res.status(400).json(fail('Invalid status'));
    if (priority && !ALLOWED_TASK_PRIORITY.has(priority)) return res.status(400).json(fail('Invalid priority'));

    const due = normalizeDateOnly(dueDate);
    if (due.hasValue && due.error) return res.status(400).json(fail(due.error));
    try {
        const tRes = await query('SELECT * FROM tasks WHERE id=$1', [taskId]);
        if (!tRes.rowCount) return res.status(404).json(fail('Task not found'));
        const task = tRes.rows[0];
        if (req.auth.tenantId !== task.tenant_id) return res.status(403).json(fail('Forbidden'));

        if (assignedTo !== undefined && assignedTo !== null) {
            const u = await query('SELECT 1 FROM users WHERE id=$1 AND tenant_id=$2', [assignedTo, task.tenant_id]);
            if (!u.rowCount) return res.status(400).json(fail('assignedTo user invalid'));
        }

        let fields = [];
        let values = [];
        let idx = 1;
        if (title) {
            fields.push(`title=$${idx++}`);
            values.push(title);
        }
        if (description !== undefined) {
            fields.push(`description=$${idx++}`);
            values.push(description || null);
        }
        if (status) {
            fields.push(`status=$${idx++}`);
            values.push(status);
        }
        if (priority) {
            fields.push(`priority=$${idx++}`);
            values.push(priority);
        }
        if (assignedTo !== undefined) {
            fields.push(`assigned_to=$${idx++}`);
            values.push(assignedTo || null);
        }
        if (due.hasValue) {
            fields.push(`due_date=$${idx++}`);
            values.push(due.value);
        }
        if (!fields.length) return res.status(400).json(fail('No fields to update'));

        values.push(taskId);
        const u = await query(`UPDATE tasks SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${idx} RETURNING id, title, description, status, priority, assigned_to, due_date, updated_at`, values);

        const updated = u.rows[0];
        let assignedUser = null;
        if (updated.assigned_to) {
            const au = await query('SELECT id, full_name, email FROM users WHERE id=$1', [updated.assigned_to]);
            assignedUser = au.rowCount ? au.rows[0] : null;
        }

        await logAudit({ tenantId: task.tenant_id, userId: req.auth.userId, action: 'UPDATE_TASK', entityType: 'task', entityId: taskId, ipAddress: req.ip });

        return res.json(ok({
            id: updated.id,
            title: updated.title,
            description: updated.description,
            status: updated.status,
            priority: updated.priority,
            assignedTo: assignedUser,
            dueDate: updated.due_date,
            updatedAt: updated.updated_at,
        }, 'Task updated successfully'));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

export default router;