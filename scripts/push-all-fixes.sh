#!/bin/bash
# Script to push all current fixes (web portal path aliases + script organization)

cd "$(dirname "$0")/.."

echo "Staging all fixes..."
git add huckleberry-web-portal/next.config.mjs
git add huckleberry-web-portal/package.json
git add huckleberry-web-portal/tsconfig.json
git add huckleberry-web-portal/jsconfig.json
git add scripts/
git add package.json

echo "Committing changes..."
git commit -m "fix: Add tsconfig-paths-webpack-plugin and organize scripts

- Add tsconfig-paths-webpack-plugin to resolve path aliases from tsconfig.json
- Update next.config.mjs to use TsconfigPathsPlugin
- Organize all push scripts into scripts/ folder
- Add README.md in scripts/ explaining script usage
- Update package.json push scripts to reference new script locations"

echo "Pushing to GitHub..."
git push origin main

echo "Done!"

