#!/usr/bin/env node

/**
 * Real Notion API Test for Toggle Headings
 * This script tests the toggle headings functionality with actual Notion API calls
 */

require('dotenv').config();

const testMarkdown = `# Toggle Headings Test

This content should be nested under the main title toggle.

## Features Tested

This section tests the main features:

### Nested Lists

- Feature 1: Basic toggle functionality
- Feature 2: Hierarchical structure
- Feature 3: Content preservation

### Code Blocks

\`\`\`javascript
function testToggle() {
    console.log("This code should be nested under the Code Blocks heading");
    return "success";
}
\`\`\`

## Implementation Details

This section contains implementation information.

> **Note**: This blockquote should be nested under Implementation Details.

### Technical Specs

- API Version: 2022-06-28
- Block Type: heading with is_toggleable: true
- Nesting: Recursive structure support

## Results

Final section with test results.

Some orphan content at the very end.`;

async function testRealNotionAPI() {
    console.log('🚀 Testing Toggle Headings with Real Notion API...\n');
    
    if (!process.env.NOTION_TOKEN || !process.env.NOTION_PAGE_ID) {
        console.error('❌ Missing required environment variables:');
        console.error('   NOTION_TOKEN and NOTION_PAGE_ID must be set in .env file');
        process.exit(1);
    }
    
    // Mock IExecuteFunctions for real API calls
    const mockExecuteFunctions = {
        getNode: () => ({ name: 'Toggle Headings Test Node' }),
        helpers: {
            httpRequestWithAuthentication: {
                call: async (context, authType, options) => {
                    const fetch = (await import('node-fetch')).default;
                    
                    const response = await fetch(options.url, {
                        method: options.method,
                        headers: {
                            'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
                            'Notion-Version': '2022-06-28',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(options.body)
                    });
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Notion API error: ${response.status} ${response.statusText} - ${errorText}`);
                    }
                    
                    return await response.json();
                }
            }
        }
    };
    
    try {
        // Import the compiled node
        const { MarkdownToNotion } = require('./dist/nodes/MarkdownToNotion/MarkdownToNotion.node.js');
        
        console.log('📝 Processing markdown with toggle headings...');
        
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
        
        console.log('\n🎉 Success! Toggle Headings Test Results:');
        console.log(`✅ Success: ${result.json.success}`);
        console.log(`📊 Total blocks added: ${result.json.blocksAdded}`);
        console.log(`🔄 Chunks processed: ${result.json.chunksProcessed}`);
        
        if (result.json.warnings && result.json.warnings.length > 0) {
            console.log(`⚠️  Warnings: ${result.json.warnings.length}`);
            result.json.warnings.forEach((warning, index) => {
                console.log(`   ${index + 1}. ${warning}`);
            });
        }
        
        console.log(`\n🔗 Check your Notion page: https://notion.so/${process.env.NOTION_PAGE_ID.replace(/-/g, '')}`);
        console.log('\n📋 Expected structure:');
        console.log('   📁 Toggle Headings Test (toggleable)');
        console.log('      └── Content under main title');
        console.log('      📁 Features Tested (toggleable)');
        console.log('         └── Section content');
        console.log('         📁 Nested Lists (toggleable)');
        console.log('            └── List items');
        console.log('         📁 Code Blocks (toggleable)');
        console.log('            └── JavaScript code');
        console.log('      📁 Implementation Details (toggleable)');
        console.log('         └── Blockquote');
        console.log('         📁 Technical Specs (toggleable)');
        console.log('            └── Spec list');
        console.log('      📁 Results (toggleable)');
        console.log('         └── Final content');
        console.log('   └── Orphan content (not nested)');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        
        if (error.message.includes('401')) {
            console.error('   🔑 Check your NOTION_TOKEN - it may be invalid or expired');
        } else if (error.message.includes('404')) {
            console.error('   📄 Check your NOTION_PAGE_ID - the page may not exist or be inaccessible');
        } else if (error.message.includes('403')) {
            console.error('   🚫 Check permissions - the integration may not have access to the page');
        }
        
        console.error('\n🔧 Troubleshooting:');
        console.error('   1. Verify NOTION_TOKEN is correct');
        console.error('   2. Verify NOTION_PAGE_ID is correct');
        console.error('   3. Ensure the integration has access to the page');
        console.error('   4. Check that the page exists and is not in trash');
        
        process.exit(1);
    }
}

// Run the test
testRealNotionAPI();