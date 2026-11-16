# Web application: authentication and projects

The React application now connects to the Express API for account registration, login, session restoration, and project management.

## Run locally

1. Start PostgreSQL and apply the initial database migration.
2. Configure the API environment, including `DATABASE_URL` and a strong `JWT_SECRET`.
3. Start the API on port 4000.
4. Start the web workspace with `npm run dev --workspace @testpilot/web` (Vite uses port 5173).

Optional frontend setting:

```bash
VITE_API_BASE_URL=http://localhost:4000
```

The API must allow the configured web origin through `WEB_ORIGIN`.

## Implemented screens

- Registration and sign-in forms with API validation feedback.
- Protected dashboard and session restoration through `GET /api/auth/me`.
- Project listing, creation, status filtering, archiving, and restoring.
- Loading, empty, success, and error states.

## Token storage note

For this initial browser integration, the short-lived 15-minute access token is stored in `sessionStorage`, which is cleared when the browser tab session ends. JavaScript-accessible storage is exposed to successful XSS; production hardening should move authentication to secure, HttpOnly, SameSite cookies and add a CSRF strategy before deployment.

The frontend does not treat client-side route protection as authorization. The API remains responsible for verifying every access token and enforcing project ownership.
