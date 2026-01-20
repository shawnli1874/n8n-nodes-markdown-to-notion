#!/usr/bin/env node

// 使用实际 n8n 节点逻辑测试链接丢失问题

require('dotenv').config();
const https = require('https');

// 导入实际的转换逻辑（简化版）
const unified = require('unified');
const remarkParse = require('remark-parse');
const remarkGfm = require('remark-gfm');
const { toString: mdastToString } = require('mdast-util-to-string');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_PAGE_ID = process.env.NOTION_PAGE_ID;

// 复制主代码的转换逻辑（简化版）
class MarkdownToNotionTest {
    static async convertMarkdownToNotionBlocks(markdown) {
        const processor = unified()
            .use(remarkParse)
            .use(remarkGfm);

        const tree = processor.parse(markdown);
        const blocks = [];

        for (const node of tree.children) {
            const nodeBlocks = this.nodeToBlocks(node, {});
            blocks.push(...nodeBlocks);
        }

        return blocks;
    }

    static nodeToBlocks(node, mathPlaceholders) {
        switch (node.type) {
            case 'heading':
                return [this.createHeadingBlock(node, mathPlaceholders)];
            case 'paragraph': {
                const content = mdastToString(node).trim();
                
                if (this.isStandaloneUrl(content)) {
                    return [this.createBookmarkBlock(content)];
                }
                
                return [this.createParagraphBlock(node, mathPlaceholders)];
            }
            case 'list':
                return this.createListBlocks(node, mathPlaceholders);
            case 'blockquote':
                return [this.createQuoteBlock(node, mathPlaceholders)];
            case 'table':
                return [this.createTableBlock(node)];
            default:
                return [];
        }
    }

    static createHeadingBlock(node, mathPlaceholders) {
        const level = node.depth;
        const headingType = `heading_${Math.min(level, 4)}`;
        
        return {
            object: 'block',
            type: headingType,
            [headingType]: {
                rich_text: this.inlineNodesToRichText(node.children || [], mathPlaceholders),
            },
        };
    }

    static createParagraphBlock(node, mathPlaceholders) {
        return {
            object: 'block',
            type: 'paragraph',
            paragraph: {
                rich_text: this.inlineNodesToRichText(node.children || [], mathPlaceholders),
            },
        };
    }

    static createListBlocks(listNode, mathPlaceholders) {
        const blocks = [];
        const isOrdered = listNode.ordered;
        
        for (const listItem of listNode.children) {
            if (listItem.type === 'listItem') {
                const block = this.createListItemBlock(listItem, isOrdered, mathPlaceholders);
                blocks.push(block);
            }
        }
        
        return blocks;
    }

    static createListItemBlock(listItem, isOrdered, mathPlaceholders) {
        const blockType = isOrdered ? 'numbered_list_item' : 'bulleted_list_item';
        
        let richText = [];
        
        if (listItem.children && listItem.children.length > 0) {
            const firstChild = listItem.children[0];
            
            if (firstChild.type === 'paragraph') {
                richText = this.inlineNodesToRichText(firstChild.children || [], mathPlaceholders);
            }
        }
        
        return {
            object: 'block',
            type: blockType,
            [blockType]: {
                rich_text: richText,
            },
        };
    }

    static createQuoteBlock(node, mathPlaceholders) {
        return {
            object: 'block',
            type: 'quote',
            quote: {
                rich_text: this.inlineNodesToRichText(node.children || [], mathPlaceholders),
            },
        };
    }

