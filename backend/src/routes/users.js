import express from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

const ALLOWED_USER_ROLES = new Set(['user', 'tenant_admin']);

router.post('/:tenantId/users', authRequired, requireRole('tenant_admin'), async(req, res) => {
    const { tenantId } = req.params;
    const { email, password, fullName, role = 'user' } = req.body;
    if (!email || !password || !fullName) return res.status(400).json(fail('Validation errors'));
    if (!ALLOWED_USER_ROLES.has(role)) return res.status(400).json(fail('Invalid role'));
    try {
        // Check auth user belongs to tenant
        if (req.auth.role !== 'super_admin' && req.auth.tenantId !== tenantId) return res.status(403).json(fail('Forbidden'));

        // Check limits
        const tRes = await query('SELECT max_users FROM tenants WHERE id=$1', [tenantId]);
        if (!tRes.rowCount) return res.status(404).json(fail('Tenant not found'));
        const maxUsers = tRes.rows[0].max_users;
        const countRes = await query('SELECT COUNT(*)::int AS c FROM users WHERE tenant_id=$1', [tenantId]);
        if (countRes.rows[0].c >= maxUsers) return res.status(403).json(fail('Subscription limit reached'));

        const exists = await query('SELECT 1 FROM users WHERE tenant_id=$1 AND email=$2', [tenantId, email]);
        if (exists.rowCount) return res.status(409).json(fail('Email already exists in this tenant'));

        const pwHash = await bcrypt.hash(password, 10);
        const u = await query(
            `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
       RETURNING id, email, full_name, role, tenant_id, is_active, created_at`, [tenantId, email, pwHash, fullName, role]
        );

        await logAudit({ tenantId, userId: req.auth.userId, action: 'CREATE_USER', entityType: 'user', entityId: u.rows[0].id, ipAddress: req.ip });

        return res.status(201).json(ok(u.rows[0], 'User created successfully'));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

router.get('/:tenantId/users', authRequired, async(req, res) => {
    const { tenantId } = req.params;
    const { search, role, page = 1, limit = 50 } = req.query;
    try {
        if (req.auth.role !== 'super_admin' && req.auth.tenantId !== tenantId) return res.status(403).json(fail('Forbidden'));
        const p = [];
        let idx = 1;
        let where = 'WHERE tenant_id=$' + idx;
        p.push(tenantId);
        idx++;
        if (role) {
            where += ` AND role=$${idx}`;
            p.push(role);
            idx++;
        }
        if (search) {
            where += ` AND (LOWER(email) LIKE $${idx} OR LOWER(full_name) LIKE $${idx})`;
            p.push('%' + search.toLowerCase() + '%');
            idx++;
        }

        const l = Math.min(100, parseInt(limit, 10));
        const pg = parseInt(page, 10);
        const offset = (pg - 1) * l;

        const rows = await query(`SELECT id, email, full_name, role, is_active, created_at FROM users ${where} ORDER BY created_at DESC LIMIT ${l} OFFSET ${offset}`, p);
        const count = await query(`SELECT COUNT(*)::int AS c FROM users ${where}`, p);

        return res.json(ok({ users: rows.rows, total: count.rows[0].c, pagination: { currentPage: pg, totalPages: Math.ceil(count.rows[0].c / l), limit: l } }));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

router.put('/:userId', authRequired, async(req, res) => {
    const { userId } = req.params;
    const { fullName, role, isActive } = req.body;
    try {
        const u = await query('SELECT * FROM users WHERE id=$1', [userId]);
        if (!u.rowCount) return res.status(404).json(fail('User not found'));
        const user = u.rows[0];

        if (req.auth.role !== 'super_admin' && req.auth.tenantId !== user.tenant_id) return res.status(403).json(fail('Forbidden'));

        let fields = [];
        let values = [];
        let idx = 1;

        if (fullName && (req.auth.userId === userId || req.auth.role === 'tenant_admin' || req.auth.role === 'super_admin')) {
            fields.push(`full_name=$${idx++}`);
            values.push(fullName);
        }
        if (role && req.auth.role === 'tenant_admin') {
            if (!ALLOWED_USER_ROLES.has(role)) return res.status(400).json(fail('Invalid role'));
            fields.push(`role=$${idx++}`);
            values.push(role);
        }
        if (typeof isActive === 'boolean' && req.auth.role === 'tenant_admin') {
            fields.push(`is_active=$${idx++}`);
            values.push(isActive);
        }

        if (!fields.length) return res.status(403).json(fail('Not authorized'));

        values.push(userId);
        const upd = await query(`UPDATE users SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${idx} RETURNING id, full_name, role, updated_at`, values);

        await logAudit({ tenantId: user.tenant_id, userId: req.auth.userId, action: 'UPDATE_USER', entityType: 'user', entityId: userId, ipAddress: req.ip });

        return res.json(ok(upd.rows[0], 'User updated successfully'));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

router.delete('/:userId', authRequired, requireRole('tenant_admin'), async(req, res) => {
    const { userId } = req.params;
    try {
        const u = await query('SELECT * FROM users WHERE id=$1', [userId]);
        if (!u.rowCount) return res.status(404).json(fail('User not found'));
        const user = u.rows[0];
        if (req.auth.tenantId !== user.tenant_id) return res.status(403).json(fail('Forbidden'));
        if (req.auth.userId === userId) return res.status(403).json(fail('Cannot delete self'));

        // Unassign tasks assigned to this user
        await query('UPDATE tasks SET assigned_to=NULL WHERE assigned_to=$1', [userId]);

        await query('DELETE FROM users WHERE id=$1', [userId]);

        await logAudit({ tenantId: user.tenant_id, userId: req.auth.userId, action: 'DELETE_USER', entityType: 'user', entityId: userId, ipAddress: req.ip });

        return res.json(ok(null, 'User deleted successfully'));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

export default router;