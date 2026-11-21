import { Router } from "express";
import { z } from "zod";
import { pool } from "../config/database.js";
import { requireAuth } from "../middleware/require-auth.js";
import { generateTestCases } from "../services/test-case-generator.js";

export const testCaseGenerationRouter = Router();
const uuidSchema = z.uuid();
type SourceRequirement = {
  id: string; title: string; content: string; status: "ANALYZED" | "APPROVED";
  current_version: number; analysis_id: string; analysis_version: number; analysis_result: unknown;
};

testCaseGenerationRouter.post("/requirements/:requirementId/test-cases/generate", requireAuth, async (request, response) => {
  const parsedId = uuidSchema.safeParse(request.params.requirementId);
  if (!parsedId.success) return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid requirement ID" } });
  const sourceResult = await pool.query<SourceRequirement>(
    `SELECT r.id, r.title, r.content, r.status, r.current_version,
            a.id AS analysis_id, a.requirement_version AS analysis_version, a.result AS analysis_result
     FROM requirements r JOIN projects p ON p.id = r.project_id
     INNER JOIN LATERAL (
       SELECT id, requirement_version, result FROM ai_analyses
       WHERE requirement_id = r.id AND status = 'COMPLETED' AND result IS NOT NULL
       ORDER BY created_at DESC LIMIT 1
     ) a ON TRUE
     WHERE r.id = $1 AND p.owner_id = $2 AND r.status IN ('ANALYZED', 'APPROVED')
       AND a.requirement_version = r.current_version`,
    [parsedId.data, request.authenticatedUserId],
  );
  const source = sourceResult.rows[0];
  if (!source) return response.status(409).json({ error: {
    code: "CURRENT_ANALYSIS_REQUIRED",
    message: "A completed analysis for the current requirement version is required before generating test cases",
  } });

  let generated: Awaited<ReturnType<typeof generateTestCases>>;
  try {
    generated = await generateTestCases(source.title, source.content, source.analysis_result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The local AI service could not generate test cases";
    const unavailable = message.includes("fetch failed") || message.includes("ECONNREFUSED") || message.includes("HTTP ");
    return response.status(unavailable ? 503 : 502).json({ error: {
      code: unavailable ? "AI_SERVICE_UNAVAILABLE" : "TEST_CASE_GENERATION_FAILED",
      message: unavailable ? "Ollama is unavailable or returned an error. Check that it is running and the configured model is installed." : message,
    } });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const unchanged = await client.query(
      `SELECT r.id FROM requirements r JOIN projects p ON p.id = r.project_id
       WHERE r.id = $1 AND p.owner_id = $2 AND r.title = $3 AND r.content = $4
         AND r.current_version = $5 AND r.status IN ('ANALYZED', 'APPROVED')
         AND EXISTS (
           SELECT 1 FROM ai_analyses a WHERE a.id = $6 AND a.requirement_id = r.id
             AND a.requirement_version = r.current_version AND a.status = 'COMPLETED' AND a.result IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM ai_analyses newer
               WHERE newer.requirement_id = r.id AND newer.status = 'COMPLETED'
                 AND newer.created_at > a.created_at
             )
         ) FOR UPDATE OF r`,
      [source.id, request.authenticatedUserId, source.title, source.content, source.current_version, source.analysis_id],
    );
    if (unchanged.rowCount === 0) {
      await client.query("ROLLBACK");
      return response.status(409).json({ error: { code: "REQUIREMENT_OR_ANALYSIS_CHANGED", message: "The requirement or its analysis changed during generation. Refresh and try again." } });
    }

    const inserted = [];
    for (const testCase of generated.testCases) {
      const result = await client.query(
        `INSERT INTO test_cases
          (requirement_id, requirement_version, title, description, preconditions, steps, expected_result, priority, test_type)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
         RETURNING id, requirement_id, requirement_version, title, description, preconditions, steps,
                   expected_result, priority, test_type, status, created_at, updated_at`,
        [source.id, source.current_version, testCase.title, testCase.description, testCase.preconditions,
         JSON.stringify(testCase.steps), testCase.expectedResult, testCase.priority, testCase.testType],
      );
      const row = result.rows[0];
      inserted.push({
        id: row.id, requirementId: row.requirement_id, requirementVersion: row.requirement_version,
        title: row.title, description: row.description, preconditions: row.preconditions,
        steps: row.steps, expectedResult: row.expected_result, priority: row.priority,
        testType: row.test_type, status: row.status, isCurrent: true,
        createdAt: row.created_at, updatedAt: row.updated_at,
      });
    }
    await client.query("COMMIT");
    return response.status(201).json({ data: {
      requirementId: source.id, requirementVersion: source.current_version,
      model: generated.modelName, promptVersion: generated.promptVersion,
      generatedCount: inserted.length, testCases: inserted, requiresHumanReview: true,
    } });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
});

const testCaseStatusSchema = z.enum(["DRAFT", "REVIEW", "APPROVED", "REJECTED"]);
testCaseGenerationRouter.get("/requirements/:requirementId/test-cases", requireAuth, async (request, response) => {
  const id = uuidSchema.safeParse(request.params.requirementId);
  if (!id.success) return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid requirement ID" } });
  const result = await pool.query(
    `SELECT tc.id, tc.requirement_id, tc.requirement_version, tc.title, tc.description, tc.preconditions,
            tc.steps, tc.expected_result, tc.priority, tc.test_type, tc.status, tc.created_at, tc.updated_at,
            (tc.requirement_version = r.current_version) AS is_current
     FROM test_cases tc JOIN requirements r ON r.id = tc.requirement_id
     JOIN projects p ON p.id = r.project_id
     WHERE r.id = $1 AND p.owner_id = $2 ORDER BY tc.created_at DESC`,
    [id.data, request.authenticatedUserId],
  );
  return response.status(200).json({ data: { testCases: result.rows.map((row) => ({
    id: row.id, requirementId: row.requirement_id, requirementVersion: row.requirement_version,
    title: row.title, description: row.description, preconditions: row.preconditions,
    steps: row.steps, expectedResult: row.expected_result, priority: row.priority,
    testType: row.test_type, status: row.status, isCurrent: row.is_current,
    createdAt: row.created_at, updatedAt: row.updated_at,
  })) } });
});

testCaseGenerationRouter.patch("/test-cases/:testCaseId", requireAuth, async (request, response) => {
  const id = uuidSchema.safeParse(request.params.testCaseId);
  if (!id.success) return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid test case ID" } });
  const parsed = z.object({ status: testCaseStatusSchema }).strict().safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A valid review status is required" } });
  const result = await pool.query(
    `UPDATE test_cases tc SET status = $1, updated_at = NOW()
     FROM requirements r, projects p
     WHERE tc.id = $2 AND r.id = tc.requirement_id AND p.id = r.project_id AND p.owner_id = $3
       AND (tc.requirement_version = r.current_version OR $1 <> 'APPROVED')
     RETURNING tc.id, tc.requirement_id, tc.requirement_version, tc.title, tc.description, tc.preconditions,
               tc.steps, tc.expected_result, tc.priority, tc.test_type, tc.status, tc.created_at, tc.updated_at`,
    [parsed.data.status, id.data, request.authenticatedUserId],
  );
  if (result.rowCount === 0) {
    const exists = await pool.query(
      `SELECT tc.id, tc.requirement_version, r.current_version FROM test_cases tc
       JOIN requirements r ON r.id = tc.requirement_id JOIN projects p ON p.id = r.project_id
       WHERE tc.id = $1 AND p.owner_id = $2`,
      [id.data, request.authenticatedUserId],
    );
    if (!exists.rows[0]) return response.status(404).json({ error: { code: "TEST_CASE_NOT_FOUND", message: "Test case not found" } });
    return response.status(409).json({ error: { code: "STALE_TEST_CASE", message: "This test case belongs to an older requirement version and cannot be approved. Regenerate it from the current version." } });
  }
  const row = result.rows[0];
  return response.status(200).json({ data: { testCase: {
    id: row.id, requirementId: row.requirement_id, requirementVersion: row.requirement_version,
    title: row.title, description: row.description, preconditions: row.preconditions,
    steps: row.steps, expectedResult: row.expected_result, priority: row.priority,
    testType: row.test_type, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
  } } });
});
