# AI Requirement Analyzer

The analyzer uses a locally hosted Ollama model to review a saved requirement and produce structured findings. It does not approve requirements.

## Configuration

Set these API environment variables:

- `OLLAMA_BASE_URL`: Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL`: installed model name (default: `qwen2.5:7b`)

Pull the configured model before making requests, for example: `ollama pull qwen2.5:7b`.

## Endpoint

`POST /api/requirements/:requirementId/analyze`

Requires a bearer access token. The requirement must belong to a project owned by the authenticated user. Draft and previously analyzed requirements can be analyzed; approved and archived requirements cannot.

A successful response includes a schema-validated analysis, an analysis ID, model name, and `requiresHumanReview: true`. The result is persisted in `ai_analyses` and the requirement status becomes `ANALYZED` in the same database transaction. A human must review the result before approval.

## Analysis fields

- Functional and non-functional requirement classifications
- Ambiguities, missing information, and conflicts
- Severity, evidence quote, and improvement suggestion for each finding
- Overall assessment and recommendations

## Safety

Requirement text is untrusted data. The prompt explicitly separates source content from instructions, and the model output is parsed and validated with Zod before persistence. This is a defense-in-depth measure, not a guarantee against prompt injection or incorrect model output. Findings require human review.

The API calls the local Ollama HTTP endpoint with a 90-second timeout. No cloud AI provider is used.
