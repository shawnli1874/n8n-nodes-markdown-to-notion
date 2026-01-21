#!/usr/bin/env node

/**
 * Debug Toggle Headings Structure
 */

const { MarkdownToNotion } = require('./dist/nodes/MarkdownToNotion/MarkdownToNotion.node.js');
require('dotenv').config();

const testMarkdown = `# Main Title

Content under main title.

## Section 1

Content for section 1.

### Subsection 1.1

Content for subsection 1.1.`;

async function debugStructure() {
    console.log('🔍 Debugging Toggle Headings Structure...\n');
    
    try {
        const structure = await MarkdownToNotion.convertMarkdownToToggleStructure(
            testMarkdown,
            true,
            '$',
            true
        );
        
        console.log('📊 Raw Structure:');
        console.log(JSON.stringify(structure, null, 2));
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        console.error(error.stack);
    }
}

debugStructure();