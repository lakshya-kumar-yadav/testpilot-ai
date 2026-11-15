import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./config/database.js";

const server = app.listen(env.port, () => {
  console.log(`TestPilot AI API listening on http://localhost:${env.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received. Shutting down API...`);

  server.close(async (error) => {
    if (error) {
      console.error("Error while closing the HTTP server:", error);
      process.exitCode = 1;
    }

    try {
      await pool.end();
    } catch (poolError) {
      console.error("Error while closing the PostgreSQL pool:", poolError);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
