#!/usr/bin/env node

/**
 * Complete Toggle Headings Test
 * Tests the full toggle headings functionality with nested structure
 */

const { MarkdownToNotion } = require('./dist/nodes/MarkdownToNotion/MarkdownToNotion.node.js');
require('dotenv').config();

// Test markdown with hierarchical structure
const testMarkdown = `# Main Title

This is content under the main title. It should be nested under the toggle.

## Section 1

Content for section 1. This should be under the Section 1 toggle.

### Subsection 1.1

Content for subsection 1.1. This should be nested under Subsection 1.1.

- List item 1
- List item 2
- List item 3

### Subsection 1.2

Content for subsection 1.2.

\`\`\`javascript
console.log("Code block in subsection 1.2");
\`\`\`

## Section 2

Content for section 2.

> This is a blockquote in section 2.

### Subsection 2.1

More content here.

## Section 3

Final section content.

Some orphan content at the end without a heading.`;

async function testToggleHeadings() {
    console.log('🧪 Testing Toggle Headings Structure...\n');
    
    try {
        // Test the structure building
        const structure = await MarkdownToNotion.convertMarkdownToToggleStructure(
            testMarkdown,
            true,  // preserveMath
            '$',   // mathDelimiter
            true   // supportLatex
        );
        
        console.log('📊 Structure Analysis:');
        console.log(`- Root nodes: ${structure.rootNodes.length}`);
        console.log(`- Orphan blocks: ${structure.orphanBlocks.length}`);
        
        // Analyze each root node
        structure.rootNodes.forEach((rootNode, index) => {
            console.log(`\n🏗️  Root Node ${index + 1}:`);
            console.log(`  - Level: ${rootNode.level}`);
            console.log(`  - Heading: ${getHeadingText(rootNode.heading)}`);
            console.log(`  - Direct children: ${rootNode.children.length}`);
            console.log(`  - Sub-headings: ${rootNode.subHeadings.length}`);
            
            // Analyze sub-headings
            rootNode.subHeadings.forEach((subHeading, subIndex) => {
                console.log(`    📝 Sub-heading ${subIndex + 1}:`);
                console.log(`      - Level: ${subHeading.level}`);
                console.log(`      - Text: ${getHeadingText(subHeading.heading)}`);
                console.log(`      - Children: ${subHeading.children.length}`);
                console.log(`      - Sub-headings: ${subHeading.subHeadings.length}`);
                
                // Analyze nested sub-headings
                subHeading.subHeadings.forEach((nestedSub, nestedIndex) => {
                    console.log(`        🔸 Nested ${nestedIndex + 1}:`);
                    console.log(`          - Level: ${nestedSub.level}`);
                    console.log(`          - Text: ${getHeadingText(nestedSub.heading)}`);
                    console.log(`          - Children: ${nestedSub.children.length}`);
                });
            });
        });
        
        console.log('\n✅ Structure test completed successfully!');
        
        // Test with real API if credentials are available
        if (process.env.NOTION_TOKEN && process.env.NOTION_PAGE_ID) {
            console.log('\n🌐 Testing with real Notion API...');
            await testWithRealAPI(testMarkdown);
        } else {
            console.log('\n⚠️  Skipping real API test (missing NOTION_TOKEN or NOTION_PAGE_ID)');
            console.log('   Add these to .env file to test with real Notion API');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

function getHeadingText(headingBlock) {
    const types = ['heading_1', 'heading_2', 'heading_3', 'heading_4'];
    for (const type of types) {
        if (headingBlock[type]?.rich_text?.[0]?.text?.content) {
            return headingBlock[type].rich_text[0].text.content;
        }
    }
    return 'Unknown';
}

async function testWithRealAPI(markdown) {
    // Mock the IExecuteFunctions interface for testing
    const mockExecuteFunctions = {
        getNode: () => ({ name: 'Test Node' }),
        helpers: {
            httpRequestWithAuthentication: {
                call: async (context, authType, options) => {
                    // Mock successful response
                    return {
                        object: 'list',
                        results: [
                            {
                                id: 'mock-block-id-' + Math.random().toString(36).substr(2, 9),
                                object: 'block',
                                type: options.body.children[0].type
                            }
                        ]
                    };
                }
            }
        }
    };
    
    try {
        const result = await MarkdownToNotion.processToggleHeadingsWithAPI(
            mockExecuteFunctions,
            process.env.NOTION_PAGE_ID,
            markdown,
            {
                preserveMath: true,
                mathDelimiter: '$',
                supportLatex: true,
                toggleHeadings: true
            },
            0
        );
        
        console.log('🎉 API Test Results:');
        console.log(`- Success: ${result.json.success}`);
        console.log(`- Blocks added: ${result.json.blocksAdded}`);
        console.log(`- Chunks processed: ${result.json.chunksProcessed}`);
        
        if (result.json.warnings) {
            console.log(`- Warnings: ${result.json.warnings.length}`);
        }
        
    } catch (error) {
        console.error('❌ API test failed:', error.message);
    }
}

// Run the test
testToggleHeadings();