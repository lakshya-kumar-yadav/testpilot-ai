# Requirements API

The Requirements API stores source requirements inside a project. Every endpoint requires a verified bearer access token, and every query checks ownership through the parent project.

Base URL: `/api`

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/projects/:projectId/requirements` | Create a requirement |
| GET | `/projects/:projectId/requirements` | List project requirements |
| GET | `/requirements/:requirementId` | Retrieve one requirement |
| PATCH | `/requirements/:requirementId` | Update title, content, or status |

## Create a requirement

```json
{
  "title": "User login requirements",
  "content": "The user must be able to sign in with a registered email address and password.",
  "sourceFileName": null
}
```

The source file name is optional metadata. This API accepts requirement text; binary document upload and extraction will be introduced separately.

## Status lifecycle

- `DRAFT`: newly created or still being refined
- `ANALYZED`: AI analysis has completed
- `APPROVED`: reviewed and approved by a human
- `ARCHIVED`: retained for history but no longer active

The API does not allow clients to set `ANALYZED`; that transition is reserved for the analyzer workflow. Editing a requirement's title or content resets its status to `DRAFT`, invalidating any prior review. Human reviewers can set `APPROVED`, and users can archive or restore a requirement.

## Listing

Optional query parameters:

- `status`: one of the lifecycle statuses
- `limit`: 1–100 (default 20)
- `offset`: non-negative integer (default 0)

## Security and behavior

- The caller cannot submit or override a project owner ID.
- Creating a requirement is allowed only in an active project owned by the caller.
- List, read, and update operations join through `projects` and constrain by the authenticated owner.
- A missing or non-owned resource returns `404` to avoid disclosing another user's data.
- SQL values are parameterized.
- Permanent deletion is omitted so analysis history and future QA artefacts can be retained.
- Requirement content is plain text at this stage. Treat imported or user-provided content as untrusted input when it is later passed to an LLM.
