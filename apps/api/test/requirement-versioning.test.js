
import test, { before, after } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL =
  process.env.DATABASE_URL?.replace("?schema=public", "") ??
  "postgresql://testpilot:testpilot_dev_password@localhost:5432/testpilot";

process.env.JWT_SECRET ??=
  "test-only-secret-that-is-long-enough-for-validation";

process.env.WEB_ORIGIN ??= "http://localhost:5173";

const { app } = await import("../src/app.ts");
const { pool } = await import("../src/config/database.ts");
const { createAccessToken } = await import("../src/auth/auth-token.ts");

let server;
let baseUrl;
let originalFetch;

before(async () => {
  server = app.listen(0);

  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Mock only Ollama calls. API requests still use the real fetch.
  originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));

    if (url.hostname === "localhost" && url.port === "11434" &&
        url.pathname === "/api/generate") {
      const prompt = JSON.parse(init.body).prompt;

      const response = prompt.includes("software requirements analyst")
        ? {
            summary: "The requirement describes a login feature.",
            functionalRequirements: [],
            nonFunctionalRequirements: [],
            ambiguities: [],
            missingInformation: [],
            conflicts: [],
            overallAssessment: "GOOD",
            recommendations: ["Validate login credentials."],
          }
        : {
            testCases: [{
              title: "Verify successful login",
              description: "Verify a valid user can log in.",
              preconditions: "A registered user exists.",
              steps: [{
                action: "Enter valid credentials and submit.",
                expectedResult: "The user is authenticated.",
              }],
              expectedResult: "The user reaches the dashboard.",
              priority: "HIGH",
              testType: "FUNCTIONAL",
            }],
          };

      return new Response(
        JSON.stringify({ response: JSON.stringify(response) }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    return originalFetch(input, init);
  };
});

after(async () => {
  globalThis.fetch = originalFetch;

  if (server) {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }

  await pool.end();
});

test("requirement versioning and AI traceability work end-to-end", async () => {
  let userId;
  let projectId;

  try {
    // Create an isolated test user and project.
    const userResult = await pool.query(
      `INSERT INTO users (email, display_name)
       VALUES ($1, $2) RETURNING id`,
      [`version-test-${Date.now()}@example.test`, "Version Test User"],
    );

    userId = userResult.rows[0].id;

    const projectResult = await pool.query(
      `INSERT INTO projects (owner_id, name)
       VALUES ($1, $2) RETURNING id`,
      [userId, "Requirement Versioning Integration Test"],
    );

    projectId = projectResult.rows[0].id;

    const token = await createAccessToken(userId);

    const request = async (path, options = {}) => {
      const response = await originalFetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          ...options.headers,
        },
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    };

    // 1. Creating a requirement creates version 1.
    const created = await request(
      `/api/projects/${projectId}/requirements`,
      {
        method: "POST",
        body: JSON.stringify({
          title: "User login",
          content: "Users must be able to log in using valid credentials.",
        }),
      },
    );

    assert.equal(created.status, 201);

    const requirementId = created.body.data.requirement.id;

    assert.equal(
      created.body.data.requirement.currentVersion,
      1,
    );

    const initialHistory = await request(
      `/api/requirements/${requirementId}/versions`,
    );

    assert.equal(initialHistory.status, 200);
    assert.equal(initialHistory.body.data.versions.length, 1);
    assert.equal(initialHistory.body.data.versions[0].version, 1);
    assert.equal(initialHistory.body.data.versions[0].title, "User login");

    // 2. Analysis records the exact version it analyzed.
    const analysis = await request(
      `/api/requirements/${requirementId}/analyze`,
      { method: "POST", body: JSON.stringify({}) },
    );

    assert.equal(analysis.status, 200);
    assert.equal(analysis.body.data.requirementVersion, 1);

    const analysisHistory = await request(
      `/api/requirements/${requirementId}/analysis`,
    );

    assert.equal(analysisHistory.status, 200);
    assert.equal(analysisHistory.body.data.requirementVersion, 1);
    assert.equal(analysisHistory.body.data.isCurrent, true);

    // 3. Generated test cases retain the version used.
    const generated = await request(
      `/api/requirements/${requirementId}/test-cases/generate`,
      { method: "POST", body: JSON.stringify({}) },
    );

    assert.equal(generated.status, 201);
    assert.equal(generated.body.data.requirementVersion, 1);
    assert.ok(generated.body.data.testCases.length > 0);

    const testCaseId = generated.body.data.testCases[0].id;

    assert.equal(
      generated.body.data.testCases[0].requirementVersion,
      1,
    );

    const testCaseHistory = await request(
      `/api/requirements/${requirementId}/test-cases`,
    );

    assert.equal(testCaseHistory.status, 200);
    assert.equal(
      testCaseHistory.body.data.testCases[0].requirementVersion,
      1,
    );
    assert.equal(
      testCaseHistory.body.data.testCases[0].isCurrent,
      true,
    );

    // 4. Updating requirement content creates version 2.
    const updated = await request(
      `/api/requirements/${requirementId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          title: "User authentication",
          content:
            "Users must log in using valid credentials and complete identity verification.",
        }),
      },
    );

    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.requirement.currentVersion, 2);
    assert.equal(updated.body.data.requirement.status, "DRAFT");

    const updatedHistory = await request(
      `/api/requirements/${requirementId}/versions`,
    );

    assert.equal(updatedHistory.status, 200);
    assert.equal(updatedHistory.body.data.versions.length, 2);

    assert.equal(updatedHistory.body.data.versions[0].version, 2);
    assert.equal(
      updatedHistory.body.data.versions[0].title,
      "User authentication",
    );

    assert.equal(updatedHistory.body.data.versions[1].version, 1);
    assert.equal(
      updatedHistory.body.data.versions[1].title,
      "User login",
    );

    // The previous analysis must now be marked stale.
    const staleAnalysis = await request(
      `/api/requirements/${requirementId}/analysis`,
    );

    assert.equal(staleAnalysis.status, 200);
    assert.equal(staleAnalysis.body.data.requirementVersion, 1);
    assert.equal(staleAnalysis.body.data.isCurrent, false);

    // Previously generated test cases must also be marked stale.
    const staleCases = await request(
      `/api/requirements/${requirementId}/test-cases`,
    );

    assert.equal(staleCases.status, 200);
    assert.equal(staleCases.body.data.testCases[0].isCurrent, false);

    // 5. An old test case cannot be approved.
    const approval = await request(
      `/api/test-cases/${testCaseId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "APPROVED" }),
      },
    );

    assert.equal(approval.status, 409);
    assert.equal(approval.body.error.code, "STALE_TEST_CASE");

    // Verify that the rejected approval did not change its status.
    const unchangedCase = await pool.query(
      "SELECT status, requirement_version FROM test_cases WHERE id = $1",
      [testCaseId],
    );

    assert.equal(unchangedCase.rows[0].status, "DRAFT");
    assert.equal(unchangedCase.rows[0].requirement_version, 1);

  } finally {
    // Remove only the records created by this test.
    if (projectId) {
      await pool.query("DELETE FROM projects WHERE id = $1", [projectId]);
    }

    if (userId) {
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    }
  }
});
