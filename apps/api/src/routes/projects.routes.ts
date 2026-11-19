import { Router } from "express";
import { z } from "zod";
import { pool } from "../config/database.js";
import { requireAuth } from "../middleware/require-auth.js";

export const projectsRouter = Router();

const projectStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);
const projectIdSchema = z.uuid();

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(5_000).nullable().optional(),
}).strict();

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(5_000).nullable().optional(),
  status: projectStatusSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one project field must be provided",
});

const listProjectsQuerySchema = z.object({
  status: projectStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
}).strict();

type ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  created_at: Date;
  updated_at: Date;
};

function toProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

projectsRouter.post("/", requireAuth, async (request, response) => {
  const parsed = createProjectSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid project details",
        details: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const result = await pool.query<ProjectRow>(
    `INSERT INTO projects (owner_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING id, owner_id, name, description, status, created_at, updated_at`,
    [request.authenticatedUserId, parsed.data.name, parsed.data.description ?? null],
  );

  response.status(201).json({ data: { project: toProject(result.rows[0]) } });
});

projectsRouter.get("/", requireAuth, async (request, response) => {
  const parsed = listProjectsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid project filters",
        details: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { status, limit, offset } = parsed.data;
  const result = await pool.query<ProjectRow>(
    `SELECT id, owner_id, name, description, status, created_at, updated_at
     FROM projects
     WHERE owner_id = $1 AND ($2::varchar IS NULL OR status = $2)
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [request.authenticatedUserId, status ?? null, limit, offset],
  );

  response.status(200).json({
    data: {
      projects: result.rows.map(toProject),
      pagination: { limit, offset, count: result.rowCount ?? result.rows.length },
    },
  });
});

projectsRouter.get("/:projectId", requireAuth, async (request, response) => {
  const parsedId = projectIdSchema.safeParse(request.params.projectId);
  if (!parsedId.success) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid project ID" } });
    return;
  }

  const result = await pool.query<ProjectRow>(
    `SELECT id, owner_id, name, description, status, created_at, updated_at
     FROM projects WHERE id = $1 AND owner_id = $2`,
    [parsedId.data, request.authenticatedUserId],
  );

  if (result.rowCount === 0) {
    response.status(404).json({ error: { code: "PROJECT_NOT_FOUND", message: "Project not found" } });
    return;
  }

  response.status(200).json({ data: { project: toProject(result.rows[0]) } });
});

projectsRouter.patch("/:projectId", requireAuth, async (request, response) => {
  const parsedId = projectIdSchema.safeParse(request.params.projectId);
  if (!parsedId.success) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid project ID" } });
    return;
  }

  const parsed = updateProjectSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid project updates",
        details: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const hasDescription = Object.prototype.hasOwnProperty.call(parsed.data, "description");
  const result = await pool.query<ProjectRow>(
    `UPDATE projects
     SET name = COALESCE($1, name),
         description = CASE WHEN $2::boolean THEN $3 ELSE description END,
         status = COALESCE($4, status),
         updated_at = NOW()
     WHERE id = $5 AND owner_id = $6
     RETURNING id, owner_id, name, description, status, created_at, updated_at`,
    [
      parsed.data.name ?? null,
      hasDescription,
      parsed.data.description ?? null,
      parsed.data.status ?? null,
      parsedId.data,
      request.authenticatedUserId,
    ],
  );

  if (result.rowCount === 0) {
    response.status(404).json({ error: { code: "PROJECT_NOT_FOUND", message: "Project not found" } });
    return;
  }

  response.status(200).json({ data: { project: toProject(result.rows[0]) } });
});
