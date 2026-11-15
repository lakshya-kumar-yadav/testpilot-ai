# TestPilot AI – Architecture

## Architectural style
A TypeScript monorepo with a modular Express API and a separately deployable execution worker.

## Main components
- `apps/web`: React dashboard.
- `apps/api`: REST API and business modules.
- `apps/worker`: isolated test execution process (initial scaffold only).
- `packages/shared`: shared TypeScript contracts.
- `prisma`: relational data model.

## AI workflow
1. Extract text from an uploaded requirement document.
2. Send relevant content to the local Ollama model.
3. Request schema-constrained structured output.
4. Validate the result on the server.
5. Persist the requirement and generated test cases.
6. Require user review and approval before script execution.

## Execution safety
Code is untrusted. Do not execute it in the API process or on the host.
A future worker must use an isolated container, non-root user, read-only filesystem where possible,
resource limits, timeouts, restricted network access and no access to application secrets.