    // 这是关键函数 - 处理内联元素包括链接
    static inlineNodesToRichText(nodes, mathPlaceholders) {
        const richText = [];
        
        for (const node of nodes) {
            switch (node.type) {
                case 'text': {
                    richText.push({
                        type: 'text',
                        text: { content: node.value },
                    });
                    break;
                }
                case 'strong': {
                    const strongText = this.inlineNodesToRichText(node.children || [], mathPlaceholders);
                    for (const rt of strongText) {
                        rt.annotations = { ...rt.annotations, bold: true };
                    }
                    richText.push(...strongText);
                    break;
                }
                case 'emphasis': {
                    const emphasisText = this.inlineNodesToRichText(node.children || [], mathPlaceholders);
                    for (const rt of emphasisText) {
                        rt.annotations = { ...rt.annotations, italic: true };
                    }
                    richText.push(...emphasisText);
                    break;
                }
                case 'link': {
                    console.log('🔗 处理链接:', { url: node.url, children: node.children });
                    const linkText = this.inlineNodesToRichText(node.children || [], mathPlaceholders);
                    for (const rt of linkText) {
                        rt.text.link = { url: node.url };
                    }
                    richText.push(...linkText);
                    break;
                }
                case 'inlineCode': {
                    richText.push({
                        type: 'text',
                        text: { content: node.value },
                        annotations: { code: true },
                    });
                    break;
                }
                default: {
                    const fallbackContent = mdastToString(node);
                    if (fallbackContent) {
                        richText.push({
                            type: 'text',
                            text: { content: fallbackContent },
                        });
                    }
                    break;
                }
            }
        }
        
        return richText;
    }

    // 问题可能在这里 - 表格处理
    static createTableBlock(node) {
        console.log('📊 处理表格:', node);
        const rows = node.children || [];
        const tableWidth = rows.length > 0 ? (rows[0].children || []).length : 1;

        const children = [];

        for (const row of rows) {
            const cells = row.children || [];
            const rowCells = [];

            for (const cell of cells) {
                // 🚨 这里是问题！使用 mdastToString 会丢失链接信息
                const cellContent = mdastToString(cell).trim();
                console.log('📝 表格单元格内容:', cellContent);
                console.log('📝 表格单元格原始节点:', JSON.stringify(cell, null, 2));
                
                rowCells.push([{
                    type: 'text',
                    text: {
                        content: cellContent,
                    },
                }]);
            }

            if (rowCells.length > 0) {
                children.push({
                    object: 'block',
                    type: 'table_row',
                    table_row: {
                        cells: rowCells,
                    },
                });
            }
        }

        return {
            object: 'block',
            type: 'table',
            table: {
                table_width: tableWidth,
                has_column_header: true,
                has_row_header: false,
                children: children,
            },
        };
    }

    static createBookmarkBlock(url) {
        return {
            object: 'block',
            type: 'bookmark',
            bookmark: {
                url: url,
            },
        };
    }

    static isStandaloneUrl(content) {
        try {
            const url = new URL(content.trim());
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }
}

// Notion API 调用
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

async function main() {
    const testMarkdown = `# 🔍 链接丢失问题排查 - ${new Date().toLocaleString()}

## 普通段落测试
这是一个包含 [普通链接](https://example.com) 的段落。

## 列表测试
- 这是 [列表中的链接](https://github.com)
- 另一个 [GitHub 链接](https://github.com/microsoft/vscode)

## 引用测试
> 引用块中的 [引用链接](https://stackoverflow.com)

## 表格测试（重点）
| 网站名称 | 链接地址 |
|---------|---------|
| Google | [搜索引擎](https://google.com) |
| GitHub | [代码仓库](https://github.com) |
| Stack Overflow | [问答社区](https://stackoverflow.com) |

## 混合格式测试
**粗体中的 [粗体链接](https://example.com/bold)**

*斜体中的 [斜体链接](https://example.com/italic)*
`;

    try {
        console.log('🚀 开始实际转换测试...');
        
        // 使用实际的转换逻辑
        const blocks = await MarkdownToNotionTest.convertMarkdownToNotionBlocks(testMarkdown);
        
        console.log('\n📦 生成的块结构:');
        blocks.forEach((block, index) => {
            console.log(`${index + 1}. ${block.type}:`, JSON.stringify(block, null, 2));
        });
        
        // 发送到 Notion
        const response = await callNotionAPI(NOTION_PAGE_ID, blocks);
        console.log(`\n✅ 成功添加 ${response.results?.length || 0} 个块到 Notion`);
        
        console.log('\n🔍 请检查 Notion 页面，特别关注：');
        console.log('1. 表格中的链接是否变成了纯文本');
        console.log('2. 其他位置的链接是否正常');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error('详细错误:', error);
    }
}

if (require.main === module) {
    main();
}