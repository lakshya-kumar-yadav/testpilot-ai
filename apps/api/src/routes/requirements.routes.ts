import { Router } from "express";
import { z } from "zod";
import { pool } from "../config/database.js";
import { requireAuth } from "../middleware/require-auth.js";

export const requirementsRouter = Router();
const uuidSchema = z.uuid();
const requirementStatusSchema = z.enum(["DRAFT", "ANALYZED", "APPROVED", "ARCHIVED"]);
const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(50_000),
  sourceFileName: z.string().trim().min(1).max(255).nullable().optional(),
}).strict();
const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).max(50_000).optional(),
  status: z.enum(["DRAFT", "APPROVED", "ARCHIVED"]).optional(),
}).strict()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one requirement field must be provided" })
  .refine((v) => !(v.title || v.content) || !v.status || v.status === "DRAFT", {
    message: "Editing requirement content resets its status to DRAFT",
  });
const listSchema = z.object({
  status: requirementStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
}).strict();

type RequirementRow = {
  id: string; project_id: string; title: string; content: string; source_file_name: string | null;
  status: "DRAFT" | "ANALYZED" | "APPROVED" | "ARCHIVED"; current_version: number;
  created_at: Date; updated_at: Date;
};
function toRequirement(row: RequirementRow) {
  return {
    id: row.id, projectId: row.project_id, title: row.title, content: row.content,
    sourceFileName: row.source_file_name, status: row.status, currentVersion: row.current_version,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
function validationError(response: Parameters<import("express").RequestHandler>[1], message: string, details?: unknown) {
  response.status(400).json({ error: { code: "VALIDATION_ERROR", message, ...(details ? { details } : {}) } });
}

requirementsRouter.post("/projects/:projectId/requirements", requireAuth, async (request, response) => {
  const projectId = uuidSchema.safeParse(request.params.projectId);
  if (!projectId.success) return validationError(response, "Invalid project ID");
  const parsed = createSchema.safeParse(request.body);
  if (!parsed.success) return validationError(response, "Invalid requirement details", parsed.error.flatten().fieldErrors);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<RequirementRow>(
      `INSERT INTO requirements (project_id, title, content, source_file_name)
       SELECT id, $3, $4, $5 FROM projects
       WHERE id = $1 AND owner_id = $2 AND status = 'ACTIVE'
       RETURNING id, project_id, title, content, source_file_name, status, current_version, created_at, updated_at`,
      [projectId.data, request.authenticatedUserId, parsed.data.title, parsed.data.content, parsed.data.sourceFileName ?? null],
    );
    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return response.status(404).json({ error: { code: "PROJECT_NOT_FOUND", message: "Active project not found" } });
    }
    const row = result.rows[0];
    await client.query(
      `INSERT INTO requirement_versions (requirement_id, version, title, content, source_file_name, changed_by, change_summary)
       VALUES ($1, 1, $2, $3, $4, $5, 'Initial version')`,
      [row.id, row.title, row.content, row.source_file_name, request.authenticatedUserId],
    );
    await client.query("COMMIT");
    return response.status(201).json({ data: { requirement: toRequirement(row) } });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
});

requirementsRouter.get("/projects/:projectId/requirements", requireAuth, async (request, response) => {
  const projectId = uuidSchema.safeParse(request.params.projectId);
  if (!projectId.success) return validationError(response, "Invalid project ID");
  const parsed = listSchema.safeParse(request.query);
  if (!parsed.success) return validationError(response, "Invalid requirement filters", parsed.error.flatten().fieldErrors);
  const { status, limit, offset } = parsed.data;
  const result = await pool.query<RequirementRow>(
    `SELECT r.id, r.project_id, r.title, r.content, r.source_file_name, r.status, r.current_version, r.created_at, r.updated_at
     FROM requirements r JOIN projects p ON p.id = r.project_id
     WHERE p.id = $1 AND p.owner_id = $2 AND ($3::varchar IS NULL OR r.status = $3)
     ORDER BY r.created_at DESC LIMIT $4 OFFSET $5`,
    [projectId.data, request.authenticatedUserId, status ?? null, limit, offset],
  );
  return response.status(200).json({ data: {
    requirements: result.rows.map(toRequirement),
    pagination: { limit, offset, count: result.rowCount ?? result.rows.length },
  } });
});

requirementsRouter.get("/requirements/:requirementId", requireAuth, async (request, response) => {
  const id = uuidSchema.safeParse(request.params.requirementId);
  if (!id.success) return validationError(response, "Invalid requirement ID");
  const result = await pool.query<RequirementRow>(
    `SELECT r.id, r.project_id, r.title, r.content, r.source_file_name, r.status, r.current_version, r.created_at, r.updated_at
     FROM requirements r JOIN projects p ON p.id = r.project_id WHERE r.id = $1 AND p.owner_id = $2`,
    [id.data, request.authenticatedUserId],
  );
  if (!result.rows[0]) return response.status(404).json({ error: { code: "REQUIREMENT_NOT_FOUND", message: "Requirement not found" } });
  return response.status(200).json({ data: { requirement: toRequirement(result.rows[0]) } });
});

// Return immutable snapshots in descending version order.
requirementsRouter.get("/requirements/:requirementId/versions", requireAuth, async (request, response) => {
  const id = uuidSchema.safeParse(request.params.requirementId);
  if (!id.success) return validationError(response, "Invalid requirement ID");
  const result = await pool.query(
    `SELECT v.version, v.title, v.content, v.source_file_name, v.change_summary, v.created_at,
            u.display_name AS changed_by
     FROM requirement_versions v
     JOIN requirements r ON r.id = v.requirement_id
     JOIN projects p ON p.id = r.project_id
     LEFT JOIN users u ON u.id = v.changed_by
     WHERE r.id = $1 AND p.owner_id = $2
     ORDER BY v.version DESC`,
    [id.data, request.authenticatedUserId],
  );
  if (result.rowCount === 0) {
    const exists = await pool.query(
      `SELECT 1 FROM requirements r JOIN projects p ON p.id = r.project_id WHERE r.id = $1 AND p.owner_id = $2`,
      [id.data, request.authenticatedUserId],
    );
    if (exists.rowCount === 0) return response.status(404).json({ error: { code: "REQUIREMENT_NOT_FOUND", message: "Requirement not found" } });
  }
  return response.status(200).json({ data: { versions: result.rows } });
});

requirementsRouter.patch("/requirements/:requirementId", requireAuth, async (request, response) => {
  const id = uuidSchema.safeParse(request.params.requirementId);
  if (!id.success) return validationError(response, "Invalid requirement ID");
  const parsed = updateSchema.safeParse(request.body);
  if (!parsed.success) return validationError(response, "Invalid requirement updates", parsed.error.flatten().fieldErrors);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<RequirementRow>(
      `SELECT r.id, r.project_id, r.title, r.content, r.source_file_name, r.status, r.current_version, r.created_at, r.updated_at
       FROM requirements r JOIN projects p ON p.id = r.project_id
       WHERE r.id = $1 AND p.owner_id = $2 FOR UPDATE OF r`,
      [id.data, request.authenticatedUserId],
    );
    const previous = current.rows[0];
    if (!previous) {
      await client.query("ROLLBACK");
      return response.status(404).json({ error: { code: "REQUIREMENT_NOT_FOUND", message: "Requirement not found" } });
    }

    const title = parsed.data.title ?? previous.title;
    const content = parsed.data.content ?? previous.content;
    const contentChanged = title !== previous.title || content !== previous.content;
    const nextVersion = contentChanged ? previous.current_version + 1 : previous.current_version;
    const updated = await client.query<RequirementRow>(
      `UPDATE requirements r SET title = $1, content = $2,
         status = CASE WHEN $5 THEN 'DRAFT' ELSE COALESCE($3, r.status) END,
         current_version = $4, updated_at = NOW()
       WHERE r.id = $6
       RETURNING r.id, r.project_id, r.title, r.content, r.source_file_name, r.status, r.current_version, r.created_at, r.updated_at`,
      [title, content, parsed.data.status ?? null, nextVersion, contentChanged, id.data],
    );
    if (contentChanged) {
      await client.query(
        `INSERT INTO requirement_versions
          (requirement_id, version, title, content, source_file_name, changed_by, change_summary)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id.data, nextVersion, title, content, previous.source_file_name, request.authenticatedUserId,
          [parsed.data.title !== undefined && title !== previous.title ? "Title updated" : null,
           parsed.data.content !== undefined && content !== previous.content ? "Content updated" : null].filter(Boolean).join("; ")],
      );
    }
    await client.query("COMMIT");
    return response.status(200).json({ data: { requirement: toRequirement(updated.rows[0]) } });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
});
