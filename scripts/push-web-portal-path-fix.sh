#!/bin/bash
# Script to push web portal path alias fix to GitHub
# Note: This script is redundant with npm run push:web-portal-paths

cd "$(dirname "$0")/.."

echo "Staging web portal path alias fix files..."
git add huckleberry-web-portal/next.config.mjs
git add huckleberry-web-portal/tsconfig.json
git add huckleberry-web-portal/jsconfig.json

echo "Committing changes..."
git commit -m "fix: Fix path alias resolution in Next.js webpack build

- Add explicit webpack configuration for @ path alias resolution
- Configure module resolution to include web portal root
- Set proper extension resolution order
- Change moduleResolution to 'bundler' for Next.js 15 compatibility
- Fixes 'Module not found' errors for @/lib/utils and @/lib/imageCompression"

echo "Pushing to GitHub..."
git push origin main

echo "Done!"

