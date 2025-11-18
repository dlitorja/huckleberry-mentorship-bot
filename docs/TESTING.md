# Testing Guide

This project uses Jest for unit testing with TypeScript and ESM support.

## Setup

Install dependencies (includes Jest and testing utilities):

```bash
npm install
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode (for development)
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

This will generate:
- Console coverage report
- HTML report in `coverage/index.html`
- LCOV report in `coverage/lcov.info` (for CI/CD)

## Test Structure

Tests are located alongside the source code in `__tests__` directories:

```
src/
  utils/
    __tests__/
      validation.test.ts
      discordApi.test.ts
      performance.test.ts
      requestId.test.ts
    validation.ts
    discordApi.ts
    ...
```

## Writing Tests

### Example Test File

```typescript
import { describe, it, expect } from '@jest/globals';
import { myFunction } from '../myModule.js';

describe('myModule', () => {
  describe('myFunction', () => {
    it('should do something', () => {
      expect(myFunction()).toBe('expected');
    });
  });
});
```

### Mocking

For mocking external dependencies:

```typescript
// Mock a module
jest.mock('../logger.js', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock global fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
```

## CI/CD Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

The CI pipeline:
1. Runs linter
2. Type checks TypeScript
3. Runs all tests
4. Generates coverage report
5. Builds the project

## Coverage Goals

Target: **90%+ code coverage**

Current coverage can be viewed by:
1. Running `npm run test:coverage`
2. Opening `coverage/index.html` in a browser

## Test Utilities

### Validation Tests
Tests for all validation functions in `src/utils/validation.ts`:
- Email validation
- Date validation
- Discord ID validation
- URL validation
- Currency validation
- Numeric validation
- And more...

### Discord API Tests
Tests for Discord API utilities with mocked fetch:
- DM channel creation
- Sending DMs
- Role management
- Guild member operations
- OAuth flow

### Performance Tests
Tests for performance monitoring utilities:
- Operation timing
- Success rate tracking
- Metrics collection

### Request ID Tests
Tests for distributed tracing:
- Request ID generation
- Context management
- Express middleware

## Troubleshooting

### Tests fail with ESM import errors
Make sure you're using Node.js 20+ and have `NODE_OPTIONS=--experimental-vm-modules` set (handled automatically by npm scripts).

### Mock not working
Ensure mocks are defined before imports:
```typescript
jest.mock('../module.js');
import { something } from '../module.js';
```

### Type errors in tests
Make sure `@types/jest` is installed and your IDE recognizes Jest types.

