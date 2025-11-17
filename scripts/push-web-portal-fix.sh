#!/bin/bash
# Script to push web portal build fix to GitHub
# Note: This script is redundant with npm run push:web-portal-fix

cd "$(dirname "$0")/.."

echo "Staging web portal build fix..."
git add huckleberry-web-portal/components/ui/combobox.tsx

echo "Committing changes..."
git commit -m "fix: Fix Combobox component type definition for Next.js build

- Change Combobox from incorrectly typed const to proper function component
- Fixes TypeScript compilation error in web portal build
- Resolves webpack build failure in CI workflow"

echo "Pushing to GitHub..."
git push origin main

echo "Done!"

