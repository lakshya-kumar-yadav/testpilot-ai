# TestPilot AI Execution Worker

This workspace will host Playwright test execution separately from the API.

**Security boundary:** generated automation code is untrusted. Do not execute it in the API process or directly on the developer host. Container isolation, restricted networking, resource limits and secret isolation must be implemented before executing generated scripts.
