# CI/CD Workflows

This directory contains GitHub Actions workflows for automated testing, building, and deployment.

## Workflows

### 1. `ci.yml` - Continuous Integration
**Triggers:** Push/PR to `main` or `develop` branches, manual trigger

**What it does:**
- ✅ Lints both root project and web portal
- ✅ Type checks TypeScript code
- ✅ Builds both projects
- ✅ Runs security audits
- ✅ Tests Docker image build

**Status:** All checks must pass before merging PRs.

### 2. `security-audit.yml` - Security Scanning
**Triggers:** Push/PR, weekly schedule (Mondays 9 AM UTC), manual trigger

**What it does:**
- ✅ Scans dependencies for vulnerabilities
- ✅ Checks for outdated packages
- ✅ Uploads audit results as artifacts

### 3. `deploy.yml` - Deployment to Fly.io
**Triggers:** Manual trigger only (for safety), or push to `main` branch

**What it does:**
- ✅ Deploys to Fly.io production
- ✅ Verifies deployment status

**Setup Required:**
1. Get your Fly.io API token: `flyctl auth token`
2. Add it as a GitHub secret: `FLY_API_TOKEN`
3. Go to: Repository Settings → Secrets and variables → Actions → New repository secret

## Manual Workflow Triggers

You can manually trigger any workflow:
1. Go to the "Actions" tab in GitHub
2. Select the workflow you want to run
3. Click "Run workflow"
4. Choose the branch and click "Run workflow"

## Local Testing

Before pushing, you can test locally:

```bash
# Lint
npm run lint
cd huckleberry-web-portal && npm run lint

# Build
npm run build
cd huckleberry-web-portal && npm run build

# Security audit
npm run security:audit
cd huckleberry-web-portal && npm run security:audit

# Docker build test
docker build -t huckleberry-mentorship-bot:test .
```

## Workflow Status Badge

Add this to your README.md to show CI status:

```markdown
![CI](https://github.com/YOUR_USERNAME/YOUR_REPO/workflows/CI%2FCD%20Pipeline/badge.svg)
```

Replace `YOUR_USERNAME` and `YOUR_REPO` with your actual GitHub username and repository name.

