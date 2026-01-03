-- NOTE: The app uses JS-based seeds at startup (bcrypt hashed at runtime).
-- This SQL seed file is kept for documentation and manual seeding, and is idempotent.

-- Super admin (tenant_id NULL)
INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000900', NULL, 'superadmin@system.com', 'REPLACED_BY_JS_SEED', 'System SuperAdmin', 'super_admin', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role='super_admin' AND email='superadmin@system.com');

-- Demo tenant
INSERT INTO tenants (id, name, subdomain, status, subscription_plan, max_users, max_projects, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Company', 'demo', 'active', 'pro', 25, 15, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Demo tenant admin
INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'admin@demo.com', 'REPLACED_BY_JS_SEED', 'Demo Admin', 'tenant_admin', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Regular users
INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'user1@demo.com', 'REPLACED_BY_JS_SEED', 'Demo User One', 'user', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'user2@demo.com', 'REPLACED_BY_JS_SEED', 'Demo User Two', 'user', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Projects
INSERT INTO projects (id, tenant_id, name, description, status, created_by, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'Project Alpha', 'First demo project', 'active', '00000000-0000-0000-0000-000000000101', NOW(), NOW());
INSERT INTO projects (id, tenant_id, name, description, status, created_by, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', 'Project Beta', 'Second demo project', 'active', '00000000-0000-0000-0000-000000000101', NOW(), NOW());

-- Tasks (5 total)
INSERT INTO tasks (id, project_id, tenant_id, title, description, status, priority, assigned_to, due_date, created_at, updated_at)
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'Design homepage mockup', 'Create high-fidelity design', 'todo', 'high', '00000000-0000-0000-0000-000000000102', '2024-07-15', NOW(), NOW());
INSERT INTO tasks (id, project_id, tenant_id, title, description, status, priority, assigned_to, due_date, created_at, updated_at)
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'Setup CI/CD', 'Configure pipelines', 'in_progress', 'medium', '00000000-0000-0000-0000-000000000103', '2024-07-20', NOW(), NOW());
INSERT INTO tasks (id, project_id, tenant_id, title, description, status, priority, assigned_to, due_date, created_at, updated_at)
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'Write content', 'Homepage copy', 'completed', 'low', NULL, '2024-07-25', NOW(), NOW());
INSERT INTO tasks (id, project_id, tenant_id, title, description, status, priority, assigned_to, due_date, created_at, updated_at)
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', 'API integration', 'Integrate backend', 'todo', 'high', '00000000-0000-0000-0000-000000000102', '2024-07-30', NOW(), NOW());
INSERT INTO tasks (id, project_id, tenant_id, title, description, status, priority, assigned_to, due_date, created_at, updated_at)
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', 'Unit tests', 'Add coverage', 'in_progress', 'medium', '00000000-0000-0000-0000-000000000103', '2024-08-01', NOW(), NOW());
