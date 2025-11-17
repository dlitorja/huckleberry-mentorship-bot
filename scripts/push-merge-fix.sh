#!/bin/bash
# Script to push merge conflict fix to GitHub
# Note: This script is redundant with npm run push:merge-fix

cd "$(dirname "$0")/.."

echo "Staging merge conflict fix..."
git add huckleberry-web-portal/components/RichTextEditor.tsx

echo "Committing changes..."
git commit -m "fix: Resolve merge conflict in RichTextEditor.tsx

- Remove merge conflict markers
- Keep immediatelyRender: false option for TipTap editor"

echo "Pushing to GitHub..."
git push origin main

echo "Done!"

