# Copilot Instructions — release-agent-ui

## Architecture

React 18 SPA built with Vite and Tailwind CSS v4. This is the frontend for the Release Agent backend API.

### Key layers

- **Routing** — `react-router-dom` v7 with two main sections: `/sessions/*` (release notes workflow) and `/issues/*` (issue clustering dashboard). Routes defined in `src/app/App.tsx`.
- **API client** — `src/app/api/client.ts` wraps `fetch()` with auth token injection. `releaseAgentApi.ts` defines all typed API methods. The backend URL is configured via `VITE_API_BASE_URL` (or similar env var).
- **Auth** — `AuthContext` + `AuthGate` gate the entire app. Token stored client-side; sent as `Authorization: Bearer` header.
- **State** — React Context providers (`AuthContext`, `SessionContext`, `RepoContext`, `DraftContext`, `RunContext`) in `src/app/context/`.
- **UI components** — Radix UI primitives + shadcn/ui pattern with `class-variance-authority` and `tailwind-merge`. Components in `src/app/components/`.

### Two product areas in the UI

1. **Sessions** — Create a draft (repo + ref range), generate release notes/hotspots/test plans, review and export.
2. **Issues** — Browse issue clusters by product area and version, semantic search, sync admin.

## Build & Run

```bash
# Install dependencies
npm install

# Dev server with hot-reload
npm run dev

# Production build
npm run build
```

There are no tests or linters configured.

## Key Conventions

- **Path alias** — `@` maps to `src/` (configured in `vite.config.ts`). Use `@/app/components/...` style imports.
- **Tailwind CSS v4** — Uses the Vite plugin (`@tailwindcss/vite`), not a `tailwind.config` file. Styles in `src/styles/`.
- **shadcn/ui pattern** — Components use Radix primitives + CVA variants + `cn()` utility (from `clsx` + `tailwind-merge`).
- **No state management library** — All state is via React Context and local component state. No Redux/Zustand.
