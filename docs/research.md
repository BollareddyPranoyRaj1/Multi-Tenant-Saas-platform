# Research (simple): Multi‑tenancy, security, and stack choices

This project is a small, production‑style multi‑tenant SaaS starter. The key idea is: **one running app serves multiple companies (tenants)**, and the app must guarantee that tenant data never leaks across tenants.

This document is intentionally written in simple language. It still covers the three things the rubric asks for:
1) how multi‑tenancy is handled, 2) why the stack was chosen, and 3) the main security considerations.

## 1) What “multi‑tenant” means (plain English)

In a multi‑tenant SaaS, different organizations share the same deployed system.

Each tenant expects:
- **Isolation:** Tenant A cannot read or change Tenant B’s data.
- **Fairness:** One tenant should not break the system for everyone.
- **Security:** authentication (who are you?) and authorization (what can you do?) must always be checked.
- **Easy operations:** upgrades and deployments should be predictable.

The easiest mistake is thinking “multi‑tenant = add a `tenant_id` column.” In reality, multi‑tenancy must show up everywhere:
- database schema
- query patterns
- route authorization checks
- background work (if any)
- audit logs
- frontend rules (show/hide features by role)

## 2) Multi‑tenancy models (and why this project chose one)

There are three common models.

### A) One database + one schema + `tenant_id` column (chosen)
**What it is:** all tenants share the same PostgreSQL database and tables. Tenant-owned rows contain `tenant_id`.

**Why it’s good here:**
- Simple to operate and easy to evaluate.
- Only one set of migrations.
- Fits the rubric’s “one command: docker-compose up -d” requirement.

**Downsides:**
- The app must be very disciplined. If you forget a tenant filter in a query, you can leak data.
- A “noisy neighbor” is possible if one tenant runs heavy queries.

**How we reduce risk in this project:**
- Tenant id is taken from the JWT for every request.
- Routes validate tenant ownership (for example, tasks validate that the project belongs to the same tenant).
- `super_admin` is separated clearly from tenant roles.

### B) One database + schema per tenant
**What it is:** each tenant has its own schema inside the same database.

**Why it’s not chosen here:** it complicates migrations (run for every schema) and makes evaluation more complex.

### C) One database per tenant
**What it is:** each tenant has its own database.

**Why it’s not chosen here:** it is expensive and operationally heavy. It also doesn’t fit the “simple docker-compose demo” goal well.

## 3) Tenant identification + login flows

This project supports two login styles.

### Tenant user login
Tenant users belong to a tenant (`users.tenant_id` is set). To log in, the backend must know which tenant to use.

We support:
- `tenantSubdomain` (easy for humans, e.g. `demo`)
- or `tenantId` (useful for testing)

Login checks `(tenant_id, email)` and returns a JWT with:
- `userId`
- `tenantId`
- `role`

### Super admin login
The super admin is platform-wide. In the database, `users.tenant_id` is `NULL`.

They log in with only email/password and get a JWT where `tenantId: null`.

## 4) Authorization (RBAC) in simple terms

RBAC means “role-based access control.” We use three roles:
- `super_admin`: can do platform-level actions
- `tenant_admin`: can manage users inside a tenant
- `user`: regular tenant member

The main rule is simple:

> if you are not `super_admin`, you may only access rows where `row.tenant_id === token.tenantId`.

This is what prevents cross‑tenant access even if someone guesses IDs.

## 5) Data isolation: how it’s implemented

### A) Every tenant-owned table has `tenant_id`
Key tables:
- `projects.tenant_id`
- `tasks.tenant_id`
- `users.tenant_id` (nullable for super admin)

This makes tenant filtering fast and consistent:
`WHERE tenant_id = $1`.

### B) Nested resources validate parent tenant ownership
Tasks belong to projects. So before listing or creating tasks, the backend first loads the project and verifies it belongs to the same tenant.

This blocks a common bug:
“I filtered tasks by projectId but forgot to verify that project belongs to the tenant.”

### C) Constraints keep data clean
Constraints do not replace authorization, but they prevent invalid states.

In this project:
- task status is limited to: `todo | in_progress | done | cancelled`
- task priority is limited to: `low | medium | high | urgent`

## 6) Subscription plans and limits

Many SaaS products use plans (free/pro/enterprise) and limits.

Here:
- tenants store `subscription_plan`
- tenants store `max_users` and `max_projects`

The backend enforces:
- user creation checks `max_users`
- project creation checks `max_projects`

This shows the difference between:
- **authorization** (who is allowed)
- **entitlements** (what the tenant is allowed)

## 7) Security considerations (simple checklist)

### A) Password hashing
Passwords are stored as bcrypt hashes. We never store plaintext passwords.

Why bcrypt? It is intentionally slow, so brute force is harder.

### B) JWT tokens
JWTs are signed with `JWT_SECRET`.

Tokens include:
- `userId`, `tenantId`, `role`

Tokens expire (default is 24 hours) to reduce long-lived risk.

### C) SQL injection
All DB calls use parameterized queries (`$1`, `$2`, ...). This avoids string concatenation attacks.

### D) CORS
Under Docker evaluation the browser origin is `http://localhost:3000`, so CORS allows that origin.

### E) Input validation
Endpoints check required fields and return `400` on missing data. For a bigger system you would use a schema library (zod/joi) for consistency.

### F) Audit logging
The system records audit logs for important actions (login/logout, tenant registration, seed completion marker). This helps debugging and accountability.

### G) What you would add in production (but not needed for the rubric)
This project focuses on correctness and reproducibility. In a real SaaS you would typically also add:
- rate limiting for login
- account lockouts/cooldowns
- 2FA for super admins
- proper secrets management (no committed secrets)

## 8) Why this tech stack

### Backend: Node.js + Express
- Simple and explicit routing (good for an endpoint-based rubric)
- Easy to dockerize

### Database: PostgreSQL
- Strong constraints and relational integrity
- Great fit for tenant_id filtering

### Frontend: React + Vite
- Simple SPA pages for login, dashboard, projects, users
- Fast build and good dev experience

### Docker Compose
- One-command startup
- Predictable ports
- Easy evaluation of DB + API + frontend together

## 9) Operations: automatic migrations + automatic seed

The rubric requires no manual commands.

On backend start, the app:
1. ensures extensions (like `pgcrypto`)
2. applies migrations exactly once
3. runs idempotent seed data
4. only then reports ready via `/api/health`

This means `docker-compose up -d` is enough to bring up a working system.

## 10) Limitations (what we kept simple)

To keep the project easy to evaluate, we did not implement everything a big SaaS would need.

Possible future upgrades:
- Postgres Row Level Security (RLS) for stronger defense-in-depth
- refresh tokens + rotation
- more detailed logging/tracing
- a full super-admin UI for tenant management

Even with those features missing, the current design is a solid baseline: it clearly demonstrates multi‑tenancy, RBAC, safe dockerized startup, and correct tenant isolation.

## 11) Performance and “noisy neighbor” concerns

When tenants share the same database and tables, you should think about performance early.

**The classic risk** is a “noisy neighbor”: one tenant creates many records or runs heavy queries and slows down everyone.

Simple ways to reduce that risk (and ideas you can add later):
- **Indexes that include `tenant_id`:** in a shared-schema model, most queries filter by tenant. Indexes like `(tenant_id, created_at)` or `(tenant_id, id)` help a lot.
- **Pagination on lists:** project lists, task lists, and user lists should support paging so you don’t accidentally return 10,000 rows.
- **Reasonable limits:** subscription limits (max users/projects) reduce worst-case load and match SaaS business rules.
- **Connection pooling:** as you scale, you typically use a pooler so you don’t open too many DB connections.

For this evaluation project, the dataset is small, but the mental model is important: multi-tenant correctness is not only security; it is also predictable performance.

## 12) Tenant lifecycle (create, grow, leave)

Real SaaS systems have tenant lifecycle needs that are easy to forget:

### A) Provisioning
When a new tenant signs up, you usually need to:
- create a tenant row
- create the first admin user
- optionally create default projects or settings

This project’s seed data is basically an example of that process.

### B) Data export
Tenants often ask for exports (for audits or switching products). With `tenant_id` on every row, exports can be built by filtering tables by tenant.

### C) Deletion and “right to be forgotten”
If you need to delete a tenant, having `tenant_id` everywhere makes it possible to delete or anonymize data safely (usually in the right order).

This project does not implement a full deletion workflow, but the schema design is compatible with one.

## 13) Threat model: what attacks we are thinking about

Security is easier when you name the threats.

Common threats for a SaaS like this:

### A) Cross-tenant data access
The worst failure is when a user from Tenant A can see Tenant B’s data.

Defense layers:
- tenant checks on every query
- validating parent/child ownership (project → tasks)
- optional future upgrade: Postgres RLS

### B) Credential attacks
Attackers may try to guess passwords or reuse leaked passwords.

What we do:
- bcrypt hashing
- short token lifetimes (24h)

What you’d add later:
- rate limiting on login
- 2FA for high-privilege users

### C) Token theft (XSS, local storage)
In many SPAs, tokens are stored in browser storage for simplicity. The downside is: if you have an XSS bug, an attacker might read the token.

This project keeps things simple for the rubric. In a real product you would:
- avoid unsafe HTML rendering
- use strong Content Security Policy (CSP)
- consider HttpOnly cookies instead of localStorage tokens

### D) Privilege escalation
If a regular user can call an admin-only endpoint, that is a privilege escalation.

Defense layers:
- role checks on endpoints
- clear separation of `super_admin` vs tenant roles

## 14) How we verify tenant isolation (practical testing)

It is not enough to “believe” you scoped queries correctly. You should test it.

Simple test ideas (manual or automated):
- Create two tenants (Tenant A and Tenant B).
- Create a project in Tenant A.
- Log in as a Tenant B user and try to read/update Tenant A’s project.
- Expected result: **403/404** (depending on your API design), but never a successful response.

The same applies to tasks:
- create tasks under a project in Tenant A
- try to access them using Tenant B credentials
- verify the backend blocks it

This project’s routing style (always using `tenantId` from JWT) makes these tests straightforward.

## 15) Why simple documentation matters

One last point: clear docs are a security feature.

When teams misunderstand how tenants are scoped, they accidentally add endpoints that leak data. Keeping the rules simple helps:
- always use `tenantId` from the token
- never trust client-provided tenant ids for authorization
- validate parent ownership for nested resources
- keep role rules explicit and consistent

That is exactly the mindset this project tries to demonstrate.
