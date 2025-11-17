# PowerShell script to push webhook test fix to GitHub
# Note: This script is redundant with npm run push:webhook-test-fix

Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "Staging webhook test fix files..." -ForegroundColor Green
git add e2e/webhook.spec.ts
git add src/server/webhookServer.ts

Write-Host "Committing changes..." -ForegroundColor Green
git commit -m "fix: Accept 404 status code in webhook E2E tests

- Add 404 to acceptable status codes in webhook tests
- Tests now accept 400, 401, 403, 404, 500 as valid error responses
- 404 is expected when offer lookup fails in test mode with fake offer IDs
- Keep correct HTTP semantics (404 for 'not found')"

Write-Host "Pushing to GitHub..." -ForegroundColor Green
git push origin main

Write-Host "Done!" -ForegroundColor Green

