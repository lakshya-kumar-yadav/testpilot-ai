import { Router } from "express";
import rateLimit from "express-rate-limit";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { pool } from "../config/database.js";
import { createAccessToken } from "../auth/auth-token.js";
import { requireAuth } from "../middleware/require-auth.js";

export const authRouter = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false,
  message: { error: { code: "AUTH_RATE_LIMITED", message: "Too many authentication attempts. Try again later." } },
});
const registerSchema = z.object({
  email: z.string().trim().email().max(320),
  displayName: z.string().trim().min(1).max(120),
  password: z.string().min(12).max(72).refine(v => Buffer.byteLength(v, "utf8") <= 72, "Password must be at most 72 UTF-8 bytes"),
});
const loginSchema = z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(72) });
type UserRow = { id: string; email: string; display_name: string; created_at: Date };
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

authRouter.post("/register", authLimiter, async (request, response) => {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid registration details", details: parsed.error.flatten().fieldErrors } });
    return;
  }
  const email = parsed.data.email.toLowerCase();
  const passwordHash = await hash(parsed.data.password, 12);
  try {
    const result = await pool.query<UserRow>(
      "INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, display_name, created_at",
      [email, parsed.data.displayName, passwordHash],
    );
    const user = result.rows[0];
    const accessToken = await createAccessToken(user.id);
    response.status(201).json({ data: {
      user: { id: user.id, email: user.email, displayName: user.display_name, createdAt: user.created_at },
      accessToken, tokenType: "Bearer", expiresIn: 900,
    } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      response.status(409).json({ error: { code: "EMAIL_ALREADY_REGISTERED", message: "An account with this email already exists" } });
      return;
    }
    throw error;
  }
});

authRouter.post("/login", authLimiter, async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid login details" } });
    return;
  }
  const result = await pool.query<UserRow & { password_hash: string | null }>(
    "SELECT id, email, display_name, password_hash, created_at FROM users WHERE email = $1",
    [parsed.data.email.toLowerCase()],
  );
  const user = result.rows[0];
  const matches = user?.password_hash ? await compare(parsed.data.password, user.password_hash) : false;
  if (!user || !matches) {
    response.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" } });
    return;
  }
  const accessToken = await createAccessToken(user.id);
  response.status(200).json({ data: {
    user: { id: user.id, email: user.email, displayName: user.display_name, createdAt: user.created_at },
    accessToken, tokenType: "Bearer", expiresIn: 900,
  } });
});

authRouter.get("/me", requireAuth, async (request, response) => {
  const result = await pool.query<UserRow>(
    "SELECT id, email, display_name, created_at FROM users WHERE id = $1", [request.authenticatedUserId],
  );
  const user = result.rows[0];
  if (!user) {
    response.status(401).json({ error: { code: "UNAUTHORIZED", message: "The account for this access token no longer exists" } });
    return;
  }
  response.status(200).json({ data: {
    user: { id: user.id, email: user.email, displayName: user.display_name, createdAt: user.created_at },
  } });
});
