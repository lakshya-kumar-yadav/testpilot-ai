import { Router } from "express";
import { z } from "zod";
import { pool } from "../config/database.js";
import { requireAuth } from "../middleware/require-auth.js";
import { analyzeRequirement } from "../services/requirement-analyzer.js";

export const requirementAnalysisRouter = Router();
const uuidSchema = z.uuid();

requirementAnalysisRouter.post("/requirements/:requirementId/analyze", requireAuth, async (request, response) => {
  const parsedId = uuidSchema.safeParse(request.params.requirementId);
  if (!parsedId.success) return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid requirement ID" } });

  const requirementResult = await pool.query<{
    id: string; title: string; content: string; status: string; current_version: number;
  }>(
    `SELECT r.id, r.title, r.content, r.status, r.current_version
     FROM requirements r JOIN projects p ON p.id = r.project_id
     WHERE r.id = $1 AND p.owner_id = $2`,
    [parsedId.data, request.authenticatedUserId],
  );
  const requirement = requirementResult.rows[0];
  if (!requirement) return response.status(404).json({ error: { code: "REQUIREMENT_NOT_FOUND", message: "Requirement not found" } });
  if (requirement.status === "APPROVED" || requirement.status === "ARCHIVED") {
    return response.status(409).json({ error: { code: "REQUIREMENT_NOT_ANALYZABLE", message: "Only draft or previously analyzed requirements can be analyzed" } });
  }

  let result: Awaited<ReturnType<typeof analyzeRequirement>>;
  try {
    result = await analyzeRequirement(requirement.title, requirement.content);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The local AI service could not analyze this requirement";
    const unavailable = message.includes("fetch failed") || message.includes("ECONNREFUSED") || message.includes("HTTP ");
    return response.status(unavailable ? 503 : 502).json({ error: {
      code: unavailable ? "AI_SERVICE_UNAVAILABLE" : "AI_ANALYSIS_FAILED",
      message: unavailable ? "Ollama is unavailable or returned an error. Check that it is running and the configured model is installed." : message,
    } });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const statusUpdate = await client.query(
      `UPDATE requirements SET status = 'ANALYZED', updated_at = NOW()
       WHERE id = $1 AND title = $2 AND content = $3 AND current_version = $4
         AND status IN ('DRAFT', 'ANALYZED')`,
      [requirement.id, requirement.title, requirement.content, requirement.current_version],
    );
    if (statusUpdate.rowCount === 0) {
      await client.query("ROLLBACK");
      return response.status(409).json({ error: { code: "REQUIREMENT_CHANGED", message: "The requirement changed during analysis. Refresh it and run analysis again." } });
    }
    const inserted = await client.query<{ id: string; created_at: Date }>(
      `INSERT INTO ai_analyses (requirement_id, requirement_version, model_name, prompt_version, status, result)
       VALUES ($1, $2, $3, $4, 'COMPLETED', $5::jsonb) RETURNING id, created_at`,
      [requirement.id, requirement.current_version, result.modelName, result.promptVersion, JSON.stringify(result.analysis)],
    );
    await client.query("COMMIT");
    return response.status(200).json({ data: {
      analysisId: inserted.rows[0].id, requirementId: requirement.id,
      requirementVersion: requirement.current_version, status: "COMPLETED",
      model: result.modelName, createdAt: inserted.rows[0].created_at,
      analysis: result.analysis, requiresHumanReview: true,
    } });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
});

requirementAnalysisRouter.get("/requirements/:requirementId/analysis", requireAuth, async (request, response) => {
  const parsedId = uuidSchema.safeParse(request.params.requirementId);
  if (!parsedId.success) return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid requirement ID" } });
  const result = await pool.query(
    `SELECT a.id, a.requirement_version, a.model_name, a.prompt_version, a.status, a.result, a.created_at,
            r.current_version
     FROM ai_analyses a JOIN requirements r ON r.id = a.requirement_id
     JOIN projects p ON p.id = r.project_id
     WHERE r.id = $1 AND p.owner_id = $2 AND a.status = 'COMPLETED'
     ORDER BY a.created_at DESC LIMIT 1`,
    [parsedId.data, request.authenticatedUserId],
  );
  if (!result.rows[0]) return response.status(404).json({ error: { code: "ANALYSIS_NOT_FOUND", message: "No completed analysis exists for this requirement" } });
  const row = result.rows[0] as { id: string; requirement_version: number; current_version: number; model_name: string; prompt_version: string; status: string; result: unknown; created_at: Date };
  return response.status(200).json({ data: {
    analysisId: row.id, model: row.model_name, promptVersion: row.prompt_version, status: row.status,
    requirementVersion: row.requirement_version, isCurrent: row.requirement_version === row.current_version,
    analysis: row.result, createdAt: row.created_at, requiresHumanReview: true,
  } });
});
