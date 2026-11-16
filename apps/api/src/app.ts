import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { healthRouter } from "./routes/health.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { projectsRouter } from "./routes/projects.routes.js";
import { requirementsRouter } from "./routes/requirements.routes.js";
import { documentUploadRouter } from "./routes/document-upload.routes.js";

export const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: env.webOrigin }));
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/projects", projectsRouter);
app.use("/api", requirementsRouter);
app.use("/api", documentUploadRouter);

app.use(notFoundHandler);
app.use(errorHandler);
