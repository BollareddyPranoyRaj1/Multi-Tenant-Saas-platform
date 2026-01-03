// In Docker/prod we serve the SPA on :3000 and proxy /api to the backend.
// Default to same-origin so the browser never tries to resolve Docker-only hostnames.
const API_URL =
    import.meta.env.VITE_API_URL || '/api';

if (
    import.meta.env.PROD && !
    import.meta.env.VITE_API_URL) {
    // On GitHub Pages there's no reverse proxy for /api.
    // The UI will fail to load data until VITE_API_URL is configured at build time.
    console.warn('[frontend] VITE_API_URL is not set for a production build. Requests will go to /api on the static host.');
}

export function getToken() {
    return localStorage.getItem('token');
}

export function setToken(token) {
    localStorage.setItem('token', token);
}

export function clearToken() {
    localStorage.removeItem('token');
}

export async function apiFetch(path, { method = 'GET', body, token } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const t = token || getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
}