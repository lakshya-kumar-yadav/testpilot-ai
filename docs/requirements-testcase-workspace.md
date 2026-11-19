# Requirements and Test Case Workspace

The authenticated project workspace is available at `/projects/:projectId`.

## Workflow
1. Open a project from the dashboard.
2. Create a requirement manually, or upload one PDF, DOCX, or TXT document and extract its text for review.
3. Save the requirement. Upload extraction is a preview; it does not save or analyze the document automatically.
4. Run the Ollama-backed requirement analysis and review its findings.
5. Generate test cases from a completed analysis. Generated cases are saved as `DRAFT`.
6. Review each test case and explicitly mark it for review, approve it, or reject it.

## Workspace API additions
- `GET /api/requirements/:requirementId/analysis` — latest completed analysis.
- `GET /api/requirements/:requirementId/test-cases` — list test cases.
- `PATCH /api/test-cases/:testCaseId` — update review status (`DRAFT`, `REVIEW`, `APPROVED`, `REJECTED`).

All new read/update operations require authentication and enforce ownership through the project relationship. AI output remains subject to human review; approval is a deliberate user action.

## Local verification
Run `npm run typecheck` and `npm run build` from the repository root. Then exercise the complete workflow with PostgreSQL and a running Ollama model. Test document extraction with valid and invalid PDF/DOCX/TXT files, and verify that users cannot read or update another user's requirements or test cases.
