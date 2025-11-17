# PowerShell script to push all current fixes (web portal path aliases + script organization)

Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "Staging all fixes..." -ForegroundColor Green
git add huckleberry-web-portal/next.config.mjs
git add huckleberry-web-portal/package.json
git add huckleberry-web-portal/tsconfig.json
git add huckleberry-web-portal/jsconfig.json
git add scripts/
git add package.json

Write-Host "Committing changes..." -ForegroundColor Green
git commit -m "fix: Add tsconfig-paths-webpack-plugin and organize scripts

- Add tsconfig-paths-webpack-plugin to resolve path aliases from tsconfig.json
- Update next.config.mjs to use TsconfigPathsPlugin
- Organize all push scripts into scripts/ folder
- Add README.md in scripts/ explaining script usage
- Update package.json push scripts to reference new script locations"

Write-Host "Pushing to GitHub..." -ForegroundColor Green
git push origin main

Write-Host "Done!" -ForegroundColor Green

