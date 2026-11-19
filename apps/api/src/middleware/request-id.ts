import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

/**
 * Assign a server-generated identifier to every request.
 * The identifier is returned in the response header for support and log correlation.
 */
export const requestIdMiddleware: RequestHandler = (_request, response, next) => {
  response.setHeader("X-Request-Id", randomUUID());
  next();
};
