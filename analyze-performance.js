#!/usr/bin/env node

/**
 * Quick Performance Analysis
 */

require('dotenv').config();

const simpleMarkdown = `# Test Document

## Section 1
Content 1
### Sub 1.1
More content
### Sub 1.2
Even more content

## Section 2
Content 2
### Sub 2.1
Final content`;

async function analyzePerformance() {
    console.log('🔍 Analyzing Toggle Headings Performance Issue\n');
    
    try {
        const { MarkdownToNotion } = require('./dist/nodes/MarkdownToNotion/MarkdownToNotion.node.js');
        
        const structure = await MarkdownToNotion.convertMarkdownToToggleStructure(
            simpleMarkdown, true, '$', true
        );
        
        console.log('📊 Structure Analysis:');
        console.log(`Root nodes: ${structure.rootNodes.length}`);
        console.log(`Orphan blocks: ${structure.orphanBlocks.length}\n`);
        
        let totalBlocks = structure.orphanBlocks.length;
        
        function analyzeNode(node, depth = 0) {
            const indent = '  '.repeat(depth);
            console.log(`${indent}📁 ${getHeadingText(node.heading)} (Level ${node.level})`);
            console.log(`${indent}   └── ${node.children.length} direct children`);
            
            totalBlocks += 1; // heading block
            totalBlocks += node.children.length; // content blocks
            
            node.subHeadings.forEach(sub => {
                analyzeNode(sub, depth + 1);
            });
        }
        
        structure.rootNodes.forEach(node => analyzeNode(node));
        
        console.log(`\n📈 Total blocks that will be created: ${totalBlocks}`);
        console.log('\n🔍 Performance Issue Analysis:');
        console.log('The problem is that each heading and its content are processed');
        console.log('in separate API calls due to the recursive structure.');
        console.log('\nCurrent flow:');
        console.log('1. Create heading block (1 API call)');
        console.log('2. Add children to heading (1 API call per batch)');
        console.log('3. Recursively process sub-headings (repeat 1-2)');
        console.log('\nThis creates many small API calls instead of batching efficiently.');
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
    }
}

function getHeadingText(headingBlock) {
    const types = ['heading_1', 'heading_2', 'heading_3'];
    for (const type of types) {
        if (headingBlock[type]?.rich_text?.[0]?.text?.content) {
            return headingBlock[type].rich_text[0].text.content;
        }
    }
    return 'Unknown';
}

analyzePerformance();