import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { logAudit } from '../utils/audit.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

function planDefaults(plan) {
    switch (plan) {
        case 'free':
            return { max_users: 5, max_projects: 3 };
        case 'pro':
            return { max_users: 25, max_projects: 15 };
        case 'enterprise':
            return { max_users: 100, max_projects: 50 };
        default:
            return { max_users: 5, max_projects: 3 };
    }
}

router.post('/register-tenant', async(req, res) => {
    const { tenantName, subdomain, adminEmail, adminPassword, adminFullName } = req.body;
    if (!tenantName || !subdomain || !adminEmail || !adminPassword || !adminFullName) {
        return res.status(400).json(fail('Validation errors'));
    }
    try {
        // Start transaction
        await query('BEGIN');

        const existing = await query('SELECT 1 FROM tenants WHERE subdomain=$1', [subdomain]);
        if (existing.rowCount) {
            await query('ROLLBACK');
            return res.status(409).json(fail('Subdomain already exists'));
        }

        const plan = 'free';
        const defaults = planDefaults(plan);
        const t = await query(
            `INSERT INTO tenants (id, name, subdomain, status, subscription_plan, max_users, max_projects, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'active', $3, $4, $5, NOW(), NOW()) RETURNING id, id as tenant_id, subdomain`, [tenantName, subdomain, plan, defaults.max_users, defaults.max_projects]
        );
        const tenantId = t.rows[0].id;

        const emailExisting = await query('SELECT 1 FROM users WHERE tenant_id=$1 AND email=$2', [tenantId, adminEmail]);
        if (emailExisting.rowCount) {
            await query('ROLLBACK');
            return res.status(409).json(fail('Email already exists in tenant'));
        }

        const pwHash = await bcrypt.hash(adminPassword, 10);
        const u = await query(
            `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'tenant_admin', true, NOW(), NOW()) RETURNING id, email, full_name, role`, [tenantId, adminEmail, pwHash, adminFullName]
        );

        await query('COMMIT');

        await logAudit({ tenantId, userId: null, action: 'REGISTER_TENANT', entityType: 'tenant', entityId: tenantId, ipAddress: req.ip });

        return res.status(201).json(ok({
            tenantId,
            subdomain,
            adminUser: {
                id: u.rows[0].id,
                email: u.rows[0].email,
                fullName: u.rows[0].full_name,
                role: u.rows[0].role
            }
        }, 'Tenant registered successfully'));
    } catch (e) {
        await query('ROLLBACK');
        return res.status(500).json(fail('Internal error'));
    }
});

router.post('/login', async(req, res) => {
    const { email, password, tenantSubdomain, tenantId } = req.body;
    if (!email || !password) return res.status(400).json(fail('Validation errors'));
    try {
        // Super admin login path (no tenant required)
        const superRes = await query("SELECT * FROM users WHERE tenant_id IS NULL AND role='super_admin' AND email=$1", [email]);
        if (superRes.rowCount) {
            const user = superRes.rows[0];
            if (!user.is_active) return res.status(403).json(fail('Account suspended/inactive'));
            const match = await bcrypt.compare(password, user.password_hash);
            if (!match) return res.status(401).json(fail('Invalid credentials'));
            const token = jwt.sign({ userId: user.id, tenantId: null, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
            return res.json(ok({
                user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role, tenantId: null },
                token,
                expiresIn: 86400
            }));
        }

        let tenant;
        if (tenantSubdomain) {
            const t = await query('SELECT * FROM tenants WHERE subdomain=$1', [tenantSubdomain]);
            if (!t.rowCount) return res.status(404).json(fail('Tenant not found'));
            tenant = t.rows[0];
        } else if (tenantId) {
            const t = await query('SELECT * FROM tenants WHERE id=$1', [tenantId]);
            if (!t.rowCount) return res.status(404).json(fail('Tenant not found'));
            tenant = t.rows[0];
        } else {
            return res.status(400).json(fail('Tenant identifier required'));
        }
        if (tenant.status !== 'active') return res.status(403).json(fail('Account suspended/inactive'));

        const u = await query('SELECT * FROM users WHERE tenant_id=$1 AND email=$2', [tenant.id, email]);
        if (!u.rowCount) return res.status(401).json(fail('Invalid credentials'));
        const user = u.rows[0];

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json(fail('Invalid credentials'));

        const token = jwt.sign({ userId: user.id, tenantId: user.tenant_id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });

        return res.json(ok({
            user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role, tenantId: user.tenant_id },
            token,
            expiresIn: 86400
        }));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

router.get('/me', authRequired, async(req, res) => {
    try {
        const { userId, tenantId } = req.auth;
        const u = await query('SELECT id, email, full_name, role, is_active FROM users WHERE id=$1', [userId]);
        if (!u.rowCount) return res.status(404).json(fail('User not found'));
        const t = await query('SELECT id, name, subdomain, subscription_plan, max_users, max_projects FROM tenants WHERE id=$1', [tenantId]);
        const tenant = t.rowCount ? t.rows[0] : null;
        return res.json(ok({
            id: u.rows[0].id,
            email: u.rows[0].email,
            fullName: u.rows[0].full_name,
            role: u.rows[0].role,
            isActive: u.rows[0].is_active,
            tenant: tenant ? {
                id: tenant.id,
                name: tenant.name,
                subdomain: tenant.subdomain,
                subscriptionPlan: tenant.subscription_plan,
                maxUsers: tenant.max_users,
                maxProjects: tenant.max_projects
            } : null
        }));
    } catch (e) {
        return res.status(500).json(fail('Internal error'));
    }
});

router.post('/logout', authRequired, async(req, res) => {
    await logAudit({ tenantId: req.auth.tenantId, userId: req.auth.userId, action: 'LOGOUT', entityType: 'user', entityId: req.auth.userId, ipAddress: req.ip });
    return res.json(ok(null, 'Logged out successfully'));
});

export default router;