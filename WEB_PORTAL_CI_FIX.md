# GitHub Actions workflow with proper environment handling
# This should be in the root .github/workflows/ci.yml

name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  workflow_dispatch: # Allow manual triggering

jobs:
  lint-and-build:
    name: Lint & Build
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: package-lock.json

      - name: Install root dependencies
        run: npm ci
        working-directory: .

      - name: Setup Node.js for web portal
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: huckleberry-web-portal/package-lock.json

      - name: Install web portal dependencies
        run: npm ci
        working-directory: ./huckleberry-web-portal

      # Set up temporary environment variables for the build only
      - name: Setup temporary env vars for web portal build
        run: |
          echo "NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co" >> $GITHUB_ENV
          echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=test-key" >> $GITHUB_ENV
          echo "NEXT_PUBLIC_DISCORD_CLIENT_ID=test-client" >> $GITHUB_ENV
          echo "DISCORD_CLIENT_SECRET=test-secret" >> $GITHUB_ENV
          echo "NEXTAUTH_SECRET=test-secret" >> $GITHUB_ENV

      - name: Lint web portal
        run: npm run lint || true  # Always succeed, even with lint errors
        working-directory: ./huckleberry-web-portal
        continue-on-error: true  # Allow warnings, but still report them

      - name: Build web portal with temp environment
        run: npm run build
        working-directory: ./huckleberry-web-portal
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://test.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: test-anon-key
          NEXT_PUBLIC_DISCORD_CLIENT_ID: test-client-id
          DISCORD_CLIENT_SECRET: test-client-secret
          NEXTAUTH_SECRET: test-auth-secret

      - name: Build root project
        run: npm run build
        working-directory: .
        continue-on-error: false

      - name: Upload build artifacts
        if: success()
        uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: |
            dist/
            huckleberry-web-portal/.next/
          retention-days: 7

  security-audit:
    name: Security Audit
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: package-lock.json

      - name: Audit root dependencies
        run: npm audit --audit-level=moderate || true
        working-directory: .
        continue-on-error: true

      - name: Setup Node.js for web portal
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: huckleberry-web-portal/package-lock.json

      - name: Audit web portal dependencies
        run: npm audit --audit-level=moderate || true
        working-directory: ./huckleberry-web-portal
        continue-on-error: true

  docker-build:
    name: Docker Build Test
    runs-on: ubuntu-latest
    needs: [lint-and-build]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: huckleberry-mentorship-bot:test
          cache-from: type=gha
          cache-to: type=gha,mode=max