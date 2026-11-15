# Database

TestPilot AI uses PostgreSQL 16 and versioned SQL migration files. Prisma and other ORMs are not used.

## Local setup

1. Copy the root environment template: `cp .env.example .env`.
2. Start PostgreSQL: `docker compose up -d postgres`.
3. Install workspace dependencies from the repository root: `npm install`.
4. Export the `DATABASE_URL` value from your local `.env` file in the current shell. The PostgreSQL CLI does not automatically load `.env`.
5. Apply the initial migration: `npm run db:migrate`.

The `db:migrate` script currently applies `001_initial_schema.sql` to a new database. It is an initial-schema setup command, not yet a general migration runner. Apply future numbered SQL migrations with `psql` until a migration runner is introduced.

Keep future schema changes in new, numbered SQL files; never edit an already-applied migration.

## Data model

- users own projects
- projects contain requirements and test runs
- requirements contain test cases and AI analyses
- test cases can have versioned automation scripts
- test runs contain individual test results

Generated automation source is stored as data only. It must not be executed by the API or host process. Execution requires the separately isolated worker and explicit approval controls.
