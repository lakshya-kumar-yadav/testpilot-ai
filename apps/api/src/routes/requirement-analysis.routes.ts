import { Router } from "express";
import { z } from "zod";
import { pool } from "../config/database.js";
import { requireAuth } from "../middleware/require-auth.js";
import { analyzeRequirement } from "../services/requirement-analyzer.js";

export const requirementAnalysisRouter = Router();
const uuidSchema = z.uuid();

requirementAnalysisRouter.use(requireAuth);

requirementAnalysisRouter.post("/requirements/:requirementId/analyze", async (request, response) => {
  const parsedId = uuidSchema.safeParse(request.params.requirementId);
  if (!parsedId.success) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid requirement ID" } });
    return;
  }

  const requirementResult = await pool.query<{
    id: string;
    title: string;
    content: string;
    status: string;
  }>(
    `SELECT r.id, r.title, r.content, r.status
     FROM requirements r
     INNER JOIN projects p ON p.id = r.project_id
     WHERE r.id = $1 AND p.owner_id = $2`,
    [parsedId.data, request.authenticatedUserId],
  );

  const requirement = requirementResult.rows[0];
  if (!requirement) {
    response.status(404).json({ error: { code: "REQUIREMENT_NOT_FOUND", message: "Requirement not found" } });
    return;
  }
  if (requirement.status === "APPROVED" || requirement.status === "ARCHIVED") {
    response.status(409).json({
      error: { code: "REQUIREMENT_NOT_ANALYZABLE", message: "Only draft or previously analyzed requirements can be analyzed" },
    });
    return;
  }

  let result: Awaited<ReturnType<typeof analyzeRequirement>>;
  try {
    result = await analyzeRequirement(requirement.title, requirement.content);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The local AI service could not analyze this requirement";
    const unavailable = message.includes("fetch failed") || message.includes("ECONNREFUSED") || message.includes("HTTP ");
    response.status(unavailable ? 503 : 502).json({
      error: {
        code: unavailable ? "AI_SERVICE_UNAVAILABLE" : "AI_ANALYSIS_FAILED",
        message: unavailable ? "Ollama is unavailable or returned an error. Check that it is running and the configured model is installed." : message,
      },
    });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const analysisInsert = await client.query<{ id: string; created_at: Date }>(
      `INSERT INTO ai_analyses (requirement_id, model_name, prompt_version, status, result)
       VALUES ($1, $2, $3, 'COMPLETED', $4::jsonb)
       RETURNING id, created_at`,
      [requirement.id, result.modelName, result.promptVersion, JSON.stringify(result.analysis)],
    );
    await client.query(
      "UPDATE requirements SET status = 'ANALYZED', updated_at = NOW() WHERE id = $1",
      [requirement.id],
    );
    await client.query("COMMIT");

    response.status(200).json({
      data: {
        analysisId: analysisInsert.rows[0].id,
        requirementId: requirement.id,
        status: "COMPLETED",
        model: result.modelName,
        createdAt: analysisInsert.rows[0].created_at,
        analysis: result.analysis,
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
