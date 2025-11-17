# PowerShell script to push E2E test fixes to GitHub
# Note: This script is redundant with npm run push:e2e-fixes

Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "Staging E2E test fix files..." -ForegroundColor Green
git add .github/workflows/ci.yml
git add playwright.config.ts
git add src/server/webhookServer.ts
git add e2e/webhook.spec.ts

Write-Host "Committing changes..." -ForegroundColor Green
git commit -m "fix: Comprehensive E2E test improvements for CI reliability

- Add server startup error handling (port conflicts)
- Increase timeouts for CI environment (4min server, 30s tests)
- Add port cleanup step in GitHub Actions workflow
- Make webhook tests more resilient to test environment
- Add better error reporting and debug logs on failure
- Improve health check handling in test mode
- Add job timeout and multiple artifact uploads"

Write-Host "Pushing to GitHub..." -ForegroundColor Green
git push origin main

Write-Host "Done!" -ForegroundColor Green

