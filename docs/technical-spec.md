# Technical Specification

## Backend
- Runtime: Node.js 20
- Framework: Express
- DB: PostgreSQL via `pg`

### Environment variables
Backend (Docker):
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `FRONTEND_URL` (CORS)
- `PORT`

### API response envelope
Success:
- `{ "success": true, "data": ..., "message"?: string }`

Failure:
- `{ "success": false, "message": string }`

### Auth model
- Header: `Authorization: Bearer <JWT>`
- Claims:
  - `userId`
  - `tenantId` (nullable)
  - `role`

### Tenant isolation
- For tenant-owned entities, backend checks `req.auth.tenantId` matches row `tenant_id`.
- `super_admin` can bypass tenant checks.

### Subscription enforcement
- User creation checks `tenants.max_users`.
- Project creation checks `tenants.max_projects`.

## Database schema (summary)
- `tenants(id, name, subdomain, subscription_plan, max_users, max_projects, ...)`
- `users(id, tenant_id, email, role, ...)`
- `projects(id, tenant_id, name, status, created_by, ...)`
- `tasks(id, tenant_id, project_id, status, priority, assigned_to, ...)`
- `audit_logs(...)`

### Constraints
- Task status: `todo | in_progress | done | cancelled`
- Task priority: `low | medium | high | urgent`

## Frontend
- React Router protected routes.
- Token stored in `localStorage`.
- API base URL via `VITE_API_URL`.

## Docker setup (required for evaluation)

This project is evaluated by starting all services with a single command:

- Run: `docker-compose up -d`

### Services and fixed ports
- `database` (PostgreSQL 15): `5432:5432`
- `backend` (Node/Express): `5000:5000`
- `frontend` (Nginx serving React build): `3000:3000`

### Automatic initialization
On **backend** container start, the application automatically:
1. Ensures required Postgres extensions (e.g., `pgcrypto` for UUIDs).
2. Applies SQL migrations (tracked in a `migrations` table).
3. Runs idempotent seed logic.
4. Marks readiness so `GET /api/health` returns `status=ok` only after initialization completes.

No manual migration/seed commands are required (or allowed) for evaluation.
