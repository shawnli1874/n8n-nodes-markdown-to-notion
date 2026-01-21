const { MarkdownToNotion } = require('./dist/nodes/MarkdownToNotion/MarkdownToNotion.node.js');

async function testCorrectToggleHeadings() {
    console.log('🔍 Testing Correct Toggle Headings Implementation...\n');
    
    const testMarkdown = `# 主标题

这是主标题下的内容。

## 子标题

这是子标题下的内容。`;
    
    try {
        const blocks = await MarkdownToNotion.convertMarkdownToNotionBlocks(
            testMarkdown,
            true,  // preserveMath
            '$',   // mathDelimiter
            true,  // supportLatex
            true   // toggleHeadings
        );
        
        console.log(`Generated ${blocks.length} blocks:`);
        blocks.forEach((block, index) => {
            console.log(`\nBlock ${index + 1}:`);
            console.log(`Type: ${block.type}`);
            
            if (block.type.startsWith('heading_')) {
                const headingData = block[block.type];
                console.log(`Text: "${headingData.rich_text[0].text.content}"`);
                console.log(`Color: ${headingData.color || 'default'}`);
                console.log(`Is Toggleable: ${headingData.is_toggleable || false}`);
            } else {
                console.log(`Content: ${JSON.stringify(block, null, 2)}`);
            }
        });
        
        // Verify the structure
        console.log('\n✅ Verification:');
        const headingBlocks = blocks.filter(b => b.type.startsWith('heading_'));
        const toggleableHeadings = headingBlocks.filter(b => b[b.type].is_toggleable);
        
        console.log(`Found ${headingBlocks.length} heading blocks`);
        console.log(`Found ${toggleableHeadings.length} toggleable headings`);
        
        if (toggleableHeadings.length > 0) {
            console.log('✅ SUCCESS: Headings are now proper toggle headings with is_toggleable: true');
        } else {
            console.log('❌ FAILED: No toggleable headings found');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testCorrectToggleHeadings();