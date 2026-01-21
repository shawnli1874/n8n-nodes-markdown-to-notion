const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import the compiled node
const { MarkdownToNotion } = require('./dist/nodes/MarkdownToNotion/MarkdownToNotion.node.js');

// Test markdown with complex hierarchical content
const testMarkdown = `# 🎯 完整的 Toggle Headings 测试

这是主标题下的内容，应该成为主标题的子块。

这是主标题下的第二段内容。

## 📋 子标题 1

这是子标题 1 下的内容。

- 这是一个列表项
- 这是另一个列表项

### 📝 三级标题 1.1

这是三级标题下的内容。

\`\`\`javascript
console.log('这是代码块');
\`\`\`

### 📝 三级标题 1.2

这是另一个三级标题的内容。

## 🔧 子标题 2

这是子标题 2 下的内容。

> 这是一个引用块

# 🚀 第二个主标题

这是第二个主标题下的内容。

## 📊 子标题 2.1

这是第二个主标题下的子标题内容。

没有标题的孤立内容，应该在根级别。`;

// Mock IExecuteFunctions for testing
const mockExecuteFunctions = {
    getInputData: () => [{ 
        json: { 
            markdown: testMarkdown 
        } 
    }],
    continueOnFail: () => false,
    getNodeParameter: (paramName) => {
        switch (paramName) {
            case 'operation':
                return 'appendToPage';
            case 'pageId':
                return process.env.NOTION_PAGE_ID;
            case 'markdownContent':
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
        httpRequestWithAuthentication: async function(credentialType, options) {
            console.log(`📡 API Call to: ${options.url}`);
            console.log(`📦 Body: ${JSON.stringify(options.body, null, 2)}`);
            
            const fetch = require('node-fetch');
            const response = await fetch(options.url, {
                method: options.method,
                headers: {
                    'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(options.body)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                console.error('❌ API Error:', result);
                throw new Error(`API Error: ${result.message || 'Unknown error'}`);
            }
            
            console.log(`✅ API Success: Added ${result.results?.length || 0} blocks`);
            return result;
        }
    },
    getNode: () => ({ name: 'Test Node' })
};

async function testCompleteToggleHeadings() {
    console.log('🚀 Testing Complete Toggle Headings Implementation...\n');
    
    try {
        const node = new MarkdownToNotion();
        const result = await node.execute.call(mockExecuteFunctions);
        
        console.log('\n🎯 Final Result:');
        console.log(JSON.stringify(result[0][0].json, null, 2));
        
        const resultData = result[0][0].json;
        
        console.log('\n📊 Summary:');
        console.log(`✅ Success: ${resultData.success}`);
        console.log(`📄 Page ID: ${resultData.pageId}`);
        console.log(`🧱 Total Blocks Added: ${resultData.blocksAdded}`);
        console.log(`📦 API Calls Made: ${resultData.chunksProcessed}`);
        console.log(`⚠️  Warnings: ${resultData.warnings?.length || 0}`);
        
        if (resultData.warnings && resultData.warnings.length > 0) {
            console.log('Warnings:', resultData.warnings);
        }
        
        console.log(`\n🔗 View in Notion: https://notion.so/${process.env.NOTION_PAGE_ID.replace(/-/g, '')}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testCompleteToggleHeadings();