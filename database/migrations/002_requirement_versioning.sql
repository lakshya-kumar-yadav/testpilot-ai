-- Requirement snapshots and source-version traceability.
BEGIN;

ALTER TABLE requirements
  ADD COLUMN current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version > 0);

CREATE TABLE requirement_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  source_file_name TEXT,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (requirement_id, version)
);
CREATE INDEX idx_requirement_versions_history
  ON requirement_versions(requirement_id, version DESC);

INSERT INTO requirement_versions (requirement_id, version, title, content, source_file_name, change_summary)
SELECT id, 1, title, content, source_file_name, 'Initial version (existing requirement)'
FROM requirements;

ALTER TABLE ai_analyses
  ADD COLUMN requirement_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE test_cases
  ADD COLUMN requirement_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE ai_analyses
  ADD CONSTRAINT fk_ai_analyses_requirement_version
  FOREIGN KEY (requirement_id, requirement_version)
  REFERENCES requirement_versions(requirement_id, version);
ALTER TABLE test_cases
  ADD CONSTRAINT fk_test_cases_requirement_version
  FOREIGN KEY (requirement_id, requirement_version)
  REFERENCES requirement_versions(requirement_id, version);

CREATE INDEX idx_ai_analyses_requirement_version
  ON ai_analyses(requirement_id, requirement_version, created_at DESC);
CREATE INDEX idx_test_cases_requirement_version
  ON test_cases(requirement_id, requirement_version, created_at DESC);

COMMIT;
