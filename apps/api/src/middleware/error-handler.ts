import type { ErrorRequestHandler, Response } from "express";

type BodyParserError = Error & { type?: string };

function requestIdFrom(response: Response): string | undefined {
  const value = response.getHeader("X-Request-Id");
  return typeof value === "string" ? value : undefined;
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  const requestId = requestIdFrom(response);
  const parserError = error as BodyParserError;

  if (parserError?.type === "entity.parse.failed") {
    response.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "The request body contains invalid JSON",
        ...(requestId ? { requestId } : {}),
      },
    });
    return;
  }

  if (parserError?.type === "entity.too.large") {
    response.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "The request body exceeds the maximum allowed size",
        ...(requestId ? { requestId } : {}),
      },
    });
    return;
  }

  console.error("Unhandled API error:", { requestId, error });
  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      ...(requestId ? { requestId } : {}),
    },
  });
};
