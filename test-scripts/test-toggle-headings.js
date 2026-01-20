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

async function testToggleBlocks() {
    console.log('🔍 测试 Notion Toggle 块功能...');
    
    const testBlocks = [
        {
            object: 'block',
            type: 'heading_1',
            heading_1: {
                rich_text: [{
                    type: 'text',
                    text: { content: `🧪 Toggle 块测试 - ${new Date().toLocaleString()}` }
                }]
            }
        },
        
        // 测试 1: 基本 toggle 块
        {
            object: 'block',
            type: 'toggle',
            toggle: {
                rich_text: [{
                    type: 'text',
                    text: { content: '基本 Toggle 块' }
                }],
                children: [
                    {
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [{
                                type: 'text',
                                text: { content: '这是 toggle 块的内容' }
                            }]
                        }
                    }
                ]
            }
        },
        
        // 测试 2: 带格式的 toggle 块（模拟 H1 样式）
        {
            object: 'block',
            type: 'toggle',
            toggle: {
                rich_text: [{
                    type: 'text',
                    text: { content: 'H1 样式的 Toggle 块' },
                    annotations: {
                        bold: true,
                        color: 'default'
                    }
                }],
                children: [
                    {
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [{
                                type: 'text',
                                text: { content: '这是 H1 级别的 toggle 内容' }
                            }]
                        }
                    }
                ]
            }
        },
        
        // 测试 3: 带格式的 toggle 块（模拟 H2 样式）
        {
            object: 'block',
            type: 'toggle',
            toggle: {
                rich_text: [{
                    type: 'text',
                    text: { content: 'H2 样式的 Toggle 块' },
                    annotations: {
                        bold: true,
                        color: 'gray'
                    }
                }],
                children: [
                    {
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [{
                                type: 'text',
                                text: { content: '这是 H2 级别的 toggle 内容' }
                            }]
                        }
                    }
                ]
            }
        },
        
        // 测试 4: 空的 toggle 块
        {
            object: 'block',
            type: 'toggle',
            toggle: {
                rich_text: [{
                    type: 'text',
                    text: { content: '空的 Toggle 块' }
                }]
            }
        },
        
        // 测试 5: 嵌套 toggle 块
        {
            object: 'block',
            type: 'toggle',
            toggle: {
                rich_text: [{
                    type: 'text',
                    text: { content: '嵌套 Toggle 块' }
                }],
                children: [
                    {
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [{
                                type: 'text',
                                text: { content: '这里有一个嵌套的 toggle:' }
                            }]
                        }
                    },
                    {
                        object: 'block',
                        type: 'toggle',
                        toggle: {
                            rich_text: [{
                                type: 'text',
                                text: { content: '嵌套的 Toggle' }
                            }],
                            children: [
                                {
                                    object: 'block',
                                    type: 'paragraph',
                                    paragraph: {
                                        rich_text: [{
                                            type: 'text',
                                            text: { content: '嵌套内容' }
                                        }]
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        },
        
        // 对比：普通标题
        {
            object: 'block',
            type: 'heading_2',
            heading_2: {
                rich_text: [{
                    type: 'text',
                    text: { content: '对比：普通 H2 标题' }
                }]
            }
        },
        
        {
            object: 'block',
            type: 'paragraph',
            paragraph: {
                rich_text: [{
                    type: 'text',
                    text: { content: '这是普通标题下的内容，无法折叠。' }
                }]
            }
        }
    ];

    try {
        console.log(`📦 准备发送 ${testBlocks.length} 个测试块...`);
        
        const response = await callNotionAPI(NOTION_PAGE_ID, testBlocks);
        console.log(`✅ 成功添加 ${response.results?.length || 0} 个块到 Notion`);
        
        console.log('\n🔍 测试结果分析：');
        console.log('1. 检查基本 toggle 块是否正常工作');
        console.log('2. 检查带格式的 toggle 块是否能模拟标题样式');
        console.log('3. 检查空 toggle 块是否支持');
        console.log('4. 检查嵌套 toggle 块是否支持');
        console.log('5. 对比 toggle 块与普通标题的视觉效果');
        
        console.log(`\n🌐 请访问 Notion 页面查看结果：`);
        console.log(`https://notion.so/${NOTION_PAGE_ID.replace(/-/g, '')}`);
        
        console.log('\n📋 评估要点：');
        console.log('- Toggle 块是否可以作为标题的替代？');
        console.log('- 视觉效果是否满足用户需求？');
        console.log('- 是否支持不同级别的样式区分？');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error('详细错误:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    testToggleBlocks();
}