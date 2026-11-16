# Authentication

TestPilot AI provides email/password registration, login, and authenticated user lookup through short-lived bearer access tokens.

## Endpoints

| Method | Endpoint | Authentication | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public, rate limited | Create an account |
| POST | `/api/auth/login` | Public, rate limited | Verify credentials and issue an access token |
| GET | `/api/auth/me` | Bearer token | Return the authenticated user's profile |

## Local configuration

Set `DATABASE_URL` and `JWT_SECRET` in the API environment. Generate a unique secret using a cryptographically secure random generator:

```bash
openssl rand -base64 48
```

Never commit a real `.env` file or production secret. The value in `.env.example` is only a placeholder and must be replaced.

## Security notes

- Passwords are hashed with bcrypt (12 rounds); plaintext passwords are never stored or returned.
- Passwords are limited to 72 UTF-8 bytes to prevent bcrypt truncation.
- Access tokens use HS256, issuer and audience claims, and expire after 15 minutes.
- Registration and login share a limit of 10 requests per IP per 15 minutes.
- Login uses the same error for unknown email and incorrect password.
- Email addresses are trimmed and normalized to lowercase.
- SQL statements use positional parameters; profile responses never include password hashes.
- Protected handlers derive identity from a verified token, never a client-supplied user ID.

## Current scope

Refresh tokens, server-side session revocation, email verification, password reset, and multi-factor authentication are not implemented. Before production deployment, add a persistent session/refresh-token design, HTTPS, monitoring, and automated security tests.

Project routes must use the verified `request.authenticatedUserId` and scope every project query by `owner_id`.
