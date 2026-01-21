const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import the compiled node
const { MarkdownToNotion } = require('./dist/nodes/MarkdownToNotion/MarkdownToNotion.node.js');

// Test markdown with hierarchical content
const testMarkdown = `# Main Heading 1

This is content under heading 1.

## Sub Heading 1.1

Content under sub heading 1.1.

### Sub Sub Heading 1.1.1

Content under sub sub heading 1.1.1.

## Sub Heading 1.2

Content under sub heading 1.2.

# Main Heading 2

This is content under heading 2.

Some more content here.

## Sub Heading 2.1

Content under sub heading 2.1.`;

// Mock IExecuteFunctions for testing
const mockExecuteFunctions = {
    getInputData: () => [{ json: {} }],
    getNodeParameter: (paramName) => {
        switch (paramName) {
            case 'operation':
                return 'appendToPage';
            case 'pageId':
                return process.env.NOTION_PAGE_ID;
            case 'markdown':
                return testMarkdown;
            case 'options':
                return {
                    preserveFormulas: true,
                    mathDelimiter: '$',
                    toggleHeadings: true  // Enable toggle headings
                };
            default:
                return undefined;
        }
    },
    getCredentials: async () => ({
        apiKey: process.env.NOTION_TOKEN
    }),
    helpers: {
        request: async (options) => {
            console.log('API Request:', JSON.stringify(options, null, 2));
            
            // Mock successful response
            return {
                results: new Array(options.body.children.length).fill({}),
                has_more: false
            };
        }
    },
    getNode: () => ({ name: 'Test Node' })
};

async function testToggleHeadings() {
    console.log('🧪 Testing Toggle Headings Feature...\n');
    
    try {
        // Test the block conversion directly
        console.log('🔍 Testing block conversion directly...');
        const blocks = await MarkdownToNotion.convertMarkdownToNotionBlocks(
            testMarkdown,
            true,  // preserveMath
            '$',   // mathDelimiter
            true,  // supportLatex
            true   // toggleHeadings
        );
        
        console.log('Generated blocks:');
        blocks.forEach((block, index) => {
            console.log(`\nBlock ${index + 1}:`);
            console.log(`Type: ${block.type}`);
            
            if (block.type === 'toggle') {
                console.log(`Toggle text: ${JSON.stringify(block.toggle.rich_text)}`);
                if (block.toggle.children) {
                    console.log(`Children count: ${block.toggle.children.length}`);
                    block.toggle.children.forEach((child, childIndex) => {
                        console.log(`  Child ${childIndex + 1}: ${child.type}`);
                    });
                } else {
                    console.log('No children');
                }
            } else {
                console.log(`Content: ${JSON.stringify(block, null, 2)}`);
            }
        });
        
        // Verify the structure
        console.log('\n✅ Verification:');
        const toggleBlocks = blocks.filter(b => b.type === 'toggle');
        console.log(`Found ${toggleBlocks.length} toggle blocks`);
        
        toggleBlocks.forEach((toggle, index) => {
            const hasChildren = toggle.toggle.children && toggle.toggle.children.length > 0;
            console.log(`Toggle ${index + 1}: ${hasChildren ? 'HAS' : 'NO'} children (${toggle.toggle.children?.length || 0})`);
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testToggleHeadings();