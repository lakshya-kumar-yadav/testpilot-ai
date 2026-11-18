import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must contain at least 32 characters"),
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_MODEL: z.preprocess((value) => value === "" ? undefined : value, z.string().trim().min(1).default("qwen2.5:7b")),
});
const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error("Invalid API environment configuration:", parsedEnv.error.flatten().fieldErrors);
  throw new Error("API environment validation failed");
}
export const env = {
  port: parsedEnv.data.API_PORT,
  webOrigin: parsedEnv.data.WEB_ORIGIN,
  databaseUrl: parsedEnv.data.DATABASE_URL,
  jwtSecret: parsedEnv.data.JWT_SECRET,
  ollamaBaseUrl: parsedEnv.data.OLLAMA_BASE_URL,
  ollamaModel: parsedEnv.data.OLLAMA_MODEL,
};
