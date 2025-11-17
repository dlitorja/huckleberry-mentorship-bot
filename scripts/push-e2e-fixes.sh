#!/bin/bash
# Script to push E2E test fixes to GitHub
# Note: This script is redundant with npm run push:e2e-fixes

cd "$(dirname "$0")/.."

echo "Staging E2E test fix files..."
git add .github/workflows/ci.yml
git add playwright.config.ts
git add src/server/webhookServer.ts
git add e2e/webhook.spec.ts

echo "Committing changes..."
git commit -m "fix: Comprehensive E2E test improvements for CI reliability

- Add server startup error handling (port conflicts)
- Increase timeouts for CI environment (4min server, 30s tests)
- Add port cleanup step in GitHub Actions workflow
- Make webhook tests more resilient to test environment
- Add better error reporting and debug logs on failure
- Improve health check handling in test mode
- Add job timeout and multiple artifact uploads"

echo "Pushing to GitHub..."
git push origin main

echo "Done!"

