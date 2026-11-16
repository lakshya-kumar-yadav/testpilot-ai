# Projects API

The Projects API provides authenticated project management for TestPilot AI. Every query is scoped to the user ID from the verified bearer access token; clients cannot choose or override `owner_id`.

Base path: `/api/projects`

All endpoints require:

```http
Authorization: Bearer <access-token>
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/` | Create a project |
| GET | `/` | List the authenticated user's projects |
| GET | `/:projectId` | Get one owned project |
| PATCH | `/:projectId` | Update project details or status |

## Create a project

```json
{
  "name": "Web Application QA",
  "description": "Requirements and test coverage for the web application"
}
```

The API derives `owner_id` from the authenticated token. The database creates the project with `ACTIVE` status.

## List projects

Optional query parameters:

- `status`: `ACTIVE` or `ARCHIVED`
- `limit`: integer from 1 to 100 (default 20)
- `offset`: non-negative integer (default 0)

Results are ordered newest first and include pagination metadata.

## Update or archive a project

PATCH accepts one or more of `name`, `description`, and `status`. Set `description` to `null` to clear it. Set status to `ARCHIVED` to archive a project; set it back to `ACTIVE` to restore it.

There is intentionally no permanent-delete endpoint in this foundation. Archiving preserves project-linked requirements, test cases, scripts, and execution history.

## Error responses

- `400 VALIDATION_ERROR`: invalid body, query, or project ID
- `401 UNAUTHORIZED`: missing, invalid, or expired bearer token
- `404 PROJECT_NOT_FOUND`: project does not exist or is not owned by the caller
- `500 INTERNAL_SERVER_ERROR`: unexpected server error

The API uses parameterized SQL for all database operations. Project ownership is enforced in each read and update query, not merely in the frontend.
