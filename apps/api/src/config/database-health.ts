import { pool } from "./database.js";

export async function checkDatabaseConnection(): Promise<boolean> {
  const result = await pool.query<{ ok: number }>("SELECT 1 AS ok");
  return result.rows[0]?.ok === 1;
}
