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

async function testLinkHandling() {
    const testMarkdown = `# 🔍 链接丢失问题全面测试 - ${new Date().toLocaleString()}

## 1. 普通段落中的链接（应该正常）
这是一个包含 [普通链接](https://example.com) 的段落。
多个链接：[Google](https://google.com) 和 [GitHub](https://github.com)。

## 2. 列表中的链接（应该正常）
- 无序列表：[列表链接1](https://github.com)
- 另一项：[列表链接2](https://stackoverflow.com)

1. 有序列表：[有序链接1](https://notion.so)
2. 第二项：[有序链接2](https://www.notion.so/product)

## 3. 引用块中的链接（可能丢失）
> 这是引用块，包含 [引用链接1](https://stackoverflow.com)
> 
> 多行引用：[引用链接2](https://github.com/microsoft/vscode)
> 
> 引用中的 **粗体 [粗体引用链接](https://example.com/bold)** 和 *斜体 [斜体引用链接](https://example.com/italic)*

## 4. 表格中的链接（可能丢失）
| 网站名称 | 链接地址 | 描述 |
|---------|---------|------|
| Google | [搜索引擎](https://google.com) | 全球最大搜索引擎 |
| GitHub | [代码仓库](https://github.com) | 开发者社区 |
| Stack Overflow | [问答社区](https://stackoverflow.com) | 编程问答 |
| Notion | [笔记工具](https://notion.so) | 全能工作空间 |

## 5. 表格中的数学公式（可能显示占位符）
| 公式名称 | 数学表达式 | 说明 |
|---------|-----------|------|
| 质能方程 | $E = mc^2$ | 爱因斯坦质能关系 |
| 勾股定理 | $a^2 + b^2 = c^2$ | 直角三角形关系 |
| 二次公式 | $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$ | 求解二次方程 |

## 6. Toggle 块中的链接（可能丢失）
<details>
<summary>展开查看更多链接</summary>

这里有详细的链接：
- [Toggle 内链接1](https://example.com/toggle1)
- [Toggle 内链接2](https://example.com/toggle2)

还有数学公式：$f(x) = x^2 + 1$

</details>

## 7. 混合格式中的链接
**粗体中的 [粗体链接](https://example.com/bold)**

*斜体中的 [斜体链接](https://example.com/italic)*

~~删除线中的 [删除线链接](https://example.com/strike)~~

\`行内代码中的 [代码链接](https://example.com/code)\` （不应该解析为链接）

## 8. 复杂嵌套场景
- **列表项中的粗体 [嵌套链接1](https://example.com/nested1)**
- > 列表项中的引用 [嵌套链接2](https://example.com/nested2)
- 列表项中的公式：$y = mx + b$ 和链接 [混合链接](https://example.com/mixed)

## 9. 裸链接（应该变成书签）
https://www.example.com

## 测试说明
请检查 Notion 页面中：
1. 哪些链接可以正常点击
2. 哪些链接变成了纯文本
3. 数学公式是否正确显示
4. 是否出现 MATHPLACEHOLDER 占位符
`;

    try {
        console.log('🚀 开始链接丢失问题测试...');
        
        // 导入实际的转换模块
        const { MarkdownToNotion } = require('../dist/nodes/MarkdownToNotion/MarkdownToNotion.node.js');
        
        // 使用实际的转换逻辑
        const blocks = await MarkdownToNotion.convertMarkdownToNotionBlocks(testMarkdown, true, '$', true);
        
        console.log(`📦 生成了 ${blocks.length} 个块`);
        
        // 分析生成的块结构
        console.log('\n🔍 分析生成的块结构：');
        blocks.forEach((block, index) => {
            console.log(`\n${index + 1}. ${block.type}:`);
            
            if (block.type === 'table') {
                console.log('  表格结构：');
                block.table.children.forEach((row, rowIndex) => {
                    console.log(`    行 ${rowIndex + 1}:`, JSON.stringify(row.table_row.cells, null, 2));
                });
            } else if (block[block.type] && block[block.type].rich_text) {
                console.log('  富文本内容：');
                block[block.type].rich_text.forEach((rt, rtIndex) => {
                    console.log(`    ${rtIndex + 1}. 类型: ${rt.type}, 内容: "${rt.text?.content || rt.equation?.expression}"${rt.text?.link ? `, 链接: ${rt.text.link.url}` : ''}`);
                });
            }
        });
        
        // 发送到 Notion
        console.log('\n📤 发送到 Notion...');
        const response = await callNotionAPI(NOTION_PAGE_ID, blocks);
        console.log(`✅ 成功添加 ${response.results?.length || 0} 个块到 Notion`);
        
        console.log('\n🌐 请访问 Notion 页面检查结果：');
        console.log(`https://notion.so/${NOTION_PAGE_ID.replace(/-/g, '')}`);
        
        console.log('\n🔍 检查要点：');
        console.log('1. 引用块中的链接是否可点击');
        console.log('2. 表格单元格中的链接是否可点击');
        console.log('3. Toggle 块中的链接是否可点击');
        console.log('4. 表格中的数学公式是否正确显示');
        console.log('5. 是否出现 MATHPLACEHOLDER 占位符');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error('详细错误:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    testLinkHandling();
}