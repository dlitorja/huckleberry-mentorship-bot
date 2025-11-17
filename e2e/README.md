# End-to-End Testing

This directory contains Playwright end-to-end tests for the Huckleberry Mentorship Bot.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run tests in UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

## Test Structure

- `health-check.spec.ts` - Tests for health check endpoint
- `webhook.spec.ts` - Tests for webhook endpoints

## Configuration

Tests are configured in `playwright.config.ts`. The default base URL is `http://localhost:3000`.

To change the base URL:
```bash
TEST_BASE_URL=http://your-url:3000 npm run test:e2e
```

## CI/CD

E2E tests run automatically in CI/CD pipeline. The webhook server is started automatically before tests run.

## Notes

- Webhook tests require proper webhook secret configuration
- Some tests may need environment variables set up
- Tests use a test database connection (configure via environment variables)

