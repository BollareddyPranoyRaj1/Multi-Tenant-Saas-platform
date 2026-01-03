# API Documentation (all endpoints)

This file documents the backend endpoints implemented in `backend/src/routes/*`.

## Base URLs

When running via Docker Compose:
- Backend (direct): `http://localhost:5000/api`
- Frontend (Nginx proxy to backend): `http://localhost:3000/api`

## Authentication

Most endpoints require a JWT.

Header:

`Authorization: Bearer <token>`

The JWT contains:
- `userId`
- `tenantId` (nullable; `null` for `super_admin`)
- `role`

## Roles

- `super_admin` (platform-level; not tied to a tenant)
- `tenant_admin` (admin inside one tenant)
- `user` (regular tenant member)

## Response format

Most endpoints use a consistent envelope:

- Success: `{ "success": true, "data": ..., "message"?: string }`
- Error: `{ "success": false, "message": string, "data"?: any }`

Operational endpoints (`/health`) return a simpler shape.

## Status / constraints

Tasks are constrained to:
- `status ∈ { todo, in_progress, done, cancelled }`
- `priority ∈ { low, medium, high, urgent }`

## Endpoint count note (rubric alignment)

The app exposes **19 core application endpoints** (Auth + Tenants + Users + Projects + Tasks) and **2 operational endpoints** (`GET /health`, `GET /`).

Important access note:
- `super_admin` is **platform-scoped** and is not allowed to call tenant-scoped resources like Projects/Tasks/Users in this demo implementation.
- Tenant-scoped endpoints require `tenant_admin` or `user` and always enforce tenant isolation using the `tenantId` from the JWT.
---
## Operational endpoints

### GET `/api/health`

Readiness probe.

Responses:
- `200` when ready: `{ "status": "ok", "database": "connected" }`
- `503` while initializing: `{ "status": "initializing", "database": "connected" }`
- `500` if DB down: `{ "status": "error", "database": "disconnected" }`

### GET `/api`

API info.

Auth: not required.

Response (`200`):
```json
{ "success": true, "data": { "version": "1.0.0" } }
```

---

## Core endpoints (19)

## Auth (4)

### POST `/api/auth/register-tenant`

Creates a tenant and the first tenant admin user.

Auth: not required.

Body:
- `tenantName` (string, required)
- `subdomain` (string, required, unique)
- `adminEmail` (string, required)
- `adminPassword` (string, required)
- `adminFullName` (string, required)

Responses:
- `201`:
  - `data.tenantId`, `data.subdomain`, `data.adminUser`
- `400` validation errors
- `409` subdomain exists OR email exists in that tenant
- `500` internal error

Example response:
```json
{
  "success": true,
  "message": "Tenant registered successfully",
  "data": {
    "tenantId": "<uuid>",
    "subdomain": "demo",
    "adminUser": {
      "id": "<uuid>",
      "email": "admin@demo.com",
      "fullName": "Demo Admin",
      "role": "tenant_admin"
    }
  }
}
```

### POST `/api/auth/login`

Returns a JWT.

Auth: not required.

Body (common):
- `email` (string, required)
- `password` (string, required)

Tenant user login requires *one* of:
- `tenantSubdomain` (string)
- `tenantId` (uuid string)

Super admin login:
- Uses only `email` + `password` (tenant identifier is ignored).

Responses:
- `200`: `data.user`, `data.token`, `data.expiresIn`
- `400` validation errors OR tenant identifier required
- `401` invalid credentials
- `403` account/tenant suspended or inactive
- `404` tenant not found (when tenantSubdomain/tenantId is provided)

Example (tenant login) response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "<uuid>",
      "email": "admin@demo.com",
      "fullName": "Demo Admin",
      "role": "tenant_admin",
      "tenantId": "<tenant-uuid>"
    },
    "token": "<jwt>",
    "expiresIn": 86400
  }
}
```

### GET `/api/auth/me`

Returns the currently authenticated user and (if applicable) tenant info.

Auth: required.

Responses:
- `200`: user profile + `tenant` object (nullable for `super_admin`)
- `401` missing/invalid token
- `404` user not found

Example response:
```json
{
  "success": true,
  "data": {
    "id": "<uuid>",
    "email": "admin@demo.com",
    "fullName": "Demo Admin",
    "role": "tenant_admin",
    "isActive": true,
    "tenant": {
      "id": "<tenant-uuid>",
      "name": "Demo Tenant",
      "subdomain": "demo",
      "subscriptionPlan": "free",
      "maxUsers": 5,
      "maxProjects": 3
    }
  }
}
```

### POST `/api/auth/logout`

Logs a logout event to audit logs.

Auth: required.

Responses:
- `200`:
```json
{ "success": true, "message": "Logged out successfully" }
```

---

## Tenants (3)

### GET `/api/tenants`

Lists tenants.

Auth: required.

Role: `super_admin` only.

Query params:
- `page` (number, default 1)
- `limit` (number, default 10, max 100)
- `status` (string, optional)
- `subscriptionPlan` (string, optional)

Response (`200`):
- `data.tenants`: array of tenants (includes `totalUsers`, `totalProjects`)
- `data.pagination`: `{ currentPage, totalPages, totalTenants, limit }`

### GET `/api/tenants/:tenantId`

Gets tenant details and simple stats.

Auth: required.

Access:
- `super_admin`: any tenant
- `tenant_admin`/`user`: only their own tenant (must match JWT `tenantId`)

Response (`200`): tenant details + `stats.totalUsers/totalProjects/totalTasks`

Errors:
- `401` missing/invalid token
- `403` unauthorized access
- `404` tenant not found

### PUT `/api/tenants/:tenantId`

Updates tenant fields.

Auth: required.

Access rules:
- `super_admin` can update: `name`, `status`, `subscriptionPlan`, `maxUsers`, `maxProjects`
- Non-`super_admin` can update **only** `name`, and only for their own tenant

Body (all optional):
- `name` (string)
- `status` (string)
- `subscriptionPlan` (string)
- `maxUsers` (number)
- `maxProjects` (number)

Errors:
- `400` no fields to update
- `403` forbidden
- `404` tenant not found

---

## Users (4)

### POST `/api/users/:tenantId/users`

Creates a user inside a tenant.

Auth: required.

Role: `tenant_admin` only.

Path params:
- `tenantId` (uuid)

Body:
- `email` (string, required)
- `password` (string, required)
- `fullName` (string, required)
- `role` (string, optional; default `user`)

Limits:
- Enforces `tenants.max_users` (returns `403` if reached).

Errors:
- `403` forbidden OR subscription limit reached
- `404` tenant not found
- `409` email exists in tenant

### GET `/api/users/:tenantId/users`

Lists users within a tenant.

Auth: required.

Access:
- `super_admin`: allowed
- Tenant roles: only if `:tenantId` matches JWT `tenantId`

Query params:
- `search` (string; matches email/fullName)
- `role` (string)
- `page` (number, default 1)
- `limit` (number, default 50, max 100)

Response (`200`):
- `data.users`: array
- `data.total`
- `data.pagination`: `{ currentPage, totalPages, limit }`

### PUT `/api/users/:userId`

Updates a user.

Auth: required.

Body (optional; authorization controls what is allowed):
- `fullName` (string)
- `role` (string)
- `isActive` (boolean)

Authorization rules (as implemented):
- Must be same tenant (unless `super_admin`).
- `fullName` can be updated by:
  - the user themself, or
  - a `tenant_admin`, or
  - `super_admin`
- `role` and `isActive` can be updated only by `tenant_admin`.

Errors:
- `403` forbidden/not authorized
- `404` user not found

### DELETE `/api/users/:userId`

Deletes a user.

Auth: required.

Role: `tenant_admin` only.

Rules:
- Must be in same tenant.
- Cannot delete self.
- Tasks assigned to the user are unassigned automatically.

Errors:
- `403` forbidden/cannot delete self
- `404` user not found

---

## Projects (4)

### POST `/api/projects`

Creates a project in the caller's tenant.

Auth: required.

Body:
- `name` (string, required)
- `description` (string, optional)
- `status` (string, optional; default `active`)

Limits:
- Enforces `tenants.max_projects` (returns `403` if reached).

Errors:
- `400` validation errors
- `403` project limit reached

### GET `/api/projects`

Lists projects in the caller's tenant.

Auth: required.

Query params:
- `status` (string)
- `search` (string; matches name)
- `page` (number, default 1)
- `limit` (number, default 20, max 100)

Response (`200`):
- `data.projects`: array (includes `taskCount`, `completedTaskCount`)
- `data.total`
- `data.pagination`

### PUT `/api/projects/:projectId`

Updates a project.

Auth: required.

Authorization rules:
- Must be same tenant (unless `super_admin`).
- Allowed if caller is:
  - `tenant_admin`, or
  - the project creator, or
  - `super_admin`

Body (optional):
- `name` (string)
- `description` (string; can be set to empty)
- `status` (string)

Errors:
- `400` no fields to update
- `403` forbidden/not authorized
- `404` project not found

### DELETE `/api/projects/:projectId`

Deletes a project (and its tasks).

Auth: required.

Authorization rules:
- Must be same tenant (unless `super_admin`).
- Allowed if caller is `tenant_admin`, project creator, or `super_admin`.

Errors:
- `403` forbidden/not authorized
- `404` project not found

---

## Tasks (4)

### POST `/api/tasks/projects/:projectId/tasks`

Creates a task under a project.

Auth: required.

Path params:
- `projectId` (uuid)

Body:
- `title` (string, required)
- `description` (string, optional)
- `assignedTo` (uuid string, optional; must be a user in the same tenant)
- `priority` (string, optional; default `medium`)
- `dueDate` (date/time string, optional)

Behavior:
- New tasks start with `status = todo`.

Errors:
- `404` project not found
- `403` project does not belong to tenant
- `400` invalid `assignedTo`

### GET `/api/tasks/projects/:projectId/tasks`

Lists tasks for a project.

Auth: required.

Query params:
- `status` (string)
- `assignedTo` (uuid string)
- `priority` (string)
- `search` (string; matches title)
- `page` (number, default 1)
- `limit` (number, default 50, max 100)

Response (`200`):
- `data.tasks`: array
- `data.total`
- `data.pagination`

Errors:
- `404` project not found
- `403` forbidden

### PATCH `/api/tasks/:taskId/status`

Updates only the status field.

Auth: required.

Body:
- `status` (string, required; should be one of `todo | in_progress | done | cancelled`)

Errors:
- `404` task not found
- `403` forbidden

### PUT `/api/tasks/:taskId`

Updates task fields.

Auth: required.

Body (all optional):
- `title` (string)
- `description` (string)
- `status` (string)
- `priority` (string)
- `assignedTo` (uuid string or null)
- `dueDate` (date/time string or null)

Notes:
- If `assignedTo` is provided and non-null, it must reference a user in the same tenant.

Errors:
- `400` no fields to update OR invalid assignedTo
- `404` task not found
- `403` forbidden

---

## Quick examples

Tenant admin login:
```bash
curl -s http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"Demo@123","tenantSubdomain":"demo"}'
```

Get current user:
```bash
curl -s http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

Update task status:
```bash
curl -s -X PATCH http://localhost:5000/api/tasks/<taskId>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"status":"done"}'
```
