import "dotenv/config";
import cors from "cors";
import express from "express";

const app = express();
const port = Number(process.env.API_PORT ?? 4000);

app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "testpilot-api",
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`TestPilot AI API listening on http://localhost:${port}`);
});
