# AI Test Case Generator

The generator creates draft test cases from a saved requirement and its latest completed AI analysis. It uses the configured local Ollama model and stores generated cases in the existing `test_cases` table.

## Endpoint

`POST /api/requirements/:requirementId/test-cases/generate`

Requires a bearer access token. The requirement must belong to the authenticated user and have status `ANALYZED` or `APPROVED`, plus a completed analysis result.

## Generated fields

Each generated test case includes:
- Title and description
- Optional preconditions
- Ordered steps, each with an action and expected result
- Overall expected result
- Priority: `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`
- Test type: `FUNCTIONAL`, `NEGATIVE`, `BOUNDARY`, `EDGE`, `SECURITY`, or `PERFORMANCE`

The API accepts 1–30 generated cases per request. Every case is persisted with status `DRAFT`. Generation does not approve test cases or execute tests.

## Safety and consistency

- Authentication and requirement ownership are checked before inference.
- Requirement text and stored AI analysis are treated as untrusted input.
- Ollama output is parsed and validated against a strict Zod schema.
- The requirement and latest analysis are rechecked in a database transaction before any test cases are inserted.
- All generated test cases are inserted atomically; a failed insert rolls back the batch.
- Human review is required before generated cases are used downstream.

The endpoint uses the existing local Ollama configuration and does not add a new AI provider.
