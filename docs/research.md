# Research (Simple): Multi-Tenancy, Security, and Stack Choices

This project is a **small, production-style multi-tenant SaaS starter**.  
The core idea is simple:

> **One running application serves multiple companies (tenants), and tenant data must never leak across tenants.**

This document is intentionally written in **plain language**, while still covering the three points required by the rubric:
1. How multi-tenancy is handled  
2. Why the tech stack was chosen  
3. The main security considerations  

---

## 1. What “Multi-Tenant” Means (Plain English)

In a multi-tenant SaaS system, **multiple organizations share the same deployed application**.

Each tenant expects:
- **Isolation** – Tenant A cannot see or modify Tenant B’s data
- **Security** – authentication and authorization are always enforced
- **Fairness** – one tenant should not break the system for others
- **Easy operations** – upgrades and deployments should be predictable

A common beginner mistake is thinking:

> “Multi-tenant = just add a `tenant_id` column.”

In reality, multi-tenancy affects:
- database schema
- query patterns
- API authorization logic
- nested resource validation
- audit logging
- frontend feature visibility

---

## 2. Multi-Tenancy Models (and Why This Project Chose One)

There are three common approaches.

### A) One Database + One Schema + `tenant_id` Column (**Chosen**)

**What it is:**  
All tenants share the same PostgreSQL database and tables. Every tenant-owned row includes a `tenant_id`.

**Why it fits this project:**
- Simple to understand and operate
- Only one set of migrations
- Matches the rubric’s *“docker-compose up -d”* requirement
- Easy to evaluate in a demo setting

**Downsides:**
- Requires strict discipline in queries
- Missing a tenant filter can cause data leaks
- Risk of a “noisy neighbor” tenant

**Risk reduction in this project:**
- `tenantId` is always read from the JWT
- All tenant queries filter by `tenant_id`
- Parent ownership is validated for nested resources
- `super_admin` is clearly separated from tenant roles

---

### B) One Database + Schema Per Tenant

**What it is:**  
Each tenant has its own schema in the same database.

**Why not chosen:**  
Migrations become more complex and must run per schema, which adds operational overhead beyond the rubric’s scope.

---

### C) One Database Per Tenant

**What it is:**  
Each tenant has a completely separate database.

**Why not chosen:**  
Operationally heavy, expensive, and not suitable for a simple Docker-based evaluation project.

---

## 3. Tenant Identification and Login Flows

### Tenant User Login

Tenant users belong to a tenant (`users.tenant_id` is set).  
The backend must know which tenant to authenticate against.

Supported identifiers:
- `tenantSubdomain` (human-friendly, e.g. `demo`)
- `tenantId` (useful for testing)

Successful login returns a JWT containing:
- `userId`
- `tenantId`
- `role`

---

### Super Admin Login

The super admin is **platform-wide**.

- `users.tenant_id` is `NULL`
- Logs in using only email and password
- Receives a JWT where `tenantId = null`

This makes it impossible for super admin actions to accidentally mix with tenant-scoped logic.

---

## 4. Authorization (RBAC) in Simple Terms

RBAC means **Role-Based Access Control**.

Roles:
- `super_admin`
- `tenant_admin`
- `user`

The core rule:

> If you are **not** `super_admin`, you may only access data where  
> `row.tenant_id === token.tenantId`.

This rule prevents cross-tenant access even if IDs are guessed.

---

## 5. Data Isolation: How It’s Implemented

### A) `tenant_id` on Every Tenant-Owned Table

Key tables:
- `users.tenant_id` (nullable for super admin)
- `projects.tenant_id`
- `tasks.tenant_id`

This enables consistent filtering:
---

### B) Parent Ownership Validation for Nested Resources

Tasks belong to projects.

Before creating or listing tasks:
1. Load the project
2. Verify the project belongs to the same tenant

This prevents a common bug:
> “I filtered tasks by projectId but forgot to verify project ownership.”

---

### C) Constraints for Valid States

