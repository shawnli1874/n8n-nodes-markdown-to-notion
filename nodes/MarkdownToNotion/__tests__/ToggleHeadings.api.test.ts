import { MarkdownToNotion } from '../MarkdownToNotion.node';
import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';

describe('ToggleHeadings - API Integration', () => {
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockHttpRequest: jest.Mock;

	beforeEach(() => {
		mockHttpRequest = jest.fn();
		
		mockExecuteFunctions = {
			getNode: jest.fn(() => ({
				id: 'test-node-id',
				name: 'Test Node',
				type: 'test',
				typeVersion: 1,
				position: [0, 0],
				parameters: {}
			})),
			helpers: {
				httpRequestWithAuthentication: mockHttpRequest
			} as any,
		};
	});

	describe('processToggleHeadingsWithAPI', () => {
		it('should successfully process simple toggle structure', async () => {
			const markdown = `# Main Heading
Content under main heading

## Sub Heading
Content under sub heading`;

			const mockResponses = [
				// Orphan blocks response (none in this case)
				// Main heading response
				{
					object: 'list',
					results: [{ id: 'heading-1-id', type: 'toggle' }]
				},
				// Main heading children response
				{
					object: 'list',
					results: [{ id: 'content-1-id', type: 'paragraph' }]
				},
				// Sub heading response
				{
					object: 'list',
					results: [{ id: 'heading-2-id', type: 'toggle' }]
				},
				// Sub heading children response
				{
					object: 'list',
					results: [{ id: 'content-2-id', type: 'paragraph' }]
				}
			];

			mockHttpRequest
				.mockResolvedValueOnce(mockResponses[0])
				.mockResolvedValueOnce(mockResponses[1])
				.mockResolvedValueOnce(mockResponses[2])
				.mockResolvedValueOnce(mockResponses[3]);

			const result = await (MarkdownToNotion as any).processToggleHeadingsWithAPI(
				mockExecuteFunctions as IExecuteFunctions,
				'test-page-id',
				markdown,
				{ preserveMath: true, mathDelimiter: '$', supportLatex: true },
				0
			);

			expect(result.json.success).toBe(true);
			expect(result.json.blocksAdded).toBe(4);
			expect(result.json.chunksProcessed).toBe(4);
			expect(mockHttpRequest).toHaveBeenCalledTimes(4);
		});

		it('should handle orphan blocks correctly', async () => {
			const markdown = `This is orphan content.

Another orphan paragraph.

# First Heading
Content under heading`;

			const mockResponses = [
				// Orphan blocks response
				{
					object: 'list',
					results: [
						{ id: 'orphan-1-id', type: 'paragraph' },
						{ id: 'orphan-2-id', type: 'paragraph' }
					]
				},
				// Heading response
				{
					object: 'list',
					results: [{ id: 'heading-1-id', type: 'toggle' }]
				},
				// Heading children response
				{
					object: 'list',
					results: [{ id: 'content-1-id', type: 'paragraph' }]
				}
			];

			mockHttpRequest
				.mockResolvedValueOnce(mockResponses[0])
				.mockResolvedValueOnce(mockResponses[1])
				.mockResolvedValueOnce(mockResponses[2]);

			const result = await (MarkdownToNotion as any).processToggleHeadingsWithAPI(
				mockExecuteFunctions as IExecuteFunctions,
				'test-page-id',
				markdown,
				{ preserveMath: true },
				0
			);

			expect(result.json.success).toBe(true);
			expect(result.json.blocksAdded).toBe(5);
			expect(mockHttpRequest).toHaveBeenCalledTimes(3);

			// Verify orphan blocks are added to page root
			const firstCall = mockHttpRequest.mock.calls[0][1];
			expect(firstCall.url).toBe('https://api.notion.com/v1/blocks/test-page-id/children');
			expect(firstCall.body.children).toHaveLength(2);
		});

		it('should handle API errors with proper error messages', async () => {
			const markdown = `# Test Heading
Content`;

			mockHttpRequest.mockResolvedValueOnce({
				object: 'error',
				status: 400,
				code: 'invalid_request',
				message: 'Invalid page ID'
			});

			await expect(
				(MarkdownToNotion as any).processToggleHeadingsWithAPI(
					mockExecuteFunctions as IExecuteFunctions,
					'invalid-page-id',
					markdown,
					{},
					0
				)
			).rejects.toThrow('Toggle headings processing failed');
		});

		it('should handle network errors gracefully', async () => {
			const markdown = `# Test Heading
Content`;

			mockHttpRequest.mockRejectedValueOnce(new Error('Network timeout'));

			await expect(
				(MarkdownToNotion as any).processToggleHeadingsWithAPI(
					mockExecuteFunctions as IExecuteFunctions,
					'test-page-id',
					markdown,
					{},
					0
				)
			).rejects.toThrow('Toggle headings processing failed: Network timeout');
		});

		it('should accumulate warnings from multiple API calls', async () => {
			const markdown = `# Heading 1
Content 1

# Heading 2
Content 2`;

			// Mock responses with warnings
			const mockResponses = [
				{
					object: 'list',
					results: [{ id: 'heading-1-id', type: 'toggle' }]
				},
				{
					object: 'list',
					results: [{ id: 'content-1-id', type: 'paragraph' }]
				},
				{
					object: 'list',
					results: [{ id: 'heading-2-id', type: 'toggle' }]
				},
				{
					object: 'list',
					results: [{ id: 'content-2-id', type: 'paragraph' }]
				}
			];

			// Mock the addBlocksToPage method to return warnings
			const originalAddBlocksToPage = (MarkdownToNotion as any).addBlocksToPage;
			(MarkdownToNotion as any).addBlocksToPage = jest.fn()
				.mockResolvedValueOnce({
					response: mockResponses[0],
					blocksAdded: 1,
					warnings: ['Warning 1']
				})
				.mockResolvedValueOnce({
					response: mockResponses[1],
					blocksAdded: 1,
					warnings: ['Warning 2']
				})
				.mockResolvedValueOnce({
					response: mockResponses[2],
					blocksAdded: 1,
					warnings: []
				})
				.mockResolvedValueOnce({
					response: mockResponses[3],
					blocksAdded: 1,
					warnings: ['Warning 3']
				});

			const result = await (MarkdownToNotion as any).processToggleHeadingsWithAPI(
				mockExecuteFunctions as IExecuteFunctions,
				'test-page-id',
				markdown,
				{},
				0
			);

			expect(result.json.warnings).toEqual(['Warning 1', 'Warning 2', 'Warning 3']);

			// Restore original method
			(MarkdownToNotion as any).addBlocksToPage = originalAddBlocksToPage;
		});

		it('should handle deeply nested structures without stack overflow', async () => {
			// Create 10-level deep structure
			let markdown = '';
			for (let i = 1; i <= 10; i++) {
				markdown += '#'.repeat(i) + ` Level ${i} Heading\nContent ${i}\n\n`;
			}

			// Mock successful responses for all levels
			const mockResponses: any[] = [];
			for (let i = 1; i <= 10; i++) {
				mockResponses.push({
					object: 'list',
					results: [{ id: `heading-${i}-id`, type: 'toggle' }]
				});
				mockResponses.push({
					object: 'list',
					results: [{ id: `content-${i}-id`, type: 'paragraph' }]
				});
			}

			mockHttpRequest.mockImplementation(() => 
				Promise.resolve(mockResponses.shift())
			);

			const result = await (MarkdownToNotion as any).processToggleHeadingsWithAPI(
				mockExecuteFunctions as IExecuteFunctions,
				'test-page-id',
				markdown,
				{},
				0
			);

			expect(result.json.success).toBe(true);
			expect(result.json.blocksAdded).toBe(20);
			expect(mockHttpRequest).toHaveBeenCalledTimes(20);
		});

		it('should preserve math formulas in API requests', async () => {
			const markdown = `# Equation: $E = mc^2$
The formula $E = mc^2$ is famous.

## LaTeX: \\(F = ma\\)
Force equation: \\(F = ma\\)`;

			mockHttpRequest
				.mockResolvedValueOnce({
					object: 'list',
					results: [{ id: 'heading-1-id', type: 'toggle' }]
				})
				.mockResolvedValueOnce({
					object: 'list',
					results: [{ id: 'content-1-id', type: 'paragraph' }]
				})
				.mockResolvedValueOnce({
					object: 'list',
					results: [{ id: 'heading-2-id', type: 'toggle' }]
				})
				.mockResolvedValueOnce({
					object: 'list',
					results: [{ id: 'content-2-id', type: 'paragraph' }]
				});

			await (MarkdownToNotion as any).processToggleHeadingsWithAPI(
				mockExecuteFunctions as IExecuteFunctions,
				'test-page-id',
				markdown,
				{ preserveMath: true, mathDelimiter: '$', supportLatex: true },
				0
			);

			// Verify that equation blocks are created in API requests
			const calls = mockHttpRequest.mock.calls;
			const hasEquationBlock = calls.some(call => 
				call[1].body.children.some((block: any) => block.type === 'equation')
			);
			
			expect(hasEquationBlock).toBe(true);
		});
	});

	describe('addBlocksToPage', () => {
		it('should handle small batches (< 100 blocks)', async () => {
			const blocks = Array.from({ length: 50 }, (_, i) => ({
				object: 'block' as const,
				type: 'paragraph',
				paragraph: {
					rich_text: [{ type: 'text' as const, text: { content: `Block ${i}` } }]
				}
			}));

			mockHttpRequest.mockResolvedValueOnce({
				object: 'list',
				results: blocks.map((_, i) => ({ id: `block-${i}-id`, type: 'paragraph' }))
			});

			const result = await (MarkdownToNotion as any).addBlocksToPage(
				mockExecuteFunctions as IExecuteFunctions,
				'test-page-id',
				blocks
			);

			expect(result.blocksAdded).toBe(50);
			expect(mockHttpRequest).toHaveBeenCalledTimes(1);
			expect(mockHttpRequest.mock.calls[0][1].body.children).toHaveLength(50);
		});

		it('should handle large batches requiring chunking', async () => {
			const blocks = Array.from({ length: 250 }, (_, i) => ({
				object: 'block' as const,
				type: 'paragraph',
				paragraph: {
					rich_text: [{ type: 'text' as const, text: { content: `Block ${i}` } }]
				}
			}));

			// Mock responses for 3 chunks (100, 100, 50)
			mockHttpRequest
				.mockResolvedValueOnce({
					object: 'list',
					results: Array.from({ length: 100 }, (_, i) => ({ id: `block-${i}-id`, type: 'paragraph' }))
				})
				.mockResolvedValueOnce({
					object: 'list',
					results: Array.from({ length: 100 }, (_, i) => ({ id: `block-${i + 100}-id`, type: 'paragraph' }))
				})
				.mockResolvedValueOnce({
					object: 'list',
					results: Array.from({ length: 50 }, (_, i) => ({ id: `block-${i + 200}-id`, type: 'paragraph' }))
				});

			const result = await (MarkdownToNotion as any).addBlocksToPage(
				mockExecuteFunctions as IExecuteFunctions,
				'test-page-id',
				blocks
			);

			expect(result.blocksAdded).toBe(250);
			expect(mockHttpRequest).toHaveBeenCalledTimes(3);
			
			// Verify chunk sizes
			expect(mockHttpRequest.mock.calls[0][1].body.children).toHaveLength(100);
			expect(mockHttpRequest.mock.calls[1][1].body.children).toHaveLength(100);
			expect(mockHttpRequest.mock.calls[2][1].body.children).toHaveLength(50);
		});

		it('should handle empty blocks array', async () => {
			const result = await (MarkdownToNotion as any).addBlocksToPage(
				mockExecuteFunctions as IExecuteFunctions,
				'test-page-id',
				[]
			);

			expect(result.blocksAdded).toBe(0);
			expect(result.response.results).toEqual([]);
			expect(mockHttpRequest).not.toHaveBeenCalled();
		});

		it('should handle chunk processing errors with proper error messages', async () => {
			const blocks = Array.from({ length: 150 }, (_, i) => ({
				object: 'block' as const,
				type: 'paragraph',
				paragraph: {
					rich_text: [{ type: 'text' as const, text: { content: `Block ${i}` } }]
				}
			}));

			mockHttpRequest
				.mockResolvedValueOnce({
					object: 'list',
					results: Array.from({ length: 100 }, (_, i) => ({ id: `block-${i}-id`, type: 'paragraph' }))
				})
				.mockRejectedValueOnce(new Error('API rate limit exceeded'));

			await expect(
				(MarkdownToNotion as any).addBlocksToPage(
					mockExecuteFunctions as IExecuteFunctions,
					'test-page-id',
					blocks
				)
			).rejects.toThrow('Failed to process chunk 2 of 2: API rate limit exceeded');
		});
	});

	describe('addSingleBatch', () => {
		it('should make correct API request with normalized blocks', async () => {
			const blocks = [
				{
					object: 'block' as const,
					type: 'paragraph',
					paragraph: {
						rich_text: [{ type: 'text' as const, text: { content: 'Test content' } }]
					}
				}
			];

			mockHttpRequest.mockResolvedValueOnce({
				object: 'list',
				results: [{ id: 'block-id', type: 'paragraph' }]
			});

			const result = await (MarkdownToNotion as any).addSingleBatch(
				mockExecuteFunctions as IExecuteFunctions,
				'test-page-id',
				blocks
			);

			expect(result.blocksAdded).toBe(1);
			expect(mockHttpRequest).toHaveBeenCalledWith(
				mockExecuteFunctions,
				'notionApi',
				expect.objectContaining({
					method: 'PATCH',
					url: 'https://api.notion.com/v1/blocks/test-page-id/children',
					body: {
						children: expect.arrayContaining([
							expect.objectContaining({
								type: 'paragraph'
							})
						])
					},
					json: true
				})
			);
		});

		it('should handle Notion API error responses', async () => {
			const blocks = [
				{
					object: 'block' as const,
					type: 'paragraph',
					paragraph: {
						rich_text: [{ type: 'text' as const, text: { content: 'Test' } }]
					}
				}
			];

			mockHttpRequest.mockResolvedValueOnce({
				object: 'error',
				status: 400,
				code: 'validation_error',
				message: 'Invalid block content'
			});

			// Mock the retryWithBisection method to avoid complex retry logic in tests
			const originalRetryWithBisection = (MarkdownToNotion as any).retryWithBisection;
			(MarkdownToNotion as any).retryWithBisection = jest.fn().mockResolvedValueOnce({
				response: { object: 'list', results: [] },
				blocksAdded: 0,
				warnings: ['Retry warning']
			});

			const result = await (MarkdownToNotion as any).addSingleBatch(
				mockExecuteFunctions as IExecuteFunctions,
				'test-page-id',
				blocks
			);

			expect(result.warnings).toContain('Retry warning');

			// Restore original method
			(MarkdownToNotion as any).retryWithBisection = originalRetryWithBisection;
		});

		it('should handle unexpected API responses', async () => {
			const blocks = [
				{
					object: 'block' as const,
					type: 'paragraph',
					paragraph: {
						rich_text: [{ type: 'text' as const, text: { content: 'Test' } }]
					}
				}
			];

			mockHttpRequest.mockResolvedValueOnce(null);

			await expect(
				(MarkdownToNotion as any).addSingleBatch(
					mockExecuteFunctions as IExecuteFunctions,
					'test-page-id',
					blocks
				)
			).rejects.toThrow('Unexpected Notion API response');
		});

		it('should handle network errors', async () => {
			const blocks = [
				{
					object: 'block' as const,
					type: 'paragraph',
					paragraph: {
						rich_text: [{ type: 'text' as const, text: { content: 'Test' } }]
					}
				}
			];

			mockHttpRequest.mockRejectedValueOnce(new Error('Connection timeout'));

			await expect(
				(MarkdownToNotion as any).addSingleBatch(
					mockExecuteFunctions as IExecuteFunctions,
					'test-page-id',
					blocks
				)
			).rejects.toThrow('Connection timeout');
		});
	});
});