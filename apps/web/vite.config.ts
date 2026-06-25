import { defineConfig } from 'vite';
import type { IncomingMessage } from 'node:http';
import react from '@vitejs/plugin-react';

// The API is proxied so the browser sees a single origin (the web app). This
// keeps the access/refresh cookie same-site and avoids CORS — and lets a single
// tunnel expose the whole app for previews. Set VITE_API_URL to override.
const API = 'http://localhost:3001';

// Hosts allowed to reach the dev server (custom domain + tunnels + local).
const allowedHosts = ['localhost', 'dev.getlyras.app', '.getlyras.app', '.trycloudflare.com'];

// Some API path prefixes (/projects, /prompts, /pipelines) are ALSO client-side
// SPA routes. Clicking links is client routing and works, but a real page load
// or refresh issues GET /prompts — which would hit the API (404) instead of the
// app. A top-level navigation sends `Accept: text/html`; our fetch() API calls
// (Accept: */*) and <img>/file loads do not. So for these shared prefixes,
// serve the SPA for navigations and only proxy real API requests.
const navIsDocument = (req: IncomingMessage) =>
  req.headers.accept?.includes('text/html') ? '/index.html' : undefined;

const api = (shared = false) => ({
  target: API,
  changeOrigin: false,
  ...(shared ? { bypass: navIsDocument } : {}),
});

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on all interfaces (LAN / tunnel previews)
    port: 5173,
    allowedHosts,
    proxy: {
      '/auth': api(),
      '/workspaces': api(),
      '/invites': api(),
      '/projects': api(true), // also SPA routes
      '/prompts': api(true), // also SPA routes
      '/conversations': api(), // chat threads (the SPA route is /chats)
      '/pipelines': api(true), // also SPA routes
      '/files': api(), // always proxy — files open in a new tab (a navigation)
      '/runs': api(),
      '/health': api(),
      '/admin': api(true), // /admin is a SPA route AND the /admin/* API prefix
    },
  },
});
