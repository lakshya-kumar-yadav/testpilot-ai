import test, { before, after } from "node:test";
import assert from "node:assert/strict";

// The API validates these settings at import time. HTTP middleware tests do not
// need a live database or an Ollama instance.
process.env.DATABASE_URL ??= "postgresql://testpilot:testpilot_dev_password@localhost:5432/testpilot";
process.env.JWT_SECRET ??= "test-only-secret-that-is-long-enough-for-validation";
process.env.WEB_ORIGIN ??= "http://localhost:5173";

const { app } = await import("../src/app.ts");
let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("health endpoint responds successfully and includes a request ID", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.ok(response.headers.get("x-request-id"));
});

test("unknown API routes reach the centralized 404 handler", async () => {
  const response = await fetch(`${baseUrl}/api/route-that-does-not-exist`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "NOT_FOUND");
  assert.equal(body.error.requestId, response.headers.get("x-request-id"));
});

test("protected project routes still require bearer authentication", async () => {
  const response = await fetch(`${baseUrl}/api/projects`);

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "UNAUTHORIZED");
  assert.ok(response.headers.get("x-request-id"));
});

test("malformed JSON returns a structured 400 response", async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"email":',
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "INVALID_JSON");
  assert.equal(body.error.requestId, response.headers.get("x-request-id"));
});

test("JSON bodies over the configured limit return a structured 413 response", async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: "x".repeat(1024 * 1024 + 1) }),
  });
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.equal(body.error.code, "PAYLOAD_TOO_LARGE");
  assert.equal(body.error.requestId, response.headers.get("x-request-id"));
});
