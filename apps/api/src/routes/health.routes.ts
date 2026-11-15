import { Router } from "express";
import { checkDatabaseConnection } from "../config/database-health.js";

export const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "testpilot-api",
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get("/ready", async (_request, response) => {
  try {
    const databaseConnected = await checkDatabaseConnection();

    if (!databaseConnected) {
      response.status(503).json({
        status: "error",
        service: "testpilot-api",
        dependencies: { database: "unavailable" },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    response.status(200).json({
      status: "ok",
      service: "testpilot-api",
      dependencies: { database: "connected" },
      timestamp: new Date().toISOString(),
    });
  } catch {
    response.status(503).json({
      status: "error",
      service: "testpilot-api",
      dependencies: { database: "unavailable" },
      timestamp: new Date().toISOString(),
    });
  }
});
