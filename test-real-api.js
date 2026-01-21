const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import the compiled node
const { MarkdownToNotion } = require('./dist/nodes/MarkdownToNotion/MarkdownToNotion.node.js');

// Test markdown with hierarchical content
const testMarkdown = `# 测试 Toggle Headings 功能

这是主标题下的内容。

## 子标题 1

这是子标题 1 下的内容。

### 子子标题 1.1

这是子子标题 1.1 下的内容。

## 子标题 2

这是子标题 2 下的内容。

# 第二个主标题

这是第二个主标题下的内容。

更多内容在这里。`;

async function testRealNotionAPI() {
    console.log('🚀 Testing Toggle Headings with Real Notion API...\n');
    
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
            if (block.type === 'toggle') {
                console.log(`${index + 1}. Toggle: "${block.toggle.rich_text[0].text.content}" (${block.toggle.children?.length || 0} children)`);
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
        } else {
            console.error('❌ Notion API Error:', result);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testRealNotionAPI();