AI DocuWriter – CRUSH quick ref

Build/run
- Backend: npm --prefix backend install; npm --prefix backend run build; npm --prefix backend start
- Backend dev: npm --prefix backend run dev
- Frontend: npm --prefix frontend install; npm --prefix frontend run build; npm --prefix frontend run preview
- Frontend dev: npm --prefix frontend run dev

Lint/format/typecheck/tests
- Frontend lint: npm --prefix frontend run lint
- Frontend typecheck: npx --yes tsc -p frontend/tsconfig.json --noEmit
- Backend typecheck: npx --yes tsc -p backend/tsconfig.json --noEmit
- Tests: none configured; ad-hoc Node tests: node backend/test-*.js
- Run single ad-hoc test: node backend/test-template-loading.js (or any specific file)

Single-command helpers
- Clean backend build: npm --prefix backend run clean && rimraf backend/dist (if needed)
- Build all (typecheck both, then build): npx tsc -p backend/tsconfig.json --noEmit && npx tsc -p frontend/tsconfig.json --noEmit && npm --prefix backend run build && npm --prefix frontend run build

Code style (repo-wide)
- Language: TypeScript (ES2020) for both apps; React + Vite on frontend; Node/Express on backend
- Imports: use absolute project-relative only if configured; otherwise relative paths; group: node builtins, external, internal; no unused imports
- Formatting: use ESLint defaults in frontend; prefer 2-space indent, single quotes or consistent quotes; trailing commas ok
- Types: enable strict TS where possible; avoid any; define shared types under frontend/src/types and backend/src/types; use interfaces for object shapes
- Naming: camelCase for vars/functions, PascalCase for React components/types, UPPER_SNAKE for const env keys; file names kebab-case (frontend) and camelCase (backend services)
- React: functional components, hooks only at top level; maintain minimal state; derive state when possible
- Error handling: never swallow; return typed errors; backend Express: next(err) or centralized middleware; avoid leaking secrets in messages
- Env/config: use backend/.env (copy from .env.example); never commit secrets; prefer process.env access via a config module
- Logging: backend via morgan + console for debug; no PII in logs
- PDFs/exports: ensure temp files go to backend/data/generated and are gitignored

Tools/notes
- No Cursor or Copilot custom rules detected
- Vercel: frontend uses vite build; backend runs dist/app.js
