import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";
const secret = new TextEncoder().encode(env.jwtSecret);
const issuer = "testpilot-ai-api";
const audience = "testpilot-ai";
export async function createAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
}
export async function verifyAccessToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret, { issuer, audience, algorithms: ["HS256"] });
  if (!payload.sub) throw new Error("Access token subject is missing");
  return payload.sub;
}
