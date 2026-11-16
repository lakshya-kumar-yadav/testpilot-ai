import type { RequestHandler } from "express";
import { verifyAccessToken } from "../auth/auth-token.js";
export const requireAuth: RequestHandler = async (request, response, next) => {
  const authorization = request.header("authorization");
  const [scheme, token] = authorization?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) {
    response.status(401).json({ error: { code: "UNAUTHORIZED", message: "A valid bearer access token is required" } });
    return;
  }
  try {
    request.authenticatedUserId = await verifyAccessToken(token);
    next();
  } catch {
    response.status(401).json({ error: { code: "UNAUTHORIZED", message: "The access token is invalid or expired" } });
  }
};
