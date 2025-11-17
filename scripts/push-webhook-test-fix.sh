#!/bin/bash
# Script to push webhook test fix to GitHub
# Note: This script is redundant with npm run push:webhook-test-fix

cd "$(dirname "$0")/.."

echo "Staging webhook test fix files..."
git add e2e/webhook.spec.ts
git add src/server/webhookServer.ts

echo "Committing changes..."
git commit -m "fix: Accept 404 status code in webhook E2E tests

- Add 404 to acceptable status codes in webhook tests
- Tests now accept 400, 401, 403, 404, 500 as valid error responses
- 404 is expected when offer lookup fails in test mode with fake offer IDs
- Keep correct HTTP semantics (404 for 'not found')"

echo "Pushing to GitHub..."
git push origin main

echo "Done!"

