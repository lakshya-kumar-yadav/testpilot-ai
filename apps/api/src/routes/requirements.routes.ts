import { Router } from "express";
import { z } from "zod";
import { pool } from "../config/database.js";
import { requireAuth } from "../middleware/require-auth.js";

export const requirementsRouter = Router();

const uuidSchema = z.uuid();
const requirementStatusSchema = z.enum(["DRAFT", "ANALYZED", "APPROVED", "ARCHIVED"]);

const createRequirementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(50_000),
  sourceFileName: z.string().trim().min(1).max(255).nullable().optional(),
}).strict();

const updateRequirementSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).max(50_000).optional(),
  status: z.enum(["DRAFT", "APPROVED", "ARCHIVED"]).optional(),
}).strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one requirement field must be provided",
  })
  .refine((value) => !(value.title || value.content) || !value.status || value.status === "DRAFT", {
    message: "Editing requirement content resets its status to DRAFT",
  });

const listQuerySchema = z.object({
  status: requirementStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
}).strict();

type RequirementRow = {
  id: string;
  project_id: string;
  title: string;
  content: string;
  source_file_name: string | null;
  status: "DRAFT" | "ANALYZED" | "APPROVED" | "ARCHIVED";
  created_at: Date;
  updated_at: Date;
};

function toRequirement(row: RequirementRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    content: row.content,
    sourceFileName: row.source_file_name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validationError(response: Parameters<import("express").RequestHandler>[1], message: string, details?: unknown) {
  response.status(400).json({
    error: { code: "VALIDATION_ERROR", message, ...(details ? { details } : {}) },
  });
}

requirementsRouter.use(requireAuth);

// Create a requirement only when the project belongs to the authenticated user.
requirementsRouter.post("/projects/:projectId/requirements", async (request, response) => {
  const projectId = uuidSchema.safeParse(request.params.projectId);
  if (!projectId.success) {
    validationError(response, "Invalid project ID");
    return;
  }
  const parsed = createRequirementSchema.safeParse(request.body);
  if (!parsed.success) {
    validationError(response, "Invalid requirement details", parsed.error.flatten().fieldErrors);
    return;
  }

  const result = await pool.query<RequirementRow>(
    `INSERT INTO requirements (project_id, title, content, source_file_name)
     SELECT id, $3, $4, $5
     FROM projects
     WHERE id = $1 AND owner_id = $2 AND status = 'ACTIVE'
     RETURNING id, project_id, title, content, source_file_name, status, created_at, updated_at`,
    [projectId.data, request.authenticatedUserId, parsed.data.title, parsed.data.content, parsed.data.sourceFileName ?? null],
  );

  if (result.rowCount === 0) {
    response.status(404).json({ error: { code: "PROJECT_NOT_FOUND", message: "Active project not found" } });
    return;
  }

  response.status(201).json({ data: { requirement: toRequirement(result.rows[0]) } });
});

// List requirements only for a project owned by the authenticated user.
requirementsRouter.get("/projects/:projectId/requirements", async (request, response) => {
  const projectId = uuidSchema.safeParse(request.params.projectId);
  if (!projectId.success) {
    validationError(response, "Invalid project ID");
    return;
  }
  const parsed = listQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    validationError(response, "Invalid requirement filters", parsed.error.flatten().fieldErrors);
    return;
  }

  const { status, limit, offset } = parsed.data;
  const result = await pool.query<RequirementRow>(
    `SELECT r.id, r.project_id, r.title, r.content, r.source_file_name, r.status, r.created_at, r.updated_at
     FROM requirements r
     INNER JOIN projects p ON p.id = r.project_id
     WHERE p.id = $1 AND p.owner_id = $2
       AND ($3::varchar IS NULL OR r.status = $3)
     ORDER BY r.created_at DESC
     LIMIT $4 OFFSET $5`,
    [projectId.data, request.authenticatedUserId, status ?? null, limit, offset],
  );

  response.status(200).json({
    data: {
      requirements: result.rows.map(toRequirement),
      pagination: { limit, offset, count: result.rowCount ?? result.rows.length },
    },
  });
});

// Fetch one requirement, checking project ownership in the same query.
requirementsRouter.get("/requirements/:requirementId", async (request, response) => {
  const requirementId = uuidSchema.safeParse(request.params.requirementId);
  if (!requirementId.success) {
    validationError(response, "Invalid requirement ID");
    return;
  }

  const result = await pool.query<RequirementRow>(
    `SELECT r.id, r.project_id, r.title, r.content, r.source_file_name, r.status, r.created_at, r.updated_at
     FROM requirements r
     INNER JOIN projects p ON p.id = r.project_id
     WHERE r.id = $1 AND p.owner_id = $2`,
    [requirementId.data, request.authenticatedUserId],
  );

  if (result.rowCount === 0) {
    response.status(404).json({ error: { code: "REQUIREMENT_NOT_FOUND", message: "Requirement not found" } });
    return;
  }

  response.status(200).json({ data: { requirement: toRequirement(result.rows[0]) } });
});

// Update only requirements belonging to the authenticated user's projects.
requirementsRouter.patch("/requirements/:requirementId", async (request, response) => {
  const requirementId = uuidSchema.safeParse(request.params.requirementId);
  if (!requirementId.success) {
    validationError(response, "Invalid requirement ID");
    return;
  }
  const parsed = updateRequirementSchema.safeParse(request.body);
  if (!parsed.success) {
    validationError(response, "Invalid requirement updates", parsed.error.flatten().fieldErrors);
    return;
  }

  const result = await pool.query<RequirementRow>(
    `UPDATE requirements r
     SET title = COALESCE($1, r.title),
         content = COALESCE($2, r.content),
         status = CASE WHEN $1 IS NOT NULL OR $2 IS NOT NULL THEN 'DRAFT' ELSE COALESCE($3, r.status) END,
         updated_at = NOW()
     FROM projects p
     WHERE r.id = $4 AND p.id = r.project_id AND p.owner_id = $5
     RETURNING r.id, r.project_id, r.title, r.content, r.source_file_name, r.status, r.created_at, r.updated_at`,
    [
      parsed.data.title ?? null,
      parsed.data.content ?? null,
      parsed.data.status ?? null,
      requirementId.data,
      request.authenticatedUserId,
    ],
  );

  if (result.rowCount === 0) {
    response.status(404).json({ error: { code: "REQUIREMENT_NOT_FOUND", message: "Requirement not found" } });
    return;
  }

  response.status(200).json({ data: { requirement: toRequirement(result.rows[0]) } });
});
