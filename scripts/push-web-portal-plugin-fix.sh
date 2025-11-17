#!/bin/bash
# Script to push web portal tsconfig-paths-webpack-plugin fix

cd "$(dirname "$0")/.."

echo "Staging web portal plugin fix files..."
git add huckleberry-web-portal/next.config.mjs
git add huckleberry-web-portal/package.json
git add .github/workflows/ci.yml

echo "Committing changes..."
git commit -m "fix: Add tsconfig-paths-webpack-plugin and update CI workflow

- Add tsconfig-paths-webpack-plugin to resolve path aliases from tsconfig.json
- Update next.config.mjs to use TsconfigPathsPlugin for path resolution
- Change CI workflow to use npm install instead of npm ci for web portal
  (allows installing new dependencies and updating lock file)"

echo "Pushing to GitHub..."
git push origin main

echo "Done!"

