#!/usr/bin/env node

// 链接丢失排查测试脚本
// 用于测试各种 Markdown 链接格式在 Notion 中的表现

require('dotenv').config();
const https = require('https');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_PAGE_ID = process.env.NOTION_PAGE_ID;

if (!NOTION_TOKEN || !NOTION_PAGE_ID) {
    console.error('❌ 缺少环境变量: NOTION_TOKEN 或 NOTION_PAGE_ID');
    process.exit(1);
}

// 测试用的 Markdown 内容
const testMarkdown = `# 链接丢失排查测试

## 1. 普通段落链接
这是一个普通段落中的 [标题链接](https://example.com)，应该保留链接。

## 2. 列表中的链接
- 无序列表项：[列表链接](https://github.com)
- 另一个项目：[GitHub](https://github.com/microsoft/vscode)

1. 有序列表项：[有序链接](https://notion.so)
2. 第二项：[Notion](https://www.notion.so/product)

## 3. 引用块中的链接
> 这是引用块，包含 [引用链接](https://stackoverflow.com)
> 
> 多行引用：[Stack Overflow](https://stackoverflow.com/questions)

## 4. 表格中的链接
| 网站 | 链接 |
|------|------|
| Google | [搜索引擎](https://google.com) |
| GitHub | [代码仓库](https://github.com) |

## 5. 代码块（应该不解析链接）
\`\`\`
这里的 [链接](https://example.com) 不应该被解析
\`\`\`

## 6. 行内代码（应该不解析链接）
这是行内代码：\`[链接](https://example.com)\`，不应该被解析。

## 7. HTML/Toggle 块中的链接
<details>
<summary>展开查看详情</summary>
这里有个 [详情链接](https://example.com)，可能会丢失。
</details>

## 8. 混合格式
**粗体中的 [粗体链接](https://example.com)**

*斜体中的 [斜体链接](https://example.com)*

~~删除线中的 [删除线链接](https://example.com)~~

## 9. 复杂嵌套
- **列表项中的粗体 [嵌套链接](https://example.com)**
- > 列表项中的引用 [引用嵌套链接](https://example.com)

## 10. 裸链接（应该变成书签）
https://www.example.com

## 测试完成
以上测试了各种链接格式，请检查 Notion 中哪些链接丢失了。
`;

// 简化的 Notion API 调用函数
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

// 简化的 Markdown 转换（复用主代码逻辑）
async function convertMarkdownToBlocks(markdown) {
    // 这里需要导入主代码的转换逻辑
    // 为了简化，我们先创建一个基本的测试块
    const blocks = [
        {
            object: 'block',
            type: 'heading_1',
            heading_1: {
                rich_text: [{
                    type: 'text',
                    text: { content: '🔍 链接丢失排查测试 - ' + new Date().toLocaleString() }
                }]
            }
        },
        {
            object: 'block',
            type: 'paragraph',
            paragraph: {
                rich_text: [
                    {
                        type: 'text',
                        text: { content: '普通段落中的 ' }
                    },
                    {
                        type: 'text',
                        text: { 
                            content: '链接文本',
                            link: { url: 'https://example.com' }
                        }
                    },
                    {
                        type: 'text',
                        text: { content: ' 应该保留链接。' }
                    }
                ]
            }
        },
        {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [
                    {
                        type: 'text',
                        text: { content: '列表项中的 ' }
                    },
                    {
                        type: 'text',
                        text: { 
                            content: '列表链接',
                            link: { url: 'https://github.com' }
                        }
                    }
                ]
            }
        },
        {
            object: 'block',
            type: 'quote',
            quote: {
                rich_text: [
                    {
                        type: 'text',
                        text: { content: '引用块中的 ' }
                    },
                    {
                        type: 'text',
                        text: { 
                            content: '引用链接',
                            link: { url: 'https://stackoverflow.com' }
                        }
                    }
                ]
            }
        },
        {
            object: 'block',
            type: 'table',
            table: {
                table_width: 2,
                has_column_header: true,
                has_row_header: false,
                children: [
                    {
                        object: 'block',
                        type: 'table_row',
                        table_row: {
                            cells: [
                                [{ type: 'text', text: { content: '网站' } }],
                                [{ type: 'text', text: { content: '链接' } }]
                            ]
                        }
                    },
                    {
                        object: 'block',
                        type: 'table_row',
                        table_row: {
                            cells: [
                                [{ type: 'text', text: { content: 'Google' } }],
                                [{ 
                                    type: 'text', 
                                    text: { 
                                        content: '搜索引擎',
                                        link: { url: 'https://google.com' }
                                    } 
                                }]
                            ]
                        }
                    }
                ]
            }
        },
        {
            object: 'block',
            type: 'paragraph',
            paragraph: {
                rich_text: [{
                    type: 'text',
                    text: { content: '✅ 测试块已添加，请检查 Notion 页面中的链接是否正确显示。' }
                }]
            }
        }
    ];
    
    return blocks;
}

async function main() {
    try {
        console.log('🚀 开始链接丢失排查测试...');
        console.log(`📄 目标页面: ${NOTION_PAGE_ID}`);
        
        // 转换 Markdown 为 Notion 块
        const blocks = await convertMarkdownToBlocks(testMarkdown);
        console.log(`📦 生成了 ${blocks.length} 个测试块`);
        
        // 发送到 Notion
        const response = await callNotionAPI(NOTION_PAGE_ID, blocks);
        console.log(`✅ 成功添加 ${response.results?.length || 0} 个块到 Notion`);
        
        console.log('\n🔍 请检查 Notion 页面中的以下链接：');
        console.log('1. 普通段落中的链接是否可点击');
        console.log('2. 列表项中的链接是否可点击');
        console.log('3. 引用块中的链接是否可点击');
        console.log('4. 表格单元格中的链接是否可点击');
        console.log('5. 对比实际的 n8n 节点转换结果');
        
        console.log(`\n🌐 Notion 页面链接: https://notion.so/${NOTION_PAGE_ID.replace(/-/g, '')}`);
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}