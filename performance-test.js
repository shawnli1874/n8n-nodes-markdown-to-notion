#!/usr/bin/env node

/**
 * Performance Test for Toggle Headings with Large Documents
 */

require('dotenv').config();

function generateLargeMarkdown() {
    let markdown = `# Large Document Performance Test

This document tests the performance of toggle headings with many blocks.

`;

    // Generate 20 sections with multiple subsections
    for (let i = 1; i <= 20; i++) {
        markdown += `## Section ${i}

This is section ${i} with substantial content to test performance.

### Subsection ${i}.1

Content for subsection ${i}.1 with multiple paragraphs.

Here's another paragraph with some **bold text** and *italic text*.

#### Deep Subsection ${i}.1.1

Even deeper content to test nested structures.

- List item 1 in section ${i}
- List item 2 in section ${i}
- List item 3 in section ${i}

### Subsection ${i}.2

More content for subsection ${i}.2.

\`\`\`javascript
// Code block in section ${i}
function section${i}Function() {
    console.log("This is section ${i}");
    return "performance test";
}
\`\`\`

> Blockquote in section ${i}: This tests how well the system handles mixed content types.

### Subsection ${i}.3

Final subsection with a table:

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data ${i}.1 | Data ${i}.2 | Data ${i}.3 |
| More ${i}.1 | More ${i}.2 | More ${i}.3 |

`;
    }

    markdown += `
## Final Summary

This large document contains:
- 20 main sections
- 60 subsections (3 per section)
- 20 deep subsections
- Multiple content types: paragraphs, lists, code blocks, blockquotes, tables
- Estimated total blocks: 400+

This tests the batching performance of the toggle headings feature.
`;

    return markdown;
}

async function testLargeDocumentPerformance() {
    console.log('🚀 Large Document Performance Test\n');
    
    if (!process.env.NOTION_TOKEN || !process.env.NOTION_PAGE_ID) {
        console.log('⚠️  Missing NOTION_TOKEN or NOTION_PAGE_ID in .env file');
        console.log('   This test requires real API credentials to measure performance');
        return;
    }
    
    const largeMarkdown = generateLargeMarkdown();
    console.log(`📊 Generated test document:`);
    console.log(`   - Characters: ${largeMarkdown.length.toLocaleString()}`);
    console.log(`   - Lines: ${largeMarkdown.split('\n').length.toLocaleString()}`);
    console.log(`   - Estimated blocks: 400+\n`);
    
    const mockExecuteFunctions = {
        getNode: () => ({ name: 'Performance Test Node' }),
        helpers: {
            httpRequestWithAuthentication: {
                call: async (context, authType, options) => {
                    const fetch = (await import('node-fetch')).default;
                    
                    const startTime = Date.now();
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
                    
                    console.log(`   📡 API call: ${endTime - startTime}ms (${options.body.children.length} blocks)`);
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`API error: ${response.status} - ${errorText}`);
                    }
                    
                    return await response.json();
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
            largeMarkdown,
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
        
        console.log('\n🎉 Performance Test Results:');
        console.log(`✅ Success: ${result.json.success}`);
        console.log(`📊 Total blocks created: ${result.json.blocksAdded}`);
        console.log(`🔄 API calls made: ${result.json.chunksProcessed}`);
        console.log(`⏱️  Total time: ${totalTime.toLocaleString()}ms (${(totalTime/1000).toFixed(1)}s)`);
        console.log(`⚡ Average per block: ${(totalTime / result.json.blocksAdded).toFixed(1)}ms`);
        console.log(`📈 Blocks per second: ${(result.json.blocksAdded / (totalTime/1000)).toFixed(1)}`);
        
        if (result.json.warnings?.length > 0) {
            console.log(`⚠️  Warnings: ${result.json.warnings.length}`);
        }
        
        console.log(`\n🔗 View result: https://notion.so/${process.env.NOTION_PAGE_ID.replace(/-/g, '')}`);
        
        // Performance analysis
        console.log('\n📈 Performance Analysis:');
        if (totalTime < 30000) {
            console.log('🟢 Excellent performance (< 30s)');
        } else if (totalTime < 60000) {
            console.log('🟡 Good performance (30-60s)');
        } else {
            console.log('🔴 Slow performance (> 60s) - consider optimization');
        }
        
        const avgBlocksPerCall = result.json.blocksAdded / result.json.chunksProcessed;
        console.log(`📦 Average blocks per API call: ${avgBlocksPerCall.toFixed(1)}`);
        
        if (avgBlocksPerCall > 90) {
            console.log('✅ Good batching efficiency (near 100 blocks per call)');
        } else if (avgBlocksPerCall > 50) {
            console.log('🟡 Moderate batching efficiency');
        } else {
            console.log('🔴 Low batching efficiency - many small API calls');
        }
        
    } catch (error) {
        console.error('\n❌ Performance test failed:', error.message);
        
        if (error.message.includes('401')) {
            console.error('   🔑 Check your NOTION_TOKEN');
        } else if (error.message.includes('404')) {
            console.error('   📄 Check your NOTION_PAGE_ID');
        } else if (error.message.includes('429')) {
            console.error('   🚦 Rate limited - the document might be too large');
        }
    }
}

testLargeDocumentPerformance();