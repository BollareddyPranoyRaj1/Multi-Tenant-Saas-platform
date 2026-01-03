# Product Requirements Document (PRD)

## Goal
Build a dockerized multi-tenant SaaS app where tenants manage users, projects, and tasks. It must enforce tenant isolation, JWT auth, RBAC, and subscription limits, and it must auto-run migrations + seed data on startup.

## Personas & roles
- **super_admin**: platform admin (no tenant); can manage/list tenants.
- **tenant_admin**: admin for one tenant; can manage tenant users + workspaces.
- **user**: regular tenant member; works with projects/tasks within their tenant.

## User journeys
1. Super admin logs in and can list tenants.
2. A tenant registers and gets a first tenant admin.
3. Tenant admin logs in using tenant subdomain and manages users/projects/tasks.
4. Tenant user logs in and works only inside their tenant.

## Functional requirements (15+)
1. Support tenant login using `tenantSubdomain` (or `tenantId`).
2. Support super admin login without a tenant.
3. Issue JWT on successful login.
4. Protect endpoints using `Authorization: Bearer <token>`.
5. Enforce roles: `super_admin`, `tenant_admin`, `user`.
6. Enforce tenant isolation for all tenant-owned data.
7. Prevent cross-tenant access even if IDs are guessed.
8. Allow tenant registration (create tenant + first tenant admin).
9. Allow `super_admin` to list tenants.
10. Allow tenant admins to create users within their tenant.
11. Allow tenant admins to list users within their tenant.
12. Allow tenant admins to delete users within their tenant (cannot delete self).
13. Allow creating projects (respect `max_projects`).
14. Allow listing/updating/deleting projects within tenant.
15. Allow creating tasks under a project.
16. Allow listing tasks under a project with filters.
17. Allow updating task status with: `todo | in_progress | done | cancelled`.
18. Enforce `max_users` and `max_projects` plan limits.
19. Record audit logs for important actions (e.g., login/logout/seed marker).
20. Provide a health endpoint: `GET /api/health`.

## Non-functional requirements (5+)
1. One-command startup: `docker-compose up -d` starts DB + backend + frontend.
2. Fixed ports: DB 5432, backend 5000, frontend 3000.
3. Automatic init: migrations run automatically on backend start.
4. Automatic seed: seed runs automatically after migrations.
5. Idempotent startup: safe to restart with existing DB volume.
6. Security basics: bcrypt password hashing, parameterized SQL, JWT secret required.

## Success criteria
- `docker-compose up -d` starts successfully.
- `GET /api/health` returns ready (`status=ok`).
- Seeded credentials in `submission.json` work.
- Cross-tenant data access attempts are rejected.

## Out of scope
- Payments/billing, emails, background jobs, advanced permission models.
