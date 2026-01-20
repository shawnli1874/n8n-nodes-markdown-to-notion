#!/usr/bin/env node

require('dotenv').config();
const unified = require('unified');
const remarkParse = require('remark-parse');
const remarkGfm = require('remark-gfm');

async function debugQuoteBlock() {
    const testMarkdown = `> 这是引用块，包含 [引用链接1](https://stackoverflow.com)
> 
> 多行引用：[引用链接2](https://github.com/microsoft/vscode)`;

    console.log('🔍 调试引用块 AST 结构...');
    
    const processor = unified()
        .use(remarkParse)
        .use(remarkGfm);

    const tree = processor.parse(testMarkdown);
    
    console.log('\n📋 完整 AST 结构:');
    console.log(JSON.stringify(tree, null, 2));
    
    console.log('\n🔍 引用块节点详细分析:');
    for (const node of tree.children) {
        if (node.type === 'blockquote') {
            console.log('引用块节点:', JSON.stringify(node, null, 2));
            
            console.log('\n引用块子节点:');
            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                console.log(`  子节点 ${i}:`, JSON.stringify(child, null, 2));
                
                if (child.children) {
                    console.log(`  子节点 ${i} 的子节点:`);
                    for (let j = 0; j < child.children.length; j++) {
                        const grandchild = child.children[j];
                        console.log(`    孙节点 ${j}:`, JSON.stringify(grandchild, null, 2));
                    }
                }
            }
        }
    }
}

if (require.main === module) {
    debugQuoteBlock();
}