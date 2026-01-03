import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    // GitHub Pages (project pages) serves from: https://<owner>.github.io/<repo>/
    // We set `base` dynamically in CI using env vars.
    const isGitHubPages = process.env.GITHUB_PAGES === 'true';
    const repoName = (process.env.GITHUB_REPOSITORY || '').split('/')[1];
    const base = isGitHubPages && repoName ? `/${repoName}/` : '/';

    return {
        base,
        plugins: [react()],
        server: {
            host: true,
            port: 3000,
            strictPort: true,
            proxy: {
                // Browser hits http://localhost:3000/api/... (same-origin), Vite proxies to backend.
                '/api': {
                    target: process.env.VITE_PROXY_TARGET || 'http://localhost:5000',
                    changeOrigin: true,
                },
            },
        },
        preview: {
            host: true,
            port: 3000,
            strictPort: true,
        },
    };
});