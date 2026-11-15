# Database

TestPilot AI uses PostgreSQL 16 and versioned SQL migration files. Prisma and other ORMs are not used.

## Local setup

1. Copy the root environment template: `cp .env.example .env`.
2. Start PostgreSQL: `docker compose up -d postgres`.
3. Install the API PostgreSQL driver: `npm install pg -w apps/api`.
4. Apply the initial migration:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/001_initial_schema.sql
```

Apply this initial migration once to a new database. Keep future schema changes in new, numbered SQL files; never edit an already-applied migration.

## Data model

- users own projects
- projects contain requirements and test runs
- requirements contain test cases and AI analyses
- test cases can have versioned automation scripts
- test runs contain individual test results

Generated automation source is stored as data only. It must not be executed by the API or host process. Execution requires the separately isolated worker and explicit approval controls.
