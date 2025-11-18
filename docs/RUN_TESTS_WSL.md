# Running Tests in WSL

Since you're using WSL, run these commands directly in your WSL terminal (not from Windows PowerShell).

## Quick Start

1. Open your WSL terminal (Ubuntu)
2. Navigate to the project:
   ```bash
   cd ~/projects/Discord\ Huckleberry\ Mentorship\ Bot/huckleberry-mentorship-bot
   ```

3. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

4. Run tests:
   ```bash
   npm test
   ```

## Alternative: Run without cross-env

If `cross-env` isn't installed or you prefer not to use it, you can run Jest directly:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest
```

Or for coverage:
```bash
NODE_OPTIONS=--experimental-vm-modules npx jest --coverage
```

## All Test Commands

```bash
# Unit & Integration Tests
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report

# End-to-End Tests (requires Playwright setup)
npm run test:e2e           # Run E2E tests
npm run test:e2e:ui        # Interactive UI mode
npm run test:e2e:headed    # See browser
```

## Troubleshooting

### If `cross-env` is not found:
```bash
npm install --save-dev cross-env
```

### If tests fail with module errors:
Make sure you're using Node.js 20+:
```bash
node --version
```

### If Jest can't find config:
Make sure you're in the `huckleberry-mentorship-bot` directory and `jest.config.js` exists.

