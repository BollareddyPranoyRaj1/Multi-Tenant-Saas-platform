/*
    Evaluation smoke test (covers ALL 19 core endpoints).

    What it validates:
    - Docker readiness: GET /health
    - Auth: missing token => 401, invalid inputs => 400
    - Seed credentials: demo tenant admin + super admin login
    - RBAC: super_admin-only tenants list; tenant_admin-only user management
    - Tenant isolation: cross-tenant attempts are blocked (403)
    - CRUD flows: users/projects/tasks endpoints work end-to-end

    Notes:
    - Uses a temporary tenant created via register-tenant.
    - Creates a temporary user and project in the demo tenant and cleans them up.

    Run:
        node tools/smoke-test.js

    Optional:
        API_BASE=http://localhost:5000/api node tools/smoke-test.js
*/

const BASE = process.env.API_BASE || 'http://localhost:5000/api';

async function parseBody(res) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

async function req(method, path, { body, token } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    return {
        status: res.status,
        body: await parseBody(res),
    };
}

function assert(name, ok, detail) {
    return { name, ok: !!ok, detail };
}

function pickData(enveloped) {
    // Most endpoints return { success, data }. Health does not.
    if (!enveloped || typeof enveloped !== 'object') return null;
    if (enveloped.success === true) return enveloped.data;
    return null;
}

function short(detail) {
    if (!detail) return detail;
    if (detail.status && detail.body && typeof detail.body === 'object') {
        const b = detail.body;
        // keep payloads small
        return { status: detail.status, message: b.message, success: b.success, dataKeys: b.data ? Object.keys(b.data) : undefined };
    }
    return detail;
}

