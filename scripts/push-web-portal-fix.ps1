# PowerShell script to push web portal build fix to GitHub
# Note: This script is redundant with npm run push:web-portal-fix

Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "Staging web portal build fix..." -ForegroundColor Green
git add huckleberry-web-portal/components/ui/combobox.tsx

Write-Host "Committing changes..." -ForegroundColor Green
git commit -m "fix: Fix Combobox component type definition for Next.js build

- Change Combobox from incorrectly typed const to proper function component
- Fixes TypeScript compilation error in web portal build
- Resolves webpack build failure in CI workflow"

Write-Host "Pushing to GitHub..." -ForegroundColor Green
git push origin main

Write-Host "Done!" -ForegroundColor Green

