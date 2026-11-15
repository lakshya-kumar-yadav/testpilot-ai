-- TestPilot AI initial relational schema (PostgreSQL 16+)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 email VARCHAR(320) NOT NULL UNIQUE,
 display_name VARCHAR(120) NOT NULL,
 password_hash TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE projects (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 name VARCHAR(150) NOT NULL,
 description TEXT,
 status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_projects_owner_created ON projects(owner_id, created_at DESC);

CREATE TABLE requirements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 title VARCHAR(200) NOT NULL,
 content TEXT NOT NULL,
 source_file_name TEXT,
 status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ANALYZED','APPROVED','ARCHIVED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_requirements_project_created ON requirements(project_id, created_at DESC);

CREATE TABLE test_cases (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
 title VARCHAR(250) NOT NULL,
 description TEXT,
 preconditions TEXT,
 steps JSONB NOT NULL DEFAULT '[]'::jsonb,
 expected_result TEXT NOT NULL,
 priority VARCHAR(10) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
 test_type VARCHAR(30) NOT NULL DEFAULT 'FUNCTIONAL',
 status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','REVIEW','APPROVED','REJECTED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_test_cases_requirement ON test_cases(requirement_id);

CREATE TABLE automation_scripts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
 name VARCHAR(200) NOT NULL,
 framework VARCHAR(40) NOT NULL DEFAULT 'PLAYWRIGHT',
 language VARCHAR(20) NOT NULL DEFAULT 'TYPESCRIPT',
 source_code TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
 approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING','APPROVED','REJECTED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(test_case_id, version)
);
CREATE INDEX idx_automation_scripts_test_case ON automation_scripts(test_case_id);

CREATE TABLE test_runs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','RUNNING','PASSED','FAILED','CANCELLED')),
 started_at TIMESTAMPTZ,
 completed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK (completed_at IS NULL OR started_at IS NOT NULL)
);
CREATE INDEX idx_test_runs_project_created ON test_runs(project_id, created_at DESC);

CREATE TABLE test_results (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
 test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE RESTRICT,
 automation_script_id UUID REFERENCES automation_scripts(id) ON DELETE SET NULL,
 status VARCHAR(20) NOT NULL CHECK (status IN ('PASSED','FAILED','SKIPPED','ERROR')),
 duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
 error_message TEXT,
 artifact_path TEXT,
 executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(test_run_id, test_case_id)
);
CREATE INDEX idx_test_results_run ON test_results(test_run_id);

CREATE TABLE ai_analyses (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
 model_name VARCHAR(120) NOT NULL,
 prompt_version VARCHAR(40) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING','COMPLETED','FAILED')),
 input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
 output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
 result JSONB,
 error_message TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_analyses_requirement_created ON ai_analyses(requirement_id, created_at DESC);
