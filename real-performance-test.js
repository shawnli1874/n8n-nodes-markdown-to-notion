#!/usr/bin/env node

/**
 * Real Performance Test with Monitoring
 */

require('dotenv').config();

const testMarkdown = `# 📚 Complete Feature Test

This document tests all toggle headings features with real performance monitoring.

## 🚀 Basic Features

Testing basic toggle functionality.

### Text Formatting

This section contains **bold text**, *italic text*, and \`inline code\`.

Here's a paragraph with multiple formatting options combined.

### Lists and Structure

Testing different list types:

- Unordered list item 1
- Unordered list item 2
  - Nested item 2.1
  - Nested item 2.2
- Unordered list item 3

Ordered list:

1. First ordered item
2. Second ordered item
3. Third ordered item

## 📝 Code and Technical Content

This section tests code blocks and technical formatting.

### JavaScript Example

\`\`\`javascript
function toggleHeadingsDemo() {
    console.log("Testing toggle headings performance");
    
    const metrics = {
        startTime: Date.now(),
        blocksProcessed: 0,
        apiCalls: 0
    };
    
    return metrics;
}

// Call the function
const result = toggleHeadingsDemo();
console.log("Performance test completed:", result);
\`\`\`

### Configuration Example

\`\`\`json
{
  "toggleHeadings": true,
  "preserveMath": true,
  "mathDelimiter": "$",
  "supportLatex": true,
  "batchSize": 100
}
\`\`\`

## 📊 Data and Tables

Testing table rendering within toggle sections.

### Performance Metrics Table

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| API Calls | < 10 | TBD | 🟡 Testing |
| Total Time | < 30s | TBD | 🟡 Testing |
| Blocks/sec | > 5 | TBD | 🟡 Testing |
| Success Rate | 100% | TBD | 🟡 Testing |

### Data Processing

Here's how the data flows through the system:

1. **Parse Markdown**: Convert markdown to AST
2. **Build Structure**: Create hierarchical toggle structure  
3. **Batch Process**: Group blocks for efficient API calls
4. **Create Blocks**: Send batched requests to Notion API
5. **Verify Results**: Check success and performance metrics

## 🔧 Advanced Features

Testing advanced functionality and edge cases.

### Mathematical Expressions

Testing math formula preservation:

Simple inline math: $E = mc^2$

Complex formula: $\\sum_{i=1}^{n} x_i = x_1 + x_2 + \\cdots + x_n$

### Blockquotes and Callouts

> **Important Note**: This blockquote should be properly nested under the "Blockquotes and Callouts" heading when toggle mode is enabled.

> **Performance Tip**: Large documents with many headings may require more API calls due to the hierarchical structure requirements.

### Mixed Content Section

This section combines multiple content types:

**Text with formatting** followed by a list:

- Item with \`inline code\`
- Item with **bold formatting**
- Item with *italic text*

Then a code block:

\`\`\`bash
# Performance monitoring command
echo "Monitoring toggle headings performance..."
time node performance-test.js
\`\`\`

And finally a blockquote:

> This demonstrates how different content types work together in a toggle heading structure.

## 📈 Performance Analysis

This section will contain the actual performance results.

### Expected Metrics

Based on the document structure:
- **Estimated blocks**: ~45-50 blocks total
- **Heading levels**: 3 levels (H1, H2, H3)
- **Content variety**: Text, lists, code, tables, blockquotes
- **API calls needed**: 15-20 calls (due to hierarchical structure)

### Success Criteria

✅ All content properly nested under headings
✅ All formatting preserved (bold, italic, code)
✅ Code blocks rendered correctly
✅ Tables displayed properly
✅ Blockquotes nested correctly
✅ Math formulas preserved
✅ No content loss or corruption

## 🎯 Final Summary

This comprehensive test document validates:

1. **Functional correctness**: All content types work in toggle mode
2. **Performance characteristics**: Real-world timing and API usage
3. **Scalability**: How the system handles moderate-sized documents
4. **Reliability**: Success rate and error handling

The results will help optimize the balance between functionality and performance.`;

