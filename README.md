# TestPilot AI

AI-assisted Quality Engineering workspace for requirement analysis, test-case design, review, automation generation, and test execution.

## Current capabilities

- Account registration and login with short-lived JWT bearer authentication.
- Project creation, listing, updates, archive, and restore.
- Requirement creation and document text extraction (PDF, DOCX, TXT).
- Ollama-powered requirement analysis with validated structured output.
- AI-generated draft test cases with human review and approval.
- Test-case search, filtering, and CSV export.
- API health and database readiness endpoints.

> Automation script generation and isolated execution are planned milestones. The worker currently does not execute test jobs.

## Architecture

| Workspace | Responsibility |
| --- | --- |
| `apps/web` | React, TypeScript, Vite, Tailwind CSS |
| `apps/api` | Node.js, Express 5, TypeScript, PostgreSQL, Ollama integration |
| `apps/worker` | Reserved for isolated automation jobs; currently a scaffold |
| `packages/shared` | Shared TypeScript contracts and utilities |
| `database/migrations` | PostgreSQL schema migrations |

## Prerequisites

- Node.js 20 or later and npm.
- PostgreSQL 16 or later.
- Ollama installed and running, with the configured model downloaded.

## Local setup

1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

   Set `DATABASE_URL` to your PostgreSQL database and replace `JWT_SECRET` with a random secret of at least 32 characters. The API loads this root `.env` file through dotenv.

3. Create the database (if it does not already exist):

   ```bash
   createdb testpilot
   ```

4. Apply the initial schema. The migration script uses the shell environment, so export the connection string first:

   ```bash
   set -a
   source .env
   set +a
   npm run db:migrate
   ```

5. Start Ollama and download the configured model:

   ```bash
   ollama serve
   ollama pull qwen2.5:7b
   ```

6. Start the API and web app in separate terminals:

   ```bash
   npm run dev --workspace=@testpilot/api
   npm run dev --workspace=@testpilot/web
   ```

   The API listens on `http://localhost:4000` and the web app on `http://localhost:5173`. The web API client defaults to `http://localhost:4000`; set `VITE_API_BASE_URL` in `apps/web/.env.local` only if your API uses a different URL.

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Secret of at least 32 characters for signing access tokens |
| `API_PORT` | No | `4000` | API listen port |
| `WEB_ORIGIN` | No | `http://localhost:5173` | Allowed browser origin for CORS |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | No | `qwen2.5:7b` | Model used for AI workflows |
| `VITE_API_BASE_URL` | No | `http://localhost:4000` | Web app API base URL; configure in `apps/web/.env.local` |

Never commit a real `.env` file, production secret, database credential, or API key.

## Verification

Run these commands from the repository root:

```bash
npm run typecheck
npm run build
```

## API health

- `GET /api/health` — process liveness.
- `GET /api/health/ready` — readiness check that verifies PostgreSQL connectivity.

API responses include an `X-Request-Id` header. Include that value when reporting an unexpected server error so the corresponding server log can be located.

## Security notes

- Access tokens currently use a 15-minute lifetime and are stored in browser `sessionStorage`. A secure HttpOnly-cookie session design is a separate planned hardening task.
- Uploaded documents are processed in memory with file size, type, and signature checks; they are not permanently stored.
- AI output is validated and generated test cases remain drafts until a human reviews them.
- Generated automation must not execute inside the API process. Isolated execution, resource limits, network restrictions, and secret isolation are required before enabling the worker.

## Development workflow

Use feature branches and pull requests. Run typecheck and build locally, then verify the affected behaviour before merging.
