# PowerShell script to push merge conflict fix to GitHub
# Note: This script is redundant with npm run push:merge-fix

Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "Staging merge conflict fix..." -ForegroundColor Green
git add huckleberry-web-portal/components/RichTextEditor.tsx

Write-Host "Committing changes..." -ForegroundColor Green
git commit -m "fix: Resolve merge conflict in RichTextEditor.tsx

- Remove merge conflict markers
- Keep immediatelyRender: false option for TipTap editor"

Write-Host "Pushing to GitHub..." -ForegroundColor Green
git push origin main

Write-Host "Done!" -ForegroundColor Green

