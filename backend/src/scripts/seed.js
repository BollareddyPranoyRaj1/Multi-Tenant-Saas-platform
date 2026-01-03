import bcrypt from 'bcrypt';
import { query } from '../config/db.js';

async function upsertTenantBySubdomain({ name, subdomain, plan, maxUsers, maxProjects }) {
    const existing = await query('SELECT id FROM tenants WHERE subdomain=$1', [subdomain]);
    if (existing.rowCount) {
        const id = existing.rows[0].id;
        await query(
            `UPDATE tenants
      SET name=$1, status='active', subscription_plan=$2, max_users=$3, max_projects=$4, updated_at=NOW()
      WHERE id=$5`, [name, plan, maxUsers, maxProjects, id]
        );
        return id;
    }
    const inserted = await query(
        `INSERT INTO tenants (id, name, subdomain, status, subscription_plan, max_users, max_projects, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, $2, 'active', $3, $4, $5, NOW(), NOW())
    RETURNING id`, [name, subdomain, plan, maxUsers, maxProjects]
    );
    return inserted.rows[0].id;
}

async function upsertUserByTenantEmail({ tenantId, email, password, fullName, role }) {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
    ON CONFLICT (tenant_id, email) DO UPDATE SET
      password_hash=EXCLUDED.password_hash,
      full_name=EXCLUDED.full_name,
      role=EXCLUDED.role,
      is_active=true,
      updated_at=NOW()
    RETURNING id`, [tenantId, email, passwordHash, fullName, role]
    );
    return result.rows[0].id;
}

async function upsertSuperAdmin({ email, password, fullName }) {
    const passwordHash = await bcrypt.hash(password, 10);
    const existing = await query("SELECT id FROM users WHERE tenant_id IS NULL AND role='super_admin' AND email=$1", [email]);
    if (existing.rowCount) {
        await query(
            `UPDATE users SET password_hash=$1, full_name=$2, is_active=true, updated_at=NOW()
      WHERE id=$3`, [passwordHash, fullName, existing.rows[0].id]
        );
        return existing.rows[0].id;
    }
    const inserted = await query(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), NULL, $1, $2, $3, 'super_admin', true, NOW(), NOW())
    RETURNING id`, [email, passwordHash, fullName]
    );
    return inserted.rows[0].id;
}

async function upsertProjectByTenantName({ tenantId, name, description, createdBy }) {
    const existing = await query('SELECT id FROM projects WHERE tenant_id=$1 AND name=$2', [tenantId, name]);
    if (existing.rowCount) {
        await query('UPDATE projects SET description=$1, status=\'active\', updated_at=NOW() WHERE id=$2', [description, existing.rows[0].id]);
        return existing.rows[0].id;
    }
    const inserted = await query(
        `INSERT INTO projects (id, tenant_id, name, description, status, created_by, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, $2, $3, 'active', $4, NOW(), NOW())
    RETURNING id`, [tenantId, name, description, createdBy]
    );
    return inserted.rows[0].id;
}

async function upsertTaskByProjectTitle({ tenantId, projectId, title, description, status, priority, assignedTo, dueDate }) {
    const existing = await query('SELECT id FROM tasks WHERE project_id=$1 AND title=$2', [projectId, title]);
    if (existing.rowCount) {
        await query(
            `UPDATE tasks
      SET description=$1, status=$2, priority=$3, assigned_to=$4, due_date=$5, updated_at=NOW()
      WHERE id=$6`, [description, status, priority, assignedTo || null, dueDate || null, existing.rows[0].id]
        );
        return existing.rows[0].id;
    }
    const inserted = await query(
        `INSERT INTO tasks (id, project_id, tenant_id, title, description, status, priority, assigned_to, due_date, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    RETURNING id`, [projectId, tenantId, title, description, status, priority, assignedTo || null, dueDate || null]
    );
    return inserted.rows[0].id;
}

export async function seedDatabase() {
    const demoTenantId = await upsertTenantBySubdomain({
        name: 'Demo Company',
        subdomain: 'demo',
        plan: 'pro',
        maxUsers: 25,
        maxProjects: 15
    });

    await upsertSuperAdmin({ email: 'superadmin@system.com', password: 'Admin@123', fullName: 'System SuperAdmin' });

    const demoAdminId = await upsertUserByTenantEmail({
        tenantId: demoTenantId,
        email: 'admin@demo.com',
        password: 'Demo@123',
        fullName: 'Demo Admin',
        role: 'tenant_admin'
    });

    const user1Id = await upsertUserByTenantEmail({ tenantId: demoTenantId, email: 'user1@demo.com', password: 'User@123', fullName: 'Demo User One', role: 'user' });
    const user2Id = await upsertUserByTenantEmail({ tenantId: demoTenantId, email: 'user2@demo.com', password: 'User@123', fullName: 'Demo User Two', role: 'user' });

    const projectAlphaId = await upsertProjectByTenantName({ tenantId: demoTenantId, name: 'Project Alpha', description: 'First demo project', createdBy: demoAdminId });
    const projectBetaId = await upsertProjectByTenantName({ tenantId: demoTenantId, name: 'Project Beta', description: 'Second demo project', createdBy: demoAdminId });

    await upsertTaskByProjectTitle({ tenantId: demoTenantId, projectId: projectAlphaId, title: 'Design homepage mockup', description: 'Create high-fidelity design', status: 'todo', priority: 'high', assignedTo: user1Id, dueDate: '2024-07-15' });
    await upsertTaskByProjectTitle({ tenantId: demoTenantId, projectId: projectAlphaId, title: 'Setup CI/CD', description: 'Configure pipelines', status: 'in_progress', priority: 'medium', assignedTo: user2Id, dueDate: '2024-07-20' });
    await upsertTaskByProjectTitle({ tenantId: demoTenantId, projectId: projectAlphaId, title: 'Write content', description: 'Homepage copy', status: 'done', priority: 'low', assignedTo: null, dueDate: '2024-07-25' });
    await upsertTaskByProjectTitle({ tenantId: demoTenantId, projectId: projectBetaId, title: 'API integration', description: 'Integrate backend', status: 'todo', priority: 'high', assignedTo: user1Id, dueDate: '2024-07-30' });
    await upsertTaskByProjectTitle({ tenantId: demoTenantId, projectId: projectBetaId, title: 'Unit tests', description: 'Add coverage', status: 'in_progress', priority: 'medium', assignedTo: user2Id, dueDate: '2024-08-01' });
}