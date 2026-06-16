import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The API is proxied so the browser sees a single origin (the web app). This
// keeps the access/refresh cookie same-site and avoids CORS — and lets a single
// tunnel expose the whole app for previews. Set VITE_API_URL to override.
const API = 'http://localhost:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // listen on all interfaces (LAN / tunnel previews)
    port: 5173,
    // Hosts allowed to reach the dev server (custom domain + tunnels + local).
    allowedHosts: ['localhost', '.getlyras.app', '.trycloudflare.com'],
    proxy: {
      '/auth': { target: API, changeOrigin: false },
      '/workspaces': { target: API, changeOrigin: false },
      '/invites': { target: API, changeOrigin: false },
      '/projects': { target: API, changeOrigin: false },
      '/prompts': { target: API, changeOrigin: false },
      '/prompt-tests': { target: API, changeOrigin: false },
      '/pipelines': { target: API, changeOrigin: false },
      '/files': { target: API, changeOrigin: false },
      '/runs': { target: API, changeOrigin: false },
      '/health': { target: API, changeOrigin: false },
    },
  },
});