Constraints help keep data clean:
- task status: `todo | in_progress | done | cancelled`
- task priority: `low | medium | high | urgent`

Constraints do not replace authorization, but they prevent invalid data.

---

## 6. Subscription Plans and Limits

Tenants store:
- `subscription_plan`
- `max_users`
- `max_projects`

The backend enforces:
- user creation checks `max_users`
- project creation checks `max_projects`

This demonstrates the difference between:
- **Authorization** – who is allowed
- **Entitlements** – what the tenant is allowed

---

## 7. Security Considerations (Checklist)

### A) Password Hashing
- Passwords stored as bcrypt hashes
- No plaintext passwords
- bcrypt is intentionally slow to resist brute force attacks

---

### B) JWT Tokens
- Signed with `JWT_SECRET`
- Contain `userId`, `tenantId`, `role`
- Expire after ~24 hours to reduce risk

---

### C) SQL Injection Prevention
- All queries use parameterized SQL
- No string concatenation in queries

---

### D) CORS
- Docker evaluation origin: `http://localhost:3000`
- Backend allows this origin explicitly

---

### E) Input Validation
- Required fields checked
- Invalid input returns `400`
- In larger systems, a schema library would be used

---

### F) Audit Logging
- Important actions are logged:
  - login / logout
  - tenant registration
  - seed completion marker

---

### G) Production-Grade Additions (Out of Scope)
- rate limiting
- account lockouts
- 2FA
- secrets management systems

---

## 8. Why This Tech Stack

### Backend: Node.js + Express
- Simple, explicit routing
- Easy to reason about authorization
- Easy to dockerize

---

### Database: PostgreSQL
- Strong relational integrity
- Constraints and indexing support
- Ideal for `tenant_id` filtering

---

### Frontend: React + Vite
- Simple SPA for dashboards
- Fast builds and good developer experience

---

### Docker Compose
- One-command startup
- Predictable ports
- Easy evaluation of full system

---

## 9. Operations: Automatic Migrations and Seed

On backend startup:
1. Ensure required extensions
2. Apply migrations
3. Run idempotent seed scripts
4. Expose `/api/health` as ready

This guarantees:
is enough to start a working system.

---

## 10. Limitations (Kept Simple Intentionally)

Not implemented:
- Postgres Row Level Security (RLS)
- refresh token rotation
- advanced logging/tracing
- full super admin UI

The current design still clearly demonstrates **correct multi-tenancy and RBAC**.

---

## 11. Performance and “Noisy Neighbor” Concerns

Shared-table models must consider performance.

Mitigations:
- indexes that include `tenant_id`
- pagination for list endpoints
- subscription limits
- connection pooling (future)

Correctness comes first; predictable performance comes next.

---

## 12. Tenant Lifecycle Considerations

### A) Provisioning
- create tenant
- create first admin
- optional defaults

---

### B) Data Export
Filtering by `tenant_id` enables clean exports.

---

### C) Tenant Deletion
`tenant_id` everywhere enables safe deletion or anonymization.

---

## 13. Threat Model (What We Defend Against)

### A) Cross-Tenant Data Access
Defense layers:
- tenant-scoped queries
- parent ownership checks
- future option: Postgres RLS

---

### B) Credential Attacks
- bcrypt hashing
- short-lived JWTs

---

### C) Token Theft
Simplified storage for rubric clarity.  
In production: CSP, HttpOnly cookies, stronger XSS defenses.

---

### D) Privilege Escalation
- role checks per endpoint
- strict separation of super_admin vs tenant roles

---

## 14. Verifying Tenant Isolation

Manual test approach:
1. Create Tenant A and Tenant B
2. Create data under Tenant A
3. Access it using Tenant B credentials
4. Expect `403` or `404`, never success

---

## 15. Why Simple Documentation Matters

Clear documentation reduces security bugs.

Key rules repeated everywhere:
- always trust `tenantId` from JWT
- never trust client-provided tenant identifiers
- always validate parent ownership
- keep role rules explicit

This project is designed to demonstrate that mindset clearly.