import express from 'express';
import { query } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { authRequired } from '../middleware/auth.js';
import { requireRole, belongsToTenantOrSuper } from '../middleware/authorize.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

router.get('/:tenantId', authRequired, belongsToTenantOrSuper, async(req, res) => {
    const { tenantId } = req.params;
    try {
        const t = await query('SELECT * FROM tenants WHERE id=$1', [tenantId]);
        if (!t.rowCount) return res.status(404).json(fail('Tenant not found'));
        const statsUsers = await query('SELECT COUNT(*)::int AS count FROM users WHERE tenant_id=$1', [tenantId]);
        const statsProjects = await query('SELECT COUNT(*)::int AS count FROM projects WHERE tenant_id=$1', [tenantId]);
        const statsTasks = await query('SELECT COUNT(*)::int AS count FROM tasks WHERE tenant_id=$1', [tenantId]);
        const tenant = t.rows[0];
        return res.json(ok({
            id: tenant.id,
            name: tenant.name,
            subdomain: tenant.subdomain,
            status: tenant.status,
            subscriptionPlan: tenant.subscription_plan,
            maxUsers: tenant.max_users,
            maxProjects: tenant.max_projects,
            createdAt: tenant.created_at,
            stats: {
                totalUsers: statsUsers.rows[0].count,
                totalProjects: statsProjects.rows[0].count,
                totalTasks: statsTasks.rows[0].count
            }
        }));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

router.put('/:tenantId', authRequired, async(req, res) => {
    const { role, tenantId: authTenantId } = req.auth;
    const { tenantId } = req.params;
    const { name, status, subscriptionPlan, maxUsers, maxProjects } = req.body;

    if (role !== 'super_admin' && tenantId !== authTenantId) return res.status(403).json(fail('Forbidden'));

    try {
        const t = await query('SELECT * FROM tenants WHERE id=$1', [tenantId]);
        if (!t.rowCount) return res.status(404).json(fail('Tenant not found'));

        let fields = [];
        let values = [];
        let idx = 1;

        if (name) { fields.push(`name=$${idx++}`);
            values.push(name); }

        if (role === 'super_admin') {
            if (status) { fields.push(`status=$${idx++}`);
                values.push(status); }
            if (subscriptionPlan) { fields.push(`subscription_plan=$${idx++}`);
                values.push(subscriptionPlan); }
            if (maxUsers !== undefined) { fields.push(`max_users=$${idx++}`);
                values.push(maxUsers); }
            if (maxProjects !== undefined) { fields.push(`max_projects=$${idx++}`);
                values.push(maxProjects); }
        } else {
            if (status || subscriptionPlan || maxUsers !== undefined || maxProjects !== undefined) {
                return res.status(403).json(fail('Forbidden'));
            }
        }

        if (!fields.length) return res.status(400).json(fail('No fields to update'));

        values.push(tenantId);
        const sql = `UPDATE tenants SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${idx} RETURNING id, name, updated_at`;
        const u = await query(sql, values);

        await logAudit({ tenantId, userId: req.auth.userId, action: 'UPDATE_TENANT', entityType: 'tenant', entityId: tenantId, ipAddress: req.ip });

        return res.json(ok(u.rows[0], 'Tenant updated successfully'));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

router.get('/', authRequired, requireRole('super_admin'), async(req, res) => {
    let { page = 1, limit = 10, status, subscriptionPlan } = req.query;
    page = parseInt(page, 10);
    limit = Math.min(100, parseInt(limit, 10));
    const offset = (page - 1) * limit;
    try {
        const where = [];
        const params = [];
        let idx = 1;
        if (status) { where.push(`status=$${idx++}`);
            params.push(status); }
        if (subscriptionPlan) { where.push(`subscription_plan=$${idx++}`);
            params.push(subscriptionPlan); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const rows = await query(`SELECT * FROM tenants ${whereSql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, params);
        const count = await query(`SELECT COUNT(*)::int AS count FROM tenants ${whereSql}`, params);

        const tenants = [];
        for (const t of rows.rows) {
            const totalUsers = await query('SELECT COUNT(*)::int AS c FROM users WHERE tenant_id=$1', [t.id]);
            const totalProjects = await query('SELECT COUNT(*)::int AS c FROM projects WHERE tenant_id=$1', [t.id]);
            tenants.push({
                id: t.id,
                name: t.name,
                subdomain: t.subdomain,
                status: t.status,
                subscriptionPlan: t.subscription_plan,
                totalUsers: totalUsers.rows[0].c,
                totalProjects: totalProjects.rows[0].c,
                createdAt: t.created_at,
            });
        }

        return res.json(ok({
            tenants,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(count.rows[0].count / limit),
                totalTenants: count.rows[0].count,
                limit
            }
        }));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

export default router;