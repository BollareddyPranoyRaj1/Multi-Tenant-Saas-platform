-- Seed demo user data
-- Password hash for 'Demo@123' with bcrypt rounds=10
-- This migration ensures demo credentials exist for testing

-- First insert the tenant
INSERT INTO tenants (id, name, subdomain, status, subscription_plan, max_users, max_projects, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Company', 'demo', 'active', 'pro', 25, 15, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Then insert the user with the correct tenant_id
INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'admin@demo.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P6MRFG',
  'Demo Admin',
  'tenant_admin',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (tenant_id, email) DO NOTHING;
