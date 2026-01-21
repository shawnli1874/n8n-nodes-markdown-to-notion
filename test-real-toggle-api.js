const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import the compiled node
const { MarkdownToNotion } = require('./dist/nodes/MarkdownToNotion/MarkdownToNotion.node.js');

// Test markdown with hierarchical content
const testMarkdown = `# 🎯 正确的 Toggle Heading 测试

这是主标题下的内容，现在应该显示为真正的 toggle heading。

## 📋 子标题测试

这是子标题下的内容。

### 📝 三级标题

这是三级标题的内容。

## 🔧 另一个子标题

更多内容在这里。`;

async function testRealToggleHeadingAPI() {
    console.log('🚀 Testing Real Toggle Heading API...\n');
    
    try {
        // Test the block conversion
        const blocks = await MarkdownToNotion.convertMarkdownToNotionBlocks(
            testMarkdown,
            true,  // preserveMath
            '$',   // mathDelimiter
            true,  // supportLatex
            true   // toggleHeadings
        );
        
        console.log(`Generated ${blocks.length} blocks:`);
        blocks.forEach((block, index) => {
            if (block.type.startsWith('heading_')) {
                const headingData = block[block.type];
                console.log(`${index + 1}. ${block.type}: "${headingData.rich_text[0].text.content}" (toggleable: ${headingData.is_toggleable})`);
            } else {
                console.log(`${index + 1}. ${block.type}: "${block[block.type]?.rich_text?.[0]?.text?.content || 'N/A'}"`);
            }
        });
        
        // Make real API call to Notion
        console.log('\n📡 Making real API call to Notion...');
        
        const options = {
            method: 'PATCH',
            url: `https://api.notion.com/v1/blocks/${process.env.NOTION_PAGE_ID}/children`,
            headers: {
                'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ children: blocks }),
        };
        
        const fetch = require('node-fetch');
        const response = await fetch(options.url, {
            method: options.method,
            headers: options.headers,
            body: options.body
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ Successfully added blocks to Notion!');
            console.log(`Added ${result.results?.length || 0} blocks`);
            console.log(`Page URL: https://notion.so/${process.env.NOTION_PAGE_ID.replace(/-/g, '')}`);
            
            // Check if any blocks have is_toggleable
            const toggleableBlocks = result.results?.filter(block => 
                block.type.startsWith('heading_') && block[block.type].is_toggleable
            ) || [];
            
            console.log(`\n🎯 Toggle Heading Verification:`);
            console.log(`Found ${toggleableBlocks.length} toggleable headings in API response`);
            
            if (toggleableBlocks.length > 0) {
                console.log('✅ SUCCESS: Notion API accepted toggle headings!');
                toggleableBlocks.forEach((block, index) => {
                    const headingData = block[block.type];
                    console.log(`  ${index + 1}. ${block.type}: "${headingData.rich_text[0].text.content}"`);
                });
            } else {
                console.log('❌ WARNING: No toggleable headings found in response');
            }
            
        } else {
            console.error('❌ Notion API Error:', result);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testRealToggleHeadingAPI();