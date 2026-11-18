import { Router } from "express";
import { z } from "zod";
import { pool } from "../config/database.js";
import { requireAuth } from "../middleware/require-auth.js";
import { generateTestCases } from "../services/test-case-generator.js";

export const testCaseGenerationRouter = Router();
const uuidSchema = z.uuid();

type SourceRequirement = {
  id: string;
  title: string;
  content: string;
  status: "ANALYZED" | "APPROVED";
  analysis_id: string;
  analysis_result: unknown;
};

testCaseGenerationRouter.use(requireAuth);

testCaseGenerationRouter.post("/requirements/:requirementId/test-cases/generate", async (request, response) => {
  const parsedId = uuidSchema.safeParse(request.params.requirementId);
  if (!parsedId.success) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid requirement ID" } });
    return;
  }

  const sourceResult = await pool.query<SourceRequirement>(
    `SELECT r.id, r.title, r.content, r.status, a.id AS analysis_id, a.result AS analysis_result
     FROM requirements r
     INNER JOIN projects p ON p.id = r.project_id
     INNER JOIN LATERAL (
       SELECT id, result
       FROM ai_analyses
       WHERE requirement_id = r.id AND status = 'COMPLETED' AND result IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1
     ) a ON TRUE
     WHERE r.id = $1 AND p.owner_id = $2 AND r.status IN ('ANALYZED', 'APPROVED')`,
    [parsedId.data, request.authenticatedUserId],
  );

  const source = sourceResult.rows[0];
  if (!source) {
    response.status(409).json({
      error: {
        code: "ANALYZED_REQUIREMENT_REQUIRED",
        message: "A saved requirement with a completed AI analysis is required before generating test cases",
      },
    });
    return;
  }

  let generated: Awaited<ReturnType<typeof generateTestCases>>;
  try {
    generated = await generateTestCases(source.title, source.content, source.analysis_result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The local AI service could not generate test cases";
    const unavailable = message.includes("fetch failed") || message.includes("ECONNREFUSED") || message.includes("HTTP ");
    response.status(unavailable ? 503 : 502).json({
      error: {
        code: unavailable ? "AI_SERVICE_UNAVAILABLE" : "TEST_CASE_GENERATION_FAILED",
        message: unavailable ? "Ollama is unavailable or returned an error. Check that it is running and the configured model is installed." : message,
      },
    });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const unchanged = await client.query(
      `SELECT r.id
       FROM requirements r
       INNER JOIN projects p ON p.id = r.project_id
       WHERE r.id = $1 AND p.owner_id = $2
         AND r.title = $3 AND r.content = $4
         AND r.status IN ('ANALYZED', 'APPROVED')
         AND EXISTS (
           SELECT 1 FROM ai_analyses a
           WHERE a.id = $5 AND a.requirement_id = r.id
             AND a.status = 'COMPLETED' AND a.result IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM ai_analyses newer
               WHERE newer.requirement_id = r.id AND newer.status = 'COMPLETED'
                 AND newer.created_at > a.created_at
             )
         )
       FOR UPDATE OF r`,
      [source.id, request.authenticatedUserId, source.title, source.content, source.analysis_id],
    );

    if (unchanged.rowCount === 0) {
      await client.query("ROLLBACK");
      response.status(409).json({
        error: { code: "REQUIREMENT_OR_ANALYSIS_CHANGED", message: "The requirement or its analysis changed during generation. Refresh and try again." },
      });
      return;
    }

    const inserted = [];
    for (const testCase of generated.testCases) {
      const result = await client.query(
        `INSERT INTO test_cases
          (requirement_id, title, description, preconditions, steps, expected_result, priority, test_type)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
         RETURNING id, requirement_id, title, description, preconditions, steps,
                   expected_result, priority, test_type, status, created_at, updated_at`,
        [
          source.id,
          testCase.title,
          testCase.description,
          testCase.preconditions,
          JSON.stringify(testCase.steps),
          testCase.expectedResult,
          testCase.priority,
          testCase.testType,
        ],
      );
      const row = result.rows[0];
      inserted.push({
        id: row.id,
        requirementId: row.requirement_id,
        title: row.title,
        description: row.description,
        preconditions: row.preconditions,
        steps: row.steps,
        expectedResult: row.expected_result,
        priority: row.priority,
        testType: row.test_type,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    await client.query("COMMIT");
    response.status(201).json({
      data: {
        requirementId: source.id,
        model: generated.modelName,
        promptVersion: generated.promptVersion,
        generatedCount: inserted.length,
        testCases: inserted,
        requiresHumanReview: true,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
