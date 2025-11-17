# Scripts Directory

This directory contains utility scripts for the project.

## Push Scripts

**Note:** All push scripts in this directory are **redundant** with npm scripts defined in `package.json`. The npm scripts are the recommended way to use these commands:

- `npm run push:ci-fixes` - Push CI workflow fixes
- `npm run push:e2e-fixes` - Push E2E test fixes
- `npm run push:merge-fix` - Push merge conflict fixes
- `npm run push:webhook-test-fix` - Push webhook test fixes
- `npm run push:web-portal-fix` - Push web portal build fixes
- `npm run push:web-portal-paths` - Push web portal path alias fixes
- `push-latest-changes.sh` - Push all latest changes (WSL/bash only)

### Why keep these scripts?

These scripts are kept for:
1. **Reference** - To see what files are being committed for each fix
2. **Direct execution** - For users who prefer running scripts directly
3. **Documentation** - To understand the commit messages and changes

### Usage

If you want to use these scripts directly:

**Bash (Linux/Mac/WSL):**
```bash
./scripts/push-ci-fixes.sh
./scripts/push-latest-changes.sh [optional commit message]
```

**PowerShell (Windows):**
```powershell
.\scripts\push-ci-fixes.ps1
```

**Recommended (npm scripts):**
```bash
npm run push:ci-fixes
```

