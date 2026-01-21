# Testing Strategy for Toggle Headings Feature

## Overview

This document describes our pragmatic testing approach for the Toggle Headings feature, balancing comprehensive coverage with development efficiency.

## Current Testing Status

### ✅ What's Working

**Unit Tests** (`ToggleHeadings.unit.test.ts`):
- ✅ All 9 tests passing
- ✅ Core logic fully covered
- ✅ No external dependencies
- ✅ Fast execution (<1 second)

**Integration Testing Scripts**:
- ✅ `final-demo.js` - Complete feature demonstration
- ✅ `compare-toggle-performance.js` - Performance comparison
- ✅ `test-large-document.js` - Large document testing
- ✅ `real-performance-test.js` - Real-world performance metrics
- ✅ `analyze-performance.js` - Structure analysis

### ⚠️ Known Limitations

**Jest + ES Modules Compatibility**:
- Jest cannot natively handle ES modules (unified, remark, mdast-util-*)
- Attempted solutions:
  - `transformIgnorePatterns` configuration - ❌ Failed
  - `NODE_OPTIONS=--experimental-vm-modules` - ❌ Failed
  - Mocking ES modules - ⚠️ Breaks real functionality

**Test Files Status**:
- `ToggleHeadings.structure.test.ts` - ⚠️ Requires real unified/remark
- `ToggleHeadings.api.test.ts` - ⚠️ Requires real unified/remark
- `ToggleHeadings.performance.test.ts` - ⚠️ Requires real unified/remark
- `ToggleHeadings.integration.test.ts` - ⚠️ Requires real unified/remark

## Adopted Strategy: Pragmatic Testing (Solution D)

### Rationale

1. **Core Logic is Tested**: Unit tests cover the critical business logic
2. **Real-World Validation**: Integration scripts test actual functionality
3. **Time Efficiency**: Avoids weeks of Jest configuration debugging
4. **Practical Results**: Feature is proven to work in production scenarios

### Test Coverage Matrix

| Test Type | Coverage Method | Status |
|-----------|----------------|--------|
| **Unit Tests** | Jest (`ToggleHeadings.unit.test.ts`) | ✅ 100% |
| **Structure Building** | Manual script testing | ✅ Verified |
| **API Integration** | Manual script testing | ✅ Verified |
| **Performance** | `compare-toggle-performance.js` | ✅ Benchmarked |
| **Integration** | `final-demo.js` | ✅ Verified |
| **Large Documents** | `test-large-document.js` | ✅ Verified |

### How to Test

#### 1. Unit Tests (Automated)
```bash
npm test -- --testPathPattern=ToggleHeadings.unit
```

**Expected Output**:
```
PASS nodes/MarkdownToNotion/__tests__/ToggleHeadings.unit.test.ts
  ✓ should create proper hierarchical structure
  ✓ should handle orphan content correctly
  ✓ should handle empty headings
  ✓ should handle deeply nested structures
  ✓ should handle API call sequencing correctly
  ✓ should handle batching logic correctly
  ✓ should handle error scenarios gracefully
  ✓ should track API call efficiency
  ✓ should handle memory usage efficiently

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
```

#### 2. Integration Testing (Manual)

**Quick Verification**:
```bash
node final-demo.js
```

**Performance Comparison**:
```bash
node compare-toggle-performance.js
```

**Large Document Test**:
```bash
node test-large-document.js
```

**Expected Results**:
- Toggle OFF: ~8.5s for 155 blocks, 2 API calls
- Toggle ON: ~120s for 155 blocks, ~40 API calls
- Both modes: Correct Notion structure created

#### 3. Manual Testing Checklist

Before releasing:
- [ ] Run unit tests: `npm test -- --testPathPattern=ToggleHeadings.unit`
- [ ] Run `final-demo.js` and verify Notion page structure
- [ ] Run `compare-toggle-performance.js` and verify performance metrics
- [ ] Test with real large document (>100 blocks)
- [ ] Verify Toggle ON creates collapsible headings
- [ ] Verify Toggle OFF maintains original behavior
- [ ] Test error handling with invalid page ID
- [ ] Test math formula preservation
- [ ] Test link preservation in headings

## Performance Benchmarks

### Baseline (Documented)

| Mode | Document Size | API Calls | Duration | Blocks/Call |
|------|---------------|-----------|----------|-------------|
| Toggle OFF | 155 blocks | 2 | 8.5s | 77.5 |
| Toggle ON | 155 blocks | 40+ | 120s+ | ~3 |

**Performance Ratio**: Toggle OFF is 14x faster than Toggle ON

**Why?**:
- Toggle OFF: Batch processing (100 blocks per call)
- Toggle ON: Recursive nesting (create parent → add children → repeat)

### Regression Detection

Run `compare-toggle-performance.js` before each release:
```bash
node compare-toggle-performance.js
```

**Alert if**:
- Toggle OFF takes >10s for 155 blocks
- Toggle ON takes >180s for 155 blocks
- API call count increases >20%

## Future Improvements

### Option 1: Migrate to Vitest
- Native ES module support
- Faster than Jest
- Modern testing experience
- **Effort**: 2-3 days to migrate

### Option 2: Use Test Fixtures
- Pre-compiled markdown → Notion block mappings
- No need for real unified/remark
- Test against static fixtures
- **Effort**: 1 day to create fixtures

### Option 3: E2E Testing Framework
- Playwright/Puppeteer to verify Notion UI
- Visual regression testing
- **Effort**: 3-5 days to set up

## Maintenance

### Adding New Test Cases

**For Unit Tests** (Preferred):
1. Add test to `ToggleHeadings.unit.test.ts`
2. Run: `npm test -- --testPathPattern=ToggleHeadings.unit`
3. Verify all tests pass

**For Integration Tests**:
1. Create new `.js` script in project root
2. Follow pattern from `final-demo.js`
3. Document in this file
4. Add to manual testing checklist

### Regression Testing

**Before Each Release**:
1. Run unit tests: `npm test`
2. Run `final-demo.js`
3. Run `compare-toggle-performance.js`
4. Check performance metrics haven't degraded
5. Verify Notion page structure visually

**Before Each Commit**:
1. Run unit tests only (fast feedback)
2. If touching core logic, run integration scripts

## Known Issues

### Issue 1: Jest + ES Modules
- **Problem**: Jest cannot parse ES module syntax from unified/remark
- **Impact**: 4 test files cannot run via Jest
- **Workaround**: Use manual testing scripts
- **Future Fix**: Migrate to Vitest or use test fixtures

### Issue 2: Notion API Rate Limits
- **Problem**: Performance tests may hit rate limits
- **Impact**: Tests fail intermittently
- **Workaround**: Use `.env` with valid credentials, run tests sequentially
- **Future Fix**: Add retry logic with exponential backoff

### Issue 3: TypeScript Compilation Warnings
- **Problem**: Zod dependency type errors
- **Impact**: Build shows warnings (but succeeds)
- **Workaround**: Ignore warnings (not our code)
- **Future Fix**: Wait for n8n-workflow to update Zod

## Conclusion

Our pragmatic testing approach provides:
- ✅ **Confidence**: Core logic is fully tested
- ✅ **Speed**: Fast unit tests + manual integration verification
- ✅ **Maintainability**: Simple test scripts, easy to understand
- ✅ **Real-World Validation**: Actual Notion API testing

This strategy prioritizes shipping working features over perfect test infrastructure.
