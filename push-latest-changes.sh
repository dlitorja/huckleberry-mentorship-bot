#!/bin/bash
# Script to push latest changes to GitHub via WSL
# This script stages all changes, commits, and pushes to origin main

# Change to the directory containing this script (project root)
cd "$(dirname "$0")"

# Check if there are any changes to commit
if [ -z "$(git status --porcelain)" ]; then
    echo "No changes to commit. Working directory is clean."
    exit 0
fi

# Show current status
echo "Current git status:"
git status --short

# Stage all changes
echo ""
echo "Staging all changes..."
git add -A

# Get commit message from user or use default
if [ -z "$1" ]; then
    echo ""
    echo "Enter commit message (or press Enter for default):"
    read -r commit_message
    if [ -z "$commit_message" ]; then
        commit_message="chore: Update latest changes"
    fi
else
    commit_message="$1"
fi

# Commit changes
echo ""
echo "Committing changes with message: $commit_message"
git commit -m "$commit_message"

# Push to GitHub
echo ""
echo "Pushing to GitHub..."
git push origin main

echo ""
echo "Done! Changes have been pushed to origin/main"

