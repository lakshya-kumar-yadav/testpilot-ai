import type { RequestHandler } from "express";

export const notFoundHandler: RequestHandler = (request, response) => {
  const requestId = response.getHeader("X-Request-Id");
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route not found: ${request.method} ${request.path}`,
      ...(typeof requestId === "string" ? { requestId } : {}),
    },
  });
};