(async() => {
    const results = [];

    // Operational endpoint: GET /api (version)
    {
        const r = await req('GET', '', {});
        results.push(assert('GET /api', r.status === 200 && r.body && r.body.success === true, short(r)));
    }

    // Health
    {
        const res = await fetch(`${BASE}/health`);
        const body = await res.json().catch(() => null);
        results.push(assert('GET /health', res.status === 200 && body && body.status === 'ok', { status: res.status, body }));
    }

    // Auth required
    {
        const r = await req('GET', '/projects');
        results.push(assert('GET /projects without token -> 401', r.status === 401, r));
    }

    // Demo tenant admin login
    const demoLogin = await req('POST', '/auth/login', {
        body: { email: 'admin@demo.com', password: 'Demo@123', tenantSubdomain: 'demo' },
    });
    results.push(assert('POST /auth/login demo admin', demoLogin.status === 200 && demoLogin.body && demoLogin.body.success === true, { status: demoLogin.status }));
    const demoToken = demoLogin.body && demoLogin.body.data && demoLogin.body.data.token;

    // Auth: /auth/me
    const demoMe = await req('GET', '/auth/me', { token: demoToken });
    const demoMeData = pickData(demoMe.body);
    const demoTenantId = demoMeData && demoMeData.tenant && demoMeData.tenant.id;
    results.push(assert('GET /auth/me demo', demoMe.status === 200 && !!demoTenantId, short(demoMe)));

    // Projects (1/4): GET /projects
    const demoProjects = await req('GET', '/projects?limit=5', { token: demoToken });
    results.push(
        assert(
            'GET /projects demo',
            demoProjects.status === 200 && demoProjects.body && demoProjects.body.data && Array.isArray(demoProjects.body.data.projects), { status: demoProjects.status, count: demoProjects.body && demoProjects.body.data && demoProjects.body.data.projects && demoProjects.body.data.projects.length }
        )
    );
    const projectId = (demoProjects.body && demoProjects.body.data && demoProjects.body.data.projects && demoProjects.body.data.projects[0] && demoProjects.body.data.projects[0].id) || null;

    // Super admin login
    const superLogin = await req('POST', '/auth/login', {
        body: { email: 'superadmin@system.com', password: 'Admin@123' },
    });
    results.push(
        assert(
            'POST /auth/login super_admin',
            superLogin.status === 200 && superLogin.body && superLogin.body.data && superLogin.body.data.user && superLogin.body.data.user.role === 'super_admin', { status: superLogin.status }
        )
    );
    const superToken = superLogin.body && superLogin.body.data && superLogin.body.data.token;

    // Auth: /auth/logout
    {
        const out = await req('POST', '/auth/logout', { token: demoToken });
        results.push(assert('POST /auth/logout (demo) -> 200', out.status === 200 && out.body && out.body.success === true, short(out)));
    }

    // super_admin forbidden on tenant-scoped endpoints
    const superProjects = await req('GET', '/projects', { token: superToken });
    results.push(assert('GET /projects as super_admin -> 403', superProjects.status === 403, superProjects));

    // Tenants (1/3): GET /tenants (super_admin)
    const tenants = await req('GET', '/tenants?limit=5', { token: superToken });
    results.push(assert('GET /tenants as super_admin', tenants.status === 200 && tenants.body && tenants.body.data && Array.isArray(tenants.body.data.tenants), { status: tenants.status }));

    // Tenants RBAC: tenant_admin cannot list
    const tenantsAsTenant = await req('GET', '/tenants?limit=5', { token: demoToken });
    results.push(assert('GET /tenants as tenant_admin -> 403', tenantsAsTenant.status === 403, tenantsAsTenant));

    // Tenants (2/3): GET /tenants/:tenantId (demo tenant as tenant_admin)
    {
        const r = await req('GET', `/tenants/${demoTenantId}`, { token: demoToken });
        results.push(assert('GET /tenants/:tenantId (own tenant) -> 200', r.status === 200, short(r)));
    }

    // Tenants (3/3): PUT /tenants/:tenantId (tenant_admin can update only name)
    {
        const r = await req('PUT', `/tenants/${demoTenantId}`, { token: demoToken, body: { name: 'Demo Company' } });
        results.push(assert('PUT /tenants/:tenantId (tenant_admin name only) -> 200', r.status === 200, short(r)));
    }

    // Auth (1/1 remaining): register-tenant creates a second tenant
    const suffix = Math.random().toString(16).slice(2, 8);
    const subdomain = `acme${suffix}`;
    const adminEmail = `admin@${subdomain}.com`;

    const reg = await req('POST', '/auth/register-tenant', {
        body: {
            tenantName: `Acme ${suffix}`,
            subdomain,
            adminEmail,
            adminPassword: 'Acme@123',
            adminFullName: 'Acme Admin',
        },
    });
    results.push(assert('POST /auth/register-tenant', reg.status === 201 && !!(reg.body && reg.body.data && reg.body.data.tenantId), { status: reg.status, subdomain }));
    const acmeTenantId = reg.body && reg.body.data && reg.body.data.tenantId;

    const acmeLogin = await req('POST', '/auth/login', {
        body: { email: adminEmail, password: 'Acme@123', tenantSubdomain: subdomain },
    });
    results.push(assert('POST /auth/login new tenant admin', acmeLogin.status === 200, { status: acmeLogin.status }));
    const acmeToken = acmeLogin.body && acmeLogin.body.data && acmeLogin.body.data.token;

    // Cross-tenant access: tenants/:demoTenantId using acme token should be 403
    {
        const r = await req('GET', `/tenants/${demoTenantId}`, { token: acmeToken });
        results.push(assert('Cross-tenant GET /tenants/:tenantId -> 403', r.status === 403, short(r)));
    }

    // Super admin can fetch tenant details by id
    {
        const r = await req('GET', `/tenants/${acmeTenantId}`, { token: superToken });
        results.push(assert('GET /tenants/:tenantId as super_admin -> 200', r.status === 200, short(r)));
    }

    // Super admin can update plan/limits for a tenant
    {
        const r = await req('PUT', `/tenants/${acmeTenantId}`, { token: superToken, body: { subscriptionPlan: 'pro', maxUsers: 25, maxProjects: 15 } });
        results.push(assert('PUT /tenants/:tenantId as super_admin -> 200', r.status === 200, short(r)));
    }

    // Cross-tenant access attempt (tasks)
    if (projectId) {
        const cross = await req('GET', `/tasks/projects/${projectId}/tasks?limit=5`, { token: acmeToken });
        results.push(assert('Cross-tenant GET /tasks/projects/:projectId/tasks -> 403', cross.status === 403, cross));
    } else {
        results.push(assert('Cross-tenant test skipped (no projectId)', false, { reason: 'demo projects list empty' }));
    }

    // Users (1/4): GET /users/:tenantId/users
    {
        const r = await req('GET', `/users/${demoTenantId}/users?limit=5`, { token: demoToken });
        results.push(assert('GET /users/:tenantId/users (own tenant) -> 200', r.status === 200, short(r)));
    }

    // Users (2/4): POST /users/:tenantId/users (create temp user)
    let tempUserId = null; {
        const email = `temp_${suffix}@demo.com`;
        const r = await req('POST', `/users/${demoTenantId}/users`, {
            token: demoToken,
            body: { email, password: 'TempUser@123', fullName: 'Temp User', role: 'user' },
        });
        const data = pickData(r.body);
        tempUserId = data && data.id;
        results.push(assert('POST /users/:tenantId/users (tenant_admin) -> 201', r.status === 201 && !!tempUserId, short(r)));
    }

    // Users validation: invalid role -> 400
    {
        const r = await req('POST', `/users/${demoTenantId}/users`, {
            token: demoToken,
            body: { email: `bad_${suffix}@demo.com`, password: 'TempUser@123', fullName: 'Bad Role', role: 'owner' },
        });
        results.push(assert('POST /users/:tenantId/users invalid role -> 400', r.status === 400, short(r)));
    }

    // Users RBAC: cross-tenant list users -> 403
    {
        const r = await req('GET', `/users/${demoTenantId}/users?limit=5`, { token: acmeToken });
        results.push(assert('Cross-tenant GET /users/:tenantId/users -> 403', r.status === 403, short(r)));
    }

    // Users (3/4): PUT /users/:userId (update fullName)
    {
        const r = await req('PUT', `/users/${tempUserId}`, { token: demoToken, body: { fullName: 'Temp User Updated' } });
        results.push(assert('PUT /users/:userId (tenant_admin) -> 200', r.status === 200, short(r)));
    }

    // Users (4/4): DELETE /users/:userId
    {
        const r = await req('DELETE', `/users/${tempUserId}`, { token: demoToken });
        results.push(assert('DELETE /users/:userId (tenant_admin) -> 200', r.status === 200, short(r)));
    }

    // Projects (2/4): POST /projects (create temp project)
    let tempProjectId = null; {
        const r = await req('POST', '/projects', { token: demoToken, body: { name: `Temp Project ${suffix}`, description: 'tmp' } });
        tempProjectId = pickData(r.body) && pickData(r.body).id;
        results.push(assert('POST /projects -> 201', r.status === 201 && !!tempProjectId, short(r)));
    }

    // Projects (3/4): PUT /projects/:projectId
    {
        const r = await req('PUT', `/projects/${tempProjectId}`, { token: demoToken, body: { description: 'updated' } });
        results.push(assert('PUT /projects/:projectId -> 200', r.status === 200, short(r)));
    }

    // Tasks (1/4): POST /tasks/projects/:projectId/tasks
    let tempTaskId = null; {
        const r = await req('POST', `/tasks/projects/${tempProjectId}/tasks`, { token: demoToken, body: { title: `Temp Task ${suffix}`, description: 'tmp', priority: 'medium', dueDate: '2025-12-25' } });
        tempTaskId = pickData(r.body) && pickData(r.body).id;
        results.push(assert('POST /tasks/projects/:projectId/tasks -> 201', r.status === 201 && !!tempTaskId, short(r)));
    }

    // Tasks (2/4): GET /tasks/projects/:projectId/tasks
    {
        const r = await req('GET', `/tasks/projects/${tempProjectId}/tasks?limit=10`, { token: demoToken });
        const data = pickData(r.body);
        results.push(assert('GET /tasks/projects/:projectId/tasks -> 200', r.status === 200 && data && Array.isArray(data.tasks), short(r)));
    }

    // Tasks validation: invalid status -> 400
    {
        const r = await req('PATCH', `/tasks/${tempTaskId}/status`, { token: demoToken, body: { status: 'not_a_status' } });
        results.push(assert('PATCH /tasks/:taskId/status invalid -> 400', r.status === 400, short(r)));
    }

    // Tasks (3/4): PATCH /tasks/:taskId/status
    {
        const r = await req('PATCH', `/tasks/${tempTaskId}/status`, { token: demoToken, body: { status: 'done' } });
        results.push(assert('PATCH /tasks/:taskId/status valid -> 200', r.status === 200, short(r)));
    }

    // Tasks (4/4): PUT /tasks/:taskId
    {
        const r = await req('PUT', `/tasks/${tempTaskId}`, { token: demoToken, body: { title: `Temp Task ${suffix} Updated`, priority: 'high', dueDate: '2025-12-25' } });
        results.push(assert('PUT /tasks/:taskId -> 200', r.status === 200, short(r)));
    }

    // Projects (4/4): DELETE /projects/:projectId
    {
        const r = await req('DELETE', `/projects/${tempProjectId}`, { token: demoToken });
        results.push(assert('DELETE /projects/:projectId -> 200', r.status === 200, short(r)));
    }

    const failed = results.filter((r) => !r.ok);
    const summary = {
        apiBase: BASE,
        passed: results.length - failed.length,
        total: results.length,
        failed: failed.map((f) => ({ name: f.name, detail: f.detail })),
    };

    console.log(JSON.stringify(summary, null, 2));
    process.exit(failed.length ? 1 : 0);
})().catch((e) => {
    console.error('Smoke test failed with exception:', e);
    process.exit(1);
});