import { defineConfig } from 'vite'

const API_ORIGIN = 'http://localhost:8787'

// `bun dev` serves the app; the ranking API comes from `bun run dev:api` (the Worker with a local database). The proxy
// presents the Worker's own origin, which it requires on submissions, as it gets in production.
export default defineConfig({
  server: { proxy: { '/api': { target: API_ORIGIN, changeOrigin: true, headers: { origin: API_ORIGIN } } } },
})
