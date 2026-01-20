#!/usr/bin/env node

require('dotenv').config();
const https = require('https');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_PAGE_ID = process.env.NOTION_PAGE_ID;

if (!NOTION_TOKEN || !NOTION_PAGE_ID) {
    console.error('❌ 缺少环境变量: NOTION_TOKEN 或 NOTION_PAGE_ID');
    process.exit(1);
}

async function callNotionAPI(pageId, blocks) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ children: blocks });
        
        const options = {
            hostname: 'api.notion.com',
            port: 443,
            path: `/v1/blocks/${pageId}/children`,
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${NOTION_TOKEN}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${parsed.message || responseData}`));
                    }
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}, Response: ${responseData}`));
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(data);
        req.end();
    });
}

async function testToggleHeadingsFeature() {
    console.log('🔍 测试 Toggle Headings 功能...');
    
    const testMarkdown = `# Toggle Headings 功能测试

## 普通模式 vs Toggle 模式对比

### 这是 H3 标题
这是 H3 标题下的内容。

#### 这是 H4 标题  
这是 H4 标题下的内容。

##### 这是 H5 标题
这是 H5 标题下的内容（应该变成粗体段落）。

###### 这是 H6 标题
这是 H6 标题下的内容（应该变成粗体段落）。

## 复杂内容测试

### 包含链接的标题 [链接](https://example.com)

这个标题包含链接，测试 toggle 模式下是否正确处理。

### 包含数学公式的标题 $E = mc^2$

这个标题包含数学公式。

### 包含格式的标题 **粗体** 和 *斜体*

这个标题包含多种格式。

## 嵌套内容测试

### 父级标题

这是父级内容。

#### 子级标题

这是子级内容，包含：

- 列表项 1
- 列表项 2 [带链接](https://github.com)

还有代码块：

\`\`\`javascript
console.log("Hello Toggle!");
\`\`\`

和数学公式：$f(x) = x^2 + 1$

##### 更深层级的标题

这是更深层级的内容。
`;

    try {
        console.log('📦 测试普通标题模式...');
        
        // 导入实际的转换模块
        const { MarkdownToNotion } = require('../dist/nodes/MarkdownToNotion/MarkdownToNotion.node.js');
        
        // 测试普通模式（toggleHeadings = false）
        const normalBlocks = await MarkdownToNotion.convertMarkdownToNotionBlocks(
            testMarkdown, 
            true,    // preserveMath
            '$',     // mathDelimiter  
            true,    // supportLatex
            false    // toggleHeadings
        );
        
        console.log(`📊 普通模式生成了 ${normalBlocks.length} 个块`);
        
        // 添加分隔符
        const separatorBlocks = [
            {
                object: 'block',
                type: 'divider',
                divider: {}
            },
            {
                object: 'block',
                type: 'heading_1',
                heading_1: {
                    rich_text: [{
                        type: 'text',
                        text: { content: '🔄 以下是 Toggle Headings 模式' }
                    }]
                }
            },
            {
                object: 'block',
                type: 'divider',
                divider: {}
            }
        ];
        
        // 测试 Toggle 模式（toggleHeadings = true）
        const toggleBlocks = await MarkdownToNotion.convertMarkdownToNotionBlocks(
            testMarkdown,
            true,    // preserveMath
            '$',     // mathDelimiter
            true,    // supportLatex  
            true     // toggleHeadings
        );
        
        console.log(`📊 Toggle 模式生成了 ${toggleBlocks.length} 个块`);
        
        // 合并所有块
        const allBlocks = [...normalBlocks, ...separatorBlocks, ...toggleBlocks];
        
        console.log(`📤 发送 ${allBlocks.length} 个块到 Notion...`);
        
        const response = await callNotionAPI(NOTION_PAGE_ID, allBlocks);
        console.log(`✅ 成功添加 ${response.results?.length || 0} 个块到 Notion`);
        
        console.log('\n🔍 测试结果分析：');
        console.log('1. 对比普通标题和 Toggle 标题的视觉效果');
        console.log('2. 检查 Toggle 标题是否可以折叠/展开');
        console.log('3. 验证不同级别标题的颜色区分');
        console.log('4. 确认 H5/H6 仍然转换为粗体段落');
        console.log('5. 测试复杂内容（链接、公式、格式）在 Toggle 模式下的表现');
        
        console.log(`\n🌐 请访问 Notion 页面查看结果：`);
        console.log(`https://notion.so/${NOTION_PAGE_ID.replace(/-/g, '')}`);
        
        console.log('\n📋 评估要点：');
        console.log('- Toggle 标题是否提供了更好的文档组织体验？');
        console.log('- 不同级别的标题是否有明显的视觉区分？');
        console.log('- 复杂内容是否在 Toggle 模式下正确显示？');
        console.log('- 功能是否满足用户需求？');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error('详细错误:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    testToggleHeadingsFeature();
}