async function runRealPerformanceTest() {
    console.log('🎯 Real Performance Test with Monitoring\n');
    
    if (!process.env.NOTION_TOKEN || !process.env.NOTION_PAGE_ID) {
        console.error('❌ Missing NOTION_TOKEN or NOTION_PAGE_ID in .env file');
        return;
    }
    
    console.log('📋 Test Document Analysis:');
    console.log(`   - Characters: ${testMarkdown.length.toLocaleString()}`);
    console.log(`   - Lines: ${testMarkdown.split('\n').length}`);
    console.log(`   - Headings: ${(testMarkdown.match(/^#+\s/gm) || []).length}`);
    console.log(`   - Code blocks: ${(testMarkdown.match(/```/g) || []).length / 2}`);
    console.log(`   - Tables: ${(testMarkdown.match(/\|.*\|/g) || []).length}`);
    console.log(`   - Blockquotes: ${(testMarkdown.match(/^>/gm) || []).length}\n`);
    
    // Performance monitoring
    let apiCallCount = 0;
    let totalApiTime = 0;
    let apiCallSizes = [];
    let apiCallTimes = [];
    let errors = [];
    
    const mockExecuteFunctions = {
        getNode: () => ({ name: 'Performance Monitor Node' }),
        helpers: {
            httpRequestWithAuthentication: {
                call: async (context, authType, options) => {
                    const fetch = (await import('node-fetch')).default;
                    
                    apiCallCount++;
                    const blockCount = options.body.children.length;
                    apiCallSizes.push(blockCount);
                    
                    const startTime = Date.now();
                    
                    try {
                        const response = await fetch(options.url, {
                            method: options.method,
                            headers: {
                                'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
                                'Notion-Version': '2022-06-28',
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(options.body)
                        });
                        
                        const endTime = Date.now();
                        const callTime = endTime - startTime;
                        totalApiTime += callTime;
                        apiCallTimes.push(callTime);
                        
                        console.log(`   📡 API Call ${apiCallCount}: ${callTime}ms (${blockCount} blocks)`);
                        
                        if (!response.ok) {
                            const errorText = await response.text();
                            const error = `${response.status} - ${errorText}`;
                            errors.push(error);
                            throw new Error(`API error: ${error}`);
                        }
                        
                        return await response.json();
                        
                    } catch (error) {
                        const endTime = Date.now();
                        const callTime = endTime - startTime;
                        apiCallTimes.push(callTime);
                        errors.push(error.message);
                        throw error;
                    }
                }
            }
        }
    };
    
    try {
        const { MarkdownToNotion } = require('./dist/nodes/MarkdownToNotion/MarkdownToNotion.node.js');
        
        console.log('⏱️  Starting performance test...\n');
        const overallStartTime = Date.now();
        
        const result = await MarkdownToNotion.processToggleHeadingsWithAPI(
            mockExecuteFunctions,
            process.env.NOTION_PAGE_ID,
            testMarkdown,
            {
                preserveMath: true,
                mathDelimiter: '$',
                supportLatex: true,
                toggleHeadings: true
            },
            0
        );
        
        const overallEndTime = Date.now();
        const totalTime = overallEndTime - overallStartTime;
        
        // Calculate statistics
        const avgApiTime = apiCallTimes.length > 0 ? totalApiTime / apiCallTimes.length : 0;
        const avgBlocksPerCall = apiCallSizes.length > 0 ? apiCallSizes.reduce((a, b) => a + b, 0) / apiCallSizes.length : 0;
        const successRate = ((apiCallCount - errors.length) / apiCallCount * 100);
        
        console.log('\n🎉 Performance Test Results:');
        console.log('=' .repeat(50));
        
        // Basic Results
        console.log('📊 Basic Metrics:');
        console.log(`   ✅ Success: ${result.json.success}`);
        console.log(`   📦 Total blocks created: ${result.json.blocksAdded}`);
        console.log(`   🔄 API calls made: ${apiCallCount}`);
        console.log(`   ⏱️  Total time: ${totalTime.toLocaleString()}ms (${(totalTime/1000).toFixed(1)}s)`);
        
        // Performance Analysis
        console.log('\n⚡ Performance Analysis:');
        console.log(`   🎯 Blocks per second: ${(result.json.blocksAdded / (totalTime/1000)).toFixed(1)}`);
        console.log(`   📈 Average API time: ${avgApiTime.toFixed(0)}ms`);
        console.log(`   📦 Average blocks per call: ${avgBlocksPerCall.toFixed(1)}`);
        console.log(`   ✅ Success rate: ${successRate.toFixed(1)}%`);
        
        // Efficiency Ratings
        console.log('\n📈 Efficiency Ratings:');
        
        // Time efficiency
        if (totalTime < 15000) {
            console.log('   🟢 Time: Excellent (< 15s)');
        } else if (totalTime < 30000) {
            console.log('   🟡 Time: Good (15-30s)');
        } else if (totalTime < 60000) {
            console.log('   🟠 Time: Acceptable (30-60s)');
        } else {
            console.log('   🔴 Time: Slow (> 60s)');
        }
        
        // API efficiency
        if (avgBlocksPerCall > 80) {
            console.log('   🟢 Batching: Excellent (>80 blocks/call)');
        } else if (avgBlocksPerCall > 50) {
            console.log('   🟡 Batching: Good (50-80 blocks/call)');
        } else if (avgBlocksPerCall > 20) {
            console.log('   🟠 Batching: Moderate (20-50 blocks/call)');
        } else {
            console.log('   🔴 Batching: Poor (<20 blocks/call)');
        }
        
        // Success rate
        if (successRate === 100) {
            console.log('   🟢 Reliability: Perfect (100%)');
        } else if (successRate >= 95) {
            console.log('   🟡 Reliability: Good (95-99%)');
        } else {
            console.log('   🔴 Reliability: Poor (<95%)');
        }
        
        // Detailed Statistics
        console.log('\n📊 Detailed Statistics:');
        console.log(`   📡 API call times: ${Math.min(...apiCallTimes)}ms - ${Math.max(...apiCallTimes)}ms`);
        console.log(`   📦 Block sizes: ${Math.min(...apiCallSizes)} - ${Math.max(...apiCallSizes)} blocks`);
        
        if (errors.length > 0) {
            console.log(`\n❌ Errors (${errors.length}):`);
            errors.forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
        }
        
        if (result.json.warnings?.length > 0) {
            console.log(`\n⚠️  Warnings (${result.json.warnings.length}):`);
            result.json.warnings.forEach((warning, i) => {
                console.log(`   ${i + 1}. ${warning}`);
            });
        }
        
        console.log(`\n🔗 View result: https://notion.so/${process.env.NOTION_PAGE_ID.replace(/-/g, '')}`);
        
        // Recommendations
        console.log('\n💡 Recommendations:');
        if (avgBlocksPerCall < 50) {
            console.log('   • Consider optimizing batching for better API efficiency');
        }
        if (totalTime > 30000) {
            console.log('   • Document size may be too large for optimal performance');
        }
        if (successRate < 100) {
            console.log('   • Investigate API errors for reliability improvement');
        }
        if (avgBlocksPerCall > 80 && totalTime < 30000 && successRate === 100) {
            console.log('   🎉 Performance is excellent! No optimization needed.');
        }
        
    } catch (error) {
        console.error('\n❌ Performance test failed:', error.message);
        
        if (error.message.includes('401')) {
            console.error('   🔑 Check your NOTION_TOKEN');
        } else if (error.message.includes('404')) {
            console.error('   📄 Check your NOTION_PAGE_ID');
        } else if (error.message.includes('429')) {
            console.error('   🚦 Rate limited - try again later');
        }
        
        console.log('\n📊 Partial Statistics:');
        console.log(`   📡 API calls completed: ${apiCallCount}`);
        console.log(`   ❌ Errors encountered: ${errors.length}`);
        if (apiCallTimes.length > 0) {
            console.log(`   ⏱️  Average API time: ${(totalApiTime / apiCallTimes.length).toFixed(0)}ms`);
        }
    }
}

runRealPerformanceTest();