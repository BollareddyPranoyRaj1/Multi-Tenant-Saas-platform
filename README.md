# Multi-Tenant SaaS Platform (Projects & Tasks)

A simple, dockerized multi-tenant SaaS starter. Multiple organizations (tenants) can manage users, projects, and tasks.

This repo includes:
- strict tenant data isolation (via `tenant_id`)
- RBAC roles (`super_admin`, `tenant_admin`, `user`)
- subscription plan limits (max users/projects)
- automatic DB migrations + seed data on startup

## Run with Docker (recommended)

Start everything:

```powershell
cd ~/Desktop/multi-tenant-saas-platform
docker-compose up -d
```

Open:
- Frontend UI: http://localhost:3000
- Backend API: http://localhost:5000
- Health check: http://localhost:5000/api/health

## Login credentials (seeded)

These are also recorded in `submission.json`.

- Super Admin (platform-wide)
  - `superadmin@system.com` / `Admin@123`

- Demo Tenant
  - subdomain: `demo`
  - Tenant Admin: `admin@demo.com` / `Demo@123`
  - Users: `user1@demo.com` / `User@123`, `user2@demo.com` / `User@123`

## Environment variables

Environment variables for evaluation are set directly in `docker-compose.yml` (so `docker-compose up -d` works with no extra steps).

For local (non-Docker) development, you can copy `.env.example` → `.env` and adjust as needed.

Key variables:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `PORT`
- `FRONTEND_URL` (CORS)
- `VITE_API_URL` (frontend API base URL)

## Deploy frontend to GitHub Pages

This repository includes a React (Vite) frontend and a Node/Express backend. **GitHub Pages can only host static sites**, so this deploy publishes **only the `frontend/`**.

### Enable GitHub Pages

1. Push this repository to GitHub.
2. In GitHub: **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

### Configure the backend API URL

GitHub Pages cannot proxy `/api` to your backend (unlike your local Vite dev proxy). Host the backend somewhere else and set the frontend to call it.

Create a repository variable:

- **Settings → Secrets and variables → Actions → Variables → New repository variable**
- Name: `VITE_API_URL`
- Value: `https://YOUR_BACKEND_HOST/api`

### Deploy

Pushing to `main` (or `master`) will build and publish the site via `.github/workflows/deploy-pages.yml`.

Your site URL will be:

- `https://github.com/BollareddyPranoyRaj1/multi-tenant-saas-platform`

### Notes

- Deep links like `/projects/123` work on GitHub Pages via the SPA 404 redirect (`frontend/public/404.html`).
- If you deploy as a **user/organization site** (root, no `/<repo>/` subpath), you may need to adjust the redirect logic in `frontend/public/404.html`.

## API docs

See `docs/API.md` for the full endpoint documentation.

## Documentation

All required documentation artifacts are under `docs/`:
- Product Requirements: `docs/PRD.md`
- Architecture + endpoint list: `docs/architecture.md`
- Technical specification + Docker setup: `docs/technical-spec.md`
- Research (multi-tenancy, stack justification, security): `docs/research.md`
- API documentation (19 core endpoints + operational endpoints): `docs/API.md`

## Notes

- Data isolation: the backend scopes tenant data using `tenant_id` from the JWT (except `super_admin`).
- DB init: the backend runs migrations + seed data automatically at startup.

## Diagrams

Required diagrams are under `docs/images/`:
- `system-architecture.png`
- `database-erd.png`

Source SVGs are also included for crisp zooming:
- `architecture.svg`
- `er-diagram.svg`
## Setup Instructions
## Backend Overview
## Frontend Overview
## Docker Usage
