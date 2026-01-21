# Toggle Headings Test Suite Documentation

## Overview

This document describes the comprehensive test suite for the Toggle Headings feature in the n8n-nodes-markdown-to-notion project. The test suite is designed to ensure code quality, prevent performance regressions, and maintain reliability.

## Test Structure

### Test Files

| File | Purpose | Coverage |
|------|---------|----------|
| `ToggleHeadings.structure.test.ts` | Structure building logic | `buildToggleHeadingStructure()` method |
| `ToggleHeadings.api.test.ts` | API integration | `processToggleHeadingsWithAPI()`, `addBlocksToPage()`, `addSingleBatch()` |
| `ToggleHeadings.performance.test.ts` | Performance regression detection | Memory usage, timing, API call efficiency |
| `ToggleHeadings.integration.test.ts` | End-to-end workflows | Complete node execution with Toggle Headings enabled |

### Test Categories

#### 1. Structure Building Tests (`ToggleHeadings.structure.test.ts`)

**Purpose**: Verify that markdown is correctly parsed into hierarchical toggle structures.

**Key Test Cases**:
- ✅ Simple hierarchical structures (H1 > H2 > H3)
- ✅ Complex nested structures with mixed content
- ✅ Orphan content handling (content before first heading)
- ✅ Empty headings
- ✅ Math formula preservation in headings and content
- ✅ Malformed markdown graceful handling
- ✅ Deep nesting (6+ levels)
- ✅ Special characters and Unicode
- ✅ Code blocks with various languages
- ✅ Tables with complex content

**Critical Assertions**:
```typescript
expect(result.rootNodes).toMatchObject({
  level: 1,
  heading: { type: 'toggle' },
  children: expect.any(Array),
  subHeadings: expect.any(Array)
});
```

#### 2. API Integration Tests (`ToggleHeadings.api.test.ts`)

**Purpose**: Verify API calls are made correctly and errors are handled properly.

**Key Test Cases**:
- ✅ Successful processing with multiple API calls
- ✅ Orphan blocks handling
- ✅ API error responses
- ✅ Network errors
- ✅ Warning accumulation
- ✅ Deep nesting without stack overflow
- ✅ Math formula preservation in API requests
- ✅ Batching logic (small and large batches)
- ✅ Empty blocks handling
- ✅ Chunk processing errors

**Critical Mocking**:
```typescript
mockHttpRequest.mockResolvedValueOnce({
  object: 'list',
  results: [{ id: 'heading-1-id', type: 'toggle' }]
});
```

#### 3. Performance Regression Tests (`ToggleHeadings.performance.test.ts`)

**Purpose**: Detect performance regressions and ensure scalability.

**Performance Thresholds**:
```typescript
const PERFORMANCE_THRESHOLDS = {
  STRUCTURE_BUILDING_MS: 2000,
  MEMORY_INCREASE_MB: 50,
  MAX_API_CALL_RATIO: 20,
  DEEP_NESTING_MS: 500,
  CONCURRENT_PROCESSING_MS: 5000
};
```

**Key Test Cases**:
- ✅ Baseline performance for regular mode
- ✅ Structure building performance
- ✅ API call count tracking (Toggle vs Regular mode)
- ✅ Memory usage monitoring
- ✅ Deep nesting performance
- ✅ Concurrent processing
- ✅ Stress testing with large documents
- ✅ Math-heavy documents
- ✅ Table-heavy documents

**Performance Monitoring**:
```typescript
const startTime = process.hrtime.bigint();
// ... operation
const endTime = process.hrtime.bigint();
const durationMs = Number(endTime - startTime) / 1_000_000;
expect(durationMs).toBeLessThan(THRESHOLD);
```

#### 4. Integration Tests (`ToggleHeadings.integration.test.ts`)

**Purpose**: Test complete end-to-end workflows through the n8n node interface.

**Key Test Cases**:
- ✅ Complete toggle headings workflow
- ✅ Math formulas integration
- ✅ Orphan content integration
- ✅ Complex nested structures
- ✅ Error handling with continueOnFail
- ✅ Toggle vs Regular mode comparison
- ✅ Real-world scenarios (documentation, scientific papers)
- ✅ Large document performance monitoring

## Running Tests

### Individual Test Suites

```bash
# Run all Toggle Headings tests
npm run test:toggle

# Run specific test files
npm run test:structure
npm run test:api
npm run test:performance
npm run test:integration

# Watch mode for development
npm run test:toggle:watch

# Coverage report
npm run test:toggle:coverage
```

### Test Development Workflow

```bash
# Watch specific test during development
npx jest ToggleHeadings.structure.test.ts --watch

# Run with verbose output
npx jest ToggleHeadings.api.test.ts --verbose

# Run specific test by name
npx jest --testNamePattern="should handle orphan content"
```

## Test Data Management

### Markdown Test Content

The tests use dynamically generated markdown content to ensure comprehensive coverage:

