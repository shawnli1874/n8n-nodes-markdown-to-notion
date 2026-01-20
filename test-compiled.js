/**
 * Integration test for compiled node
 * This tests the actual compiled JavaScript code to ensure it works in runtime
 */

const { MarkdownToNotion } = require('./dist/nodes/MarkdownToNotion/MarkdownToNotion.node.js');

async function testCompiledNode() {
    console.log('Testing compiled node...\n');
    
    // Test 1: Verify class exists and can be instantiated
    console.log('Test 1: Class instantiation');
    try {
        const node = new MarkdownToNotion();
        console.log('✓ Node instance created successfully');
        console.log('✓ Node has description:', !!node.description);
    } catch (error) {
        console.error('✗ Failed to create node instance:', error.message);
        process.exit(1);
    }
    
    // Test 2: Verify static method exists
    console.log('\nTest 2: Static method existence');
    try {
        if (typeof MarkdownToNotion.convertMarkdownToNotionBlocks !== 'function') {
            throw new Error('convertMarkdownToNotionBlocks is not a static method');
        }
        console.log('✓ convertMarkdownToNotionBlocks is a static method');
    } catch (error) {
        console.error('✗ Static method check failed:', error.message);
        process.exit(1);
    }
    
    // Test 3: Call static method directly
    console.log('\nTest 3: Direct static method call');
    try {
        const markdown = '# Test Heading\n\nThis is a **bold** paragraph.';
        const blocks = await MarkdownToNotion.convertMarkdownToNotionBlocks(markdown, true, '$');
        
        console.log('✓ Static method executed successfully');
        console.log('✓ Generated', blocks.length, 'blocks');
        
        // Verify block structure
        if (blocks.length === 0) {
            throw new Error('No blocks generated');
        }
        
        const headingBlock = blocks.find(b => b.type.startsWith('heading_'));
        if (!headingBlock) {
            throw new Error('No heading block found');
        }
        console.log('✓ Heading block generated correctly');
        
        const paragraphBlock = blocks.find(b => b.type === 'paragraph');
        if (!paragraphBlock) {
            throw new Error('No paragraph block found');
        }
        console.log('✓ Paragraph block generated correctly');
        
    } catch (error) {
        console.error('✗ Static method call failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
    
    // Test 4: Verify all helper methods are static
    console.log('\nTest 4: Helper methods are static');
    const expectedStaticMethods = [
        'convertMarkdownToNotionBlocks',
        'createHeadingBlock',
        'createParagraphBlock',
        'createListBlocks',
        'createCodeBlock',
        'createQuoteBlock',
        'convertToRichText',
        'processInlineFormatting',
        'isTodoItem',
        'createTodoBlock',
        'isDivider',
        'createDividerBlock',
        'isStandaloneUrl',
        'createBookmarkBlock',
        'isBlockEquation',
        'createEquationBlock',
        'isCallout',
        'createCalloutBlock',
        'createImageBlock',
        'createTableBlocks',
        'restoreMathPlaceholders',
        'preprocessToggleBlocks',
        'isToggleBlock',
        'createToggleBlock'
    ];
    
    const missingMethods = [];
    const nonStaticMethods = [];
    
    for (const methodName of expectedStaticMethods) {
        if (typeof MarkdownToNotion[methodName] !== 'function') {
            missingMethods.push(methodName);
        }
    }
    
    if (missingMethods.length > 0) {
        console.error('✗ Missing static methods:', missingMethods.join(', '));
        process.exit(1);
    }
    
    console.log('✓ All', expectedStaticMethods.length, 'helper methods are static');
    
    // Test 5: Test with math formulas
    console.log('\nTest 5: Math formula preservation');
    try {
        const markdown = 'This is an inline formula $x^2 + y^2 = z^2$ in text.';
        const blocks = await MarkdownToNotion.convertMarkdownToNotionBlocks(markdown, true, '$');
        
        const content = blocks[0]?.paragraph?.rich_text[0]?.text?.content;
        if (!content || !content.includes('$x^2 + y^2 = z^2$')) {
            throw new Error('Math formula not preserved: ' + content);
        }
        console.log('✓ Math formula preserved correctly');
    } catch (error) {
        console.error('✗ Math formula test failed:', error.message);
        process.exit(1);
    }
    
    console.log('\n========================================');
    console.log('All tests passed! ✓');
    console.log('========================================');
    console.log('\nThe compiled code is ready for runtime use.');
    console.log('You can safely publish this version to npm.');
}

// Run tests
testCompiledNode().catch(error => {
    console.error('\nUnexpected error:', error);
    process.exit(1);
});
