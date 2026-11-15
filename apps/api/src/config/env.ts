import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
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
};