```typescript
const createLargeMarkdownDocument = (headingCount: number, contentPerHeading: number = 3) => {
  // Generates structured markdown with:
  // - Multiple heading levels
  // - Mixed content types (paragraphs, code blocks, tables)
  // - Realistic formatting (bold, italic, code)
  // - Periodic special content (code blocks every 5 headings, tables every 7)
};
```

### Mock API Responses

API responses are carefully mocked to simulate real Notion API behavior:

```typescript
const mockResponses = [
  { object: 'list', results: [{ id: 'heading-1-id', type: 'toggle' }] },
  { object: 'list', results: [{ id: 'content-1-id', type: 'paragraph' }] }
];
```

## Performance Benchmarks

### Current Performance Characteristics

Based on real testing data:

| Mode | Document Size | API Calls | Duration | Blocks/Call |
|------|---------------|-----------|----------|-------------|
| Regular | 155 blocks | 2 calls | 8.5s | 77.5 |
| Toggle | 155 blocks | >40 calls | >120s | ~3 |

### Performance Regression Detection

The test suite automatically fails if performance degrades beyond acceptable thresholds:

```typescript
if (durationMs > PERFORMANCE_THRESHOLDS.STRUCTURE_BUILDING_MS) {
  throw new Error(
    `Performance regression detected: Structure building took ${durationMs}ms, ` +
    `exceeding threshold of ${PERFORMANCE_THRESHOLDS.STRUCTURE_BUILDING_MS}ms`
  );
}
```

## Error Scenarios Covered

### API Errors
- ✅ Notion API error responses (400, 401, 403, 404, 500)
- ✅ Network timeouts and connection failures
- ✅ Malformed API responses
- ✅ Rate limiting scenarios

### Input Validation
- ✅ Invalid page IDs
- ✅ Empty markdown content
- ✅ Malformed markdown syntax
- ✅ Extremely large documents

### Edge Cases
- ✅ Documents with no headings (all orphan content)
- ✅ Documents with only headings (no content)
- ✅ Deeply nested structures (10+ levels)
- ✅ Unicode and special characters
- ✅ Mixed math formula syntaxes

## Coverage Requirements

### Minimum Coverage Thresholds

```javascript
coverageThreshold: {
  global: {
    branches: 90,    // Increased from 70% for Toggle Headings
    functions: 90,   // Increased from 70% for Toggle Headings
    lines: 90,       // Increased from 70% for Toggle Headings
    statements: 90   // Increased from 70% for Toggle Headings
  }
}
```

### Coverage Exclusions

The following are excluded from coverage requirements:
- Test files (`**/__tests__/**`)
- Build artifacts (`**/dist/**`)
- Node modules (`**/node_modules/**`)

## Continuous Integration

### Pre-commit Hooks

Before any code is committed, the following tests must pass:
1. All unit tests (`npm test`)
2. Coverage thresholds (`npm run test:coverage`)
3. Performance regression tests (`npm run test:performance`)

### CI Pipeline

```yaml
# Example GitHub Actions workflow
- name: Run Toggle Headings Tests
  run: |
    npm run test:toggle:coverage
    npm run test:performance
```

## Debugging Test Failures

### Common Issues and Solutions

1. **Performance Test Failures**
   ```bash
   # Run performance tests in isolation
   npm run test:performance
   
   # Check system resources
   node -e "console.log(process.memoryUsage())"
   ```

2. **API Mock Issues**
   ```bash
   # Verify mock setup
   npx jest ToggleHeadings.api.test.ts --verbose
   ```

3. **Structure Building Failures**
   ```bash
   # Test specific markdown patterns
   npx jest --testNamePattern="should handle complex nested"
   ```

### Test Debugging Tools

```typescript
// Add debugging output to tests
console.log('Mock calls:', mockHttpRequest.mock.calls);
console.log('Result structure:', JSON.stringify(result, null, 2));
```

## Future Test Enhancements

### Planned Improvements

1. **Visual Regression Testing**: Screenshots of rendered Notion pages
2. **Load Testing**: Automated testing with various document sizes
3. **Fuzz Testing**: Random markdown generation for edge case discovery
4. **Integration with Real Notion API**: Optional tests against live API

### Test Metrics Tracking

Future enhancements will track:
- Test execution time trends
- Coverage percentage over time
- Performance benchmark history
- Flaky test identification

## Contributing to Tests

### Adding New Test Cases

1. Identify the appropriate test file based on the feature being tested
2. Follow existing naming conventions and structure
3. Include both positive and negative test cases
4. Add performance considerations for new features
5. Update this documentation

### Test Review Checklist

- [ ] Tests cover both success and failure scenarios
- [ ] Performance implications are considered
- [ ] Mocks are realistic and maintainable
- [ ] Test names clearly describe what is being tested
- [ ] Edge cases are covered
- [ ] Documentation is updated

This comprehensive test suite ensures the Toggle Headings feature maintains high quality, performance, and reliability throughout its development lifecycle.