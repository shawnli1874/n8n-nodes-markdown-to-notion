import { MarkdownToNotion } from '../MarkdownToNotion.node';

describe('ToggleHeadings - Structure Building', () => {
	describe('buildToggleHeadingStructure', () => {
		it('should handle simple hierarchical structure (H1 > H2 > H3)', () => {
			const markdown = `# Level 1 Heading
Content under level 1

## Level 2 Heading
Content under level 2

### Level 3 Heading
Content under level 3`;

			// Use the private method through type assertion for testing
			const result = (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown, true, '$', true
			);

			expect(result).resolves.toMatchObject({
				rootNodes: expect.arrayContaining([
					expect.objectContaining({
						level: 1,
						heading: expect.objectContaining({
							type: 'toggle',
							toggle: expect.objectContaining({
								rich_text: expect.arrayContaining([
									expect.objectContaining({
										text: expect.objectContaining({
											content: 'Level 1 Heading'
										})
									})
								])
							})
						}),
						children: expect.any(Array),
						subHeadings: expect.arrayContaining([
							expect.objectContaining({
								level: 2,
								subHeadings: expect.arrayContaining([
									expect.objectContaining({
										level: 3
									})
								])
							})
						])
					})
				]),
				orphanBlocks: []
			});
		});

		it('should handle complex nested structures with mixed content', () => {
			const markdown = `# Main Section
This is the main content.

## Subsection A
- List item 1
- List item 2

### Deep Section
\`\`\`javascript
console.log('code block');
\`\`\`

## Subsection B
> This is a blockquote

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |

# Another Main Section
Final content`;

			const result = (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown, true, '$', true
			);

			expect(result).resolves.toMatchObject({
				rootNodes: expect.arrayContaining([
					expect.objectContaining({
						level: 1,
						children: expect.arrayContaining([
							expect.objectContaining({ type: 'paragraph' })
						]),
						subHeadings: expect.arrayContaining([
							expect.objectContaining({
								level: 2,
								children: expect.arrayContaining([
									expect.objectContaining({ type: 'bulleted_list_item' })
								]),
								subHeadings: expect.arrayContaining([
									expect.objectContaining({
										level: 3,
										children: expect.arrayContaining([
											expect.objectContaining({ type: 'code' })
										])
									})
								])
							}),
							expect.objectContaining({
								level: 2,
								children: expect.arrayContaining([
									expect.objectContaining({ type: 'quote' }),
									expect.objectContaining({ type: 'table' })
								])
							})
						])
					}),
					expect.objectContaining({
						level: 1,
						children: expect.arrayContaining([
							expect.objectContaining({ type: 'paragraph' })
						])
					})
				])
			});
		});

		it('should handle orphan content (content before first heading)', () => {
			const markdown = `This is orphan content at the top.

Another orphan paragraph.

# First Heading
Content under heading`;

			const result = (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown, true, '$', true
			);

			expect(result).resolves.toMatchObject({
				rootNodes: expect.arrayContaining([
					expect.objectContaining({
						level: 1,
						heading: expect.objectContaining({
							toggle: expect.objectContaining({
								rich_text: expect.arrayContaining([
									expect.objectContaining({
										text: expect.objectContaining({
											content: 'First Heading'
										})
									})
								])
							})
						})
					})
				]),
				orphanBlocks: expect.arrayContaining([
					expect.objectContaining({ type: 'paragraph' }),
					expect.objectContaining({ type: 'paragraph' })
				])
			});
		});

		it('should handle empty headings', () => {
			const markdown = `#
## 
### Empty Heading

# Valid Heading
Content here`;

			const result = (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown, true, '$', true
			);

			expect(result).resolves.toMatchObject({
				rootNodes: expect.arrayContaining([
					expect.objectContaining({
						level: 1,
						heading: expect.objectContaining({
							toggle: expect.objectContaining({
								rich_text: []
							})
						})
					})
				])
			});
		});

		it('should preserve math formulas in headings and content', () => {
			const markdown = `# Equation: $E = mc^2$
The famous equation $E = mc^2$ shows the relationship.

## LaTeX Style: \\(F = ma\\)
Force equals mass times acceleration: \\(F = ma\\)`;

			const result = (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown, true, '$', true
			);

			expect(result).resolves.toMatchObject({
				rootNodes: expect.arrayContaining([
					expect.objectContaining({
						level: 1,
						heading: expect.objectContaining({
							toggle: expect.objectContaining({
								rich_text: expect.arrayContaining([
									expect.objectContaining({
										text: expect.objectContaining({
											content: 'Equation: '
										})
									})
								])
							})
						}),
						children: expect.arrayContaining([
							expect.objectContaining({
								type: 'paragraph',
								paragraph: expect.objectContaining({
									rich_text: expect.arrayContaining([
										expect.objectContaining({
											text: expect.objectContaining({
												content: 'The famous equation '
											})
										})
									])
								})
							})
						]),
						subHeadings: expect.arrayContaining([
							expect.objectContaining({
								level: 2,
								heading: expect.objectContaining({
									toggle: expect.objectContaining({
										rich_text: expect.arrayContaining([
											expect.objectContaining({
												text: expect.objectContaining({
													content: 'LaTeX Style: '
												})
											})
										])
									})
								})
							})
						])
					})
				])
			});
		});

		it('should handle malformed markdown gracefully', () => {
			const markdown = `# Unclosed code block
\`\`\`javascript
console.log('unclosed');

## Heading after unclosed block
Content here

# Another heading
\`\`\``;

			const result = (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown, true, '$', true
			);

			// Should not throw and should produce some structure
			expect(result).resolves.toMatchObject({
				rootNodes: expect.any(Array),
				orphanBlocks: expect.any(Array)
			});
		});

		it('should handle deeply nested structures (performance test)', () => {
			// Create a 6-level deep structure
			const markdown = `# Level 1
Content 1
## Level 2
Content 2
### Level 3
Content 3
#### Level 4
Content 4
##### Level 5
Content 5
###### Level 6
Content 6`;

			const result = (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown, true, '$', true
			);

			expect(result).resolves.toMatchObject({
				rootNodes: expect.arrayContaining([
					expect.objectContaining({
						level: 1,
						subHeadings: expect.arrayContaining([
							expect.objectContaining({
								level: 2,
								subHeadings: expect.arrayContaining([
									expect.objectContaining({
										level: 3,
										subHeadings: expect.arrayContaining([
											expect.objectContaining({
												level: 4,
												subHeadings: expect.arrayContaining([
													expect.objectContaining({
														level: 5,
														subHeadings: expect.arrayContaining([
															expect.objectContaining({
																level: 6
															})
														])
													})
												])
											})
										])
									})
								])
							})
						])
					})
				])
			});
		});

		it('should handle content with special characters and formatting', () => {
			const markdown = `# Special Characters: !@#$%^&*()
Content with **bold**, *italic*, and \`code\`.

## Unicode: 🚀 Émojis & Àccénts
Content with unicode characters: 中文, العربية, русский`;

			const result = (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown, true, '$', true
			);

			expect(result).resolves.toMatchObject({
				rootNodes: expect.arrayContaining([
					expect.objectContaining({
						level: 1,
						heading: expect.objectContaining({
							toggle: expect.objectContaining({
								rich_text: expect.arrayContaining([
									expect.objectContaining({
										text: expect.objectContaining({
											content: expect.stringContaining('Special Characters: !@#$%^&*()')
										})
									})
								])
							})
						}),
						subHeadings: expect.arrayContaining([
							expect.objectContaining({
								level: 2,
								heading: expect.objectContaining({
									toggle: expect.objectContaining({
										rich_text: expect.arrayContaining([
											expect.objectContaining({
												text: expect.objectContaining({
													content: expect.stringContaining('🚀 Émojis & Àccénts')
												})
											})
										])
									})
								})
							})
						])
					})
				])
			});
		});

		it('should preserve code blocks with various languages', () => {
			const markdown = `# Code Examples

## JavaScript
\`\`\`javascript
function hello() {
    console.log('Hello, World!');
}
\`\`\`

## Python
\`\`\`python
def hello():
    print("Hello, World!")
\`\`\`

## No Language
\`\`\`
plain text code block
\`\`\``;

			const result = (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown, true, '$', true
			);

			expect(result).resolves.toMatchObject({
				rootNodes: expect.arrayContaining([
					expect.objectContaining({
						level: 1,
						subHeadings: expect.arrayContaining([
							expect.objectContaining({
								level: 2,
								children: expect.arrayContaining([
									expect.objectContaining({
										type: 'code',
										code: expect.objectContaining({
											language: 'javascript',
											rich_text: expect.arrayContaining([
												expect.objectContaining({
													text: expect.objectContaining({
														content: expect.stringContaining('function hello()')
													})
												})
											])
										})
									})
								])
							}),
							expect.objectContaining({
								level: 2,
								children: expect.arrayContaining([
									expect.objectContaining({
										type: 'code',
										code: expect.objectContaining({
											language: 'python'
										})
									})
								])
							})
						])
					})
				])
			});
		});

		it('should handle tables with complex content', () => {
			const markdown = `# Data Tables

## Simple Table
| Name | Age | City |
|------|-----|------|
| John | 30  | NYC  |
| Jane | 25  | LA   |

## Table with Math
| Formula | Result |
|---------|--------|
| $x^2$   | 4      |
| $\\sqrt{16}$ | 4 |`;

			const result = (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown, true, '$', true
			);

			expect(result).resolves.toMatchObject({
				rootNodes: expect.arrayContaining([
					expect.objectContaining({
						level: 1,
						subHeadings: expect.arrayContaining([
							expect.objectContaining({
								level: 2,
								children: expect.arrayContaining([
									expect.objectContaining({
										type: 'table'
									})
								])
							}),
							expect.objectContaining({
								level: 2,
								children: expect.arrayContaining([
									expect.objectContaining({
										type: 'table'
									})
								])
							})
						])
					})
				])
			});
		});
	});
});