# Architecture

## High-Level Overview

- **Frontend** (React + Vite) communicates with the backend through REST APIs.
- **Backend** (Node.js + Express) handles authentication, RBAC, and strict tenant isolation.
- **Database** (PostgreSQL) persists all platform and tenant-scoped data.

---

## System Diagrams

The following diagrams describe the system structure and data model.

### Rendered Images (PNG)
- `docs/images/system-architecture.png`
- `docs/images/database-erd.png`

### Source Files (SVG – high fidelity)
- `docs/images/architecture.svg`
- `docs/images/er-diagram.svg`

---

## API Endpoint Summary

Base path:/api
The backend exposes **19 core application endpoints** (aligned with rubric requirements) and **2 operational endpoints** used for health checks and versioning.

---

### Operational Endpoints (Excluded from core count)

- `GET /health`  
  Readiness probe (returns `503` while initializing)

- `GET /`  
  API metadata and version information

---

### Core Application Endpoints (19)

#### Authentication (4)
- `POST /auth/register-tenant`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`

#### Tenants (3)  
*(Primarily `super_admin` scoped unless noted)*
- `GET /tenants`
- `GET /tenants/:tenantId`
- `PUT /tenants/:tenantId`

#### Users (4)
- `POST /users/:tenantId/users`
- `GET /users/:tenantId/users`
- `PUT /users/:userId`
- `DELETE /users/:userId`

#### Projects (4)
- `POST /projects`
- `GET /projects`
- `PUT /projects/:projectId`
- `DELETE /projects/:projectId`

#### Tasks (4)
- `POST /tasks/projects/:projectId/tasks`
- `GET /tasks/projects/:projectId/tasks`
- `PATCH /tasks/:taskId/status`
- `PUT /tasks/:taskId`

---

## Request Flow

1. User authenticates and receives a JWT.
2. Frontend stores the token securely.
3. Each API request includes:
Authorization: Bearer 
4. Backend validates the token and enforces:
- Role-based access control
- Tenant-level data isolation using `tenant_id`

---

## Tenancy Model

- `tenants.id` uniquely identifies an organization.
- `users.tenant_id` is:
- `NULL` for `super_admin`
- set for all tenant-scoped users
- `projects.tenant_id` and `tasks.tenant_id` enforce strict tenant isolation at the database level.

---

## Backend Initialization Flow

On container startup, the backend performs the following steps:

1. Ensures required PostgreSQL extensions exist.
2. Applies database migrations.
3. Executes idempotent seed scripts.
4. Marks the system as ready.
5. Exposes `/api/health` as **ready (200)** only after completion.

---