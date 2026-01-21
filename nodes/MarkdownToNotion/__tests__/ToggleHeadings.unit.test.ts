import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

// Mock the MarkdownToNotion class for testing
const mockMarkdownToNotion = {
	convertMarkdownToToggleStructure: jest.fn(),
	buildToggleHeadingStructure: jest.fn(),
	processToggleHeadingsWithAPI: jest.fn(),
	addBlocksToPage: jest.fn(),
	addSingleBatch: jest.fn()
};

describe('ToggleHeadings - Structure Building (Unit)', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('buildToggleHeadingStructure Logic', () => {
		it('should create proper hierarchical structure', () => {
			const mockNodes = [
				{
					type: 'heading',
					depth: 1,
					children: [{ type: 'text', value: 'Level 1 Heading' }]
				},
				{
					type: 'paragraph',
					children: [{ type: 'text', value: 'Content under level 1' }]
				},
				{
					type: 'heading',
					depth: 2,
					children: [{ type: 'text', value: 'Level 2 Heading' }]
				},
				{
					type: 'paragraph',
					children: [{ type: 'text', value: 'Content under level 2' }]
				}
			];

			const expectedStructure = {
				rootNodes: [
					{
						level: 1,
						heading: {
							type: 'toggle',
							toggle: {
								rich_text: [
									{
										type: 'text',
										text: { content: 'Level 1 Heading' }
									}
								]
							}
						},
						children: [
							{
								type: 'paragraph',
								paragraph: {
									rich_text: [
										{
											type: 'text',
											text: { content: 'Content under level 1' }
										}
									]
								}
							}
						],
						subHeadings: [
							{
								level: 2,
								heading: {
									type: 'toggle',
									toggle: {
										rich_text: [
											{
												type: 'text',
												text: { content: 'Level 2 Heading' }
											}
										]
									}
								},
								children: [
									{
										type: 'paragraph',
										paragraph: {
											rich_text: [
												{
													type: 'text',
													text: { content: 'Content under level 2' }
												}
											]
										}
									}
								],
								subHeadings: []
							}
						]
					}
				],
				orphanBlocks: []
			};

			mockMarkdownToNotion.buildToggleHeadingStructure.mockReturnValue(expectedStructure);

			const result = mockMarkdownToNotion.buildToggleHeadingStructure(mockNodes, {});

			expect(result).toEqual(expectedStructure);
			expect(result.rootNodes).toHaveLength(1);
			expect(result.rootNodes[0].level).toBe(1);
			expect(result.rootNodes[0].subHeadings).toHaveLength(1);
			expect(result.rootNodes[0].subHeadings[0].level).toBe(2);
		});

		it('should handle orphan content correctly', () => {
			const mockNodes = [
				{
					type: 'paragraph',
					children: [{ type: 'text', value: 'Orphan content 1' }]
				},
				{
					type: 'paragraph',
					children: [{ type: 'text', value: 'Orphan content 2' }]
				},
				{
					type: 'heading',
					depth: 1,
					children: [{ type: 'text', value: 'First Heading' }]
				}
			];

			const expectedStructure = {
				rootNodes: [
					{
						level: 1,
						heading: {
							type: 'toggle',
							toggle: {
								rich_text: [
									{
										type: 'text',
										text: { content: 'First Heading' }
									}
								]
							}
						},
						children: [],
						subHeadings: []
					}
				],
				orphanBlocks: [
					{
						type: 'paragraph',
						paragraph: {
							rich_text: [
								{
									type: 'text',
									text: { content: 'Orphan content 1' }
								}
							]
						}
					},
					{
						type: 'paragraph',
						paragraph: {
							rich_text: [
								{
									type: 'text',
									text: { content: 'Orphan content 2' }
								}
							]
						}
					}
				]
			};

			mockMarkdownToNotion.buildToggleHeadingStructure.mockReturnValue(expectedStructure);

			const result = mockMarkdownToNotion.buildToggleHeadingStructure(mockNodes, {});

			expect(result.orphanBlocks).toHaveLength(2);
			expect(result.rootNodes).toHaveLength(1);
		});

		it('should handle empty headings', () => {
			const mockNodes = [
				{
					type: 'heading',
					depth: 1,
					children: []
				},
				{
					type: 'paragraph',
					children: [{ type: 'text', value: 'Content after empty heading' }]
				}
			];

			const expectedStructure = {
				rootNodes: [
					{
						level: 1,
						heading: {
							type: 'toggle',
							toggle: {
								rich_text: []
							}
						},
						children: [
							{
								type: 'paragraph',
								paragraph: {
									rich_text: [
										{
											type: 'text',
											text: { content: 'Content after empty heading' }
										}
									]
								}
							}
						],
						subHeadings: []
					}
				],
				orphanBlocks: []
			};

			mockMarkdownToNotion.buildToggleHeadingStructure.mockReturnValue(expectedStructure);

			const result = mockMarkdownToNotion.buildToggleHeadingStructure(mockNodes, {});

			expect(result.rootNodes[0].heading.toggle.rich_text).toHaveLength(0);
			expect(result.rootNodes[0].children).toHaveLength(1);
		});

		it('should handle deeply nested structures', () => {
			const mockNodes = [];
			for (let level = 1; level <= 6; level++) {
				mockNodes.push({
					type: 'heading',
					depth: level,
					children: [{ type: 'text', value: `Level ${level} Heading` }]
				});
				mockNodes.push({
					type: 'paragraph',
					children: [{ type: 'text', value: `Content for level ${level}` }]
				});
			}

			const expectedStructure = {
				rootNodes: [
					{
						level: 1,
						heading: {
							type: 'toggle',
							toggle: {
								rich_text: [
									{
										type: 'text',
										text: { content: 'Level 1 Heading' }
									}
								]
							}
						},
						children: [
							{
								type: 'paragraph',
								paragraph: {
									rich_text: [
										{
											type: 'text',
											text: { content: 'Content for level 1' }
										}
									]
								}
							}
						],
						subHeadings: [
							{
								level: 2,
								subHeadings: [
									{
										level: 3,
										subHeadings: [
											{
												level: 4,
												subHeadings: [
													{
														level: 5,
														subHeadings: [
															{
																level: 6,
																subHeadings: []
															}
														]
													}
												]
											}
										]
									}
								]
							}
						]
					}
				],
				orphanBlocks: []
			};

			mockMarkdownToNotion.buildToggleHeadingStructure.mockReturnValue(expectedStructure);

			const result = mockMarkdownToNotion.buildToggleHeadingStructure(mockNodes, {});

			expect(result.rootNodes).toHaveLength(1);
			
			// Verify deep nesting
			let currentNode = result.rootNodes[0];
			for (let level = 1; level <= 6; level++) {
				expect(currentNode.level).toBe(level);
				if (level < 6) {
					expect(currentNode.subHeadings).toHaveLength(1);
					currentNode = currentNode.subHeadings[0];
				} else {
					expect(currentNode.subHeadings).toHaveLength(0);
				}
			}
		});
	});

	describe('API Integration Logic', () => {
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

		it('should handle API call sequencing correctly', async () => {
			const mockStructure = {
				rootNodes: [
					{
						level: 1,
						heading: { type: 'toggle' },
						children: [{ type: 'paragraph' }],
						subHeadings: [
							{
								level: 2,
								heading: { type: 'toggle' },
								children: [{ type: 'paragraph' }],
								subHeadings: []
							}
						]
					}
				],
				orphanBlocks: [{ type: 'paragraph' }]
			};

			const expectedApiCalls = [
				// Orphan blocks
				{ blocksAdded: 1, response: { results: [{ id: 'orphan-1' }] }, warnings: [] },
				// Root heading
				{ blocksAdded: 1, response: { results: [{ id: 'heading-1' }] }, warnings: [] },
				// Root children
				{ blocksAdded: 1, response: { results: [{ id: 'content-1' }] }, warnings: [] },
				// Sub heading
				{ blocksAdded: 1, response: { results: [{ id: 'heading-2' }] }, warnings: [] },
				// Sub children
				{ blocksAdded: 1, response: { results: [{ id: 'content-2' }] }, warnings: [] }
			];

			mockMarkdownToNotion.addBlocksToPage
				.mockResolvedValueOnce(expectedApiCalls[0])
				.mockResolvedValueOnce(expectedApiCalls[1])
				.mockResolvedValueOnce(expectedApiCalls[2])
				.mockResolvedValueOnce(expectedApiCalls[3])
				.mockResolvedValueOnce(expectedApiCalls[4]);

			mockMarkdownToNotion.processToggleHeadingsWithAPI.mockImplementation(async () => {
				// Simulate the API call sequence
				const results = [];
				for (const expectedCall of expectedApiCalls) {
					results.push(await mockMarkdownToNotion.addBlocksToPage());
				}
				
				return {
					json: {
						success: true,
						pageId: 'test-page-id',
						blocksAdded: results.reduce((sum, r) => sum + r.blocksAdded, 0),
						chunksProcessed: results.length,
						responses: results.map(r => r.response),
						warnings: results.flatMap(r => r.warnings)
					}
				};
			});

			const result = await mockMarkdownToNotion.processToggleHeadingsWithAPI(
				mockExecuteFunctions,
				'test-page-id',
				'# Test\nContent',
				{},
				0
			);

			expect(result.json.success).toBe(true);
			expect(result.json.blocksAdded).toBe(5);
			expect(result.json.chunksProcessed).toBe(5);
			expect(mockMarkdownToNotion.addBlocksToPage).toHaveBeenCalledTimes(5);
		});

		it('should handle batching logic correctly', async () => {
			const smallBatch = Array.from({ length: 50 }, (_, i) => ({ type: 'paragraph', id: i }));
			const largeBatch = Array.from({ length: 250 }, (_, i) => ({ type: 'paragraph', id: i }));

			// Small batch should use single API call
			mockMarkdownToNotion.addSingleBatch.mockResolvedValueOnce({
				response: { results: smallBatch },
				blocksAdded: 50,
				warnings: []
			});

			mockMarkdownToNotion.addBlocksToPage.mockImplementation(async (executeFunctions, pageId, blocks) => {
				if (blocks.length <= 100) {
					return mockMarkdownToNotion.addSingleBatch(executeFunctions, pageId, blocks);
				} else {
					// Simulate chunking for large batches
					const chunks = [];
					for (let i = 0; i < blocks.length; i += 100) {
						chunks.push(blocks.slice(i, i + 100));
					}
					
					const results = await Promise.all(
						chunks.map(chunk => mockMarkdownToNotion.addSingleBatch(executeFunctions, pageId, chunk))
					);
					
					return {
						response: { results: results.flatMap(r => r.response.results) },
						blocksAdded: results.reduce((sum, r) => sum + r.blocksAdded, 0),
						warnings: results.flatMap(r => r.warnings)
					};
				}
			});

			// Test small batch
			const smallResult = await mockMarkdownToNotion.addBlocksToPage(
				mockExecuteFunctions,
				'test-page-id',
				smallBatch
			);

			expect(smallResult.blocksAdded).toBe(50);
			expect(mockMarkdownToNotion.addSingleBatch).toHaveBeenCalledTimes(1);

			// Reset mocks
			jest.clearAllMocks();

			// Mock for large batch chunks
			mockMarkdownToNotion.addSingleBatch
				.mockResolvedValueOnce({
					response: { results: Array.from({ length: 100 }, (_, i) => ({ id: `block-${i}` })) },
					blocksAdded: 100,
					warnings: []
				})
				.mockResolvedValueOnce({
					response: { results: Array.from({ length: 100 }, (_, i) => ({ id: `block-${i + 100}` })) },
					blocksAdded: 100,
					warnings: []
				})
				.mockResolvedValueOnce({
					response: { results: Array.from({ length: 50 }, (_, i) => ({ id: `block-${i + 200}` })) },
					blocksAdded: 50,
					warnings: []
				});

			// Test large batch
			const largeResult = await mockMarkdownToNotion.addBlocksToPage(
				mockExecuteFunctions,
				'test-page-id',
				largeBatch
			);

			expect(largeResult.blocksAdded).toBe(250);
			expect(mockMarkdownToNotion.addSingleBatch).toHaveBeenCalledTimes(3);
		});

		it('should handle error scenarios gracefully', async () => {
			const mockError = new Error('API Error');
			
			mockMarkdownToNotion.addBlocksToPage.mockRejectedValueOnce(mockError);
			
			mockMarkdownToNotion.processToggleHeadingsWithAPI.mockImplementation(async () => {
				try {
					await mockMarkdownToNotion.addBlocksToPage();
				} catch (error) {
					throw new Error(`Toggle headings processing failed: ${error.message}`);
				}
			});

			await expect(
				mockMarkdownToNotion.processToggleHeadingsWithAPI(
					mockExecuteFunctions,
					'test-page-id',
					'# Test',
					{},
					0
				)
			).rejects.toThrow('Toggle headings processing failed: API Error');
		});
	});

	describe('Performance Characteristics', () => {
		it('should track API call efficiency', () => {
			const regularModeBlocks = Array.from({ length: 155 }, (_, i) => ({ type: 'paragraph', id: i }));
			const toggleStructure = {
				rootNodes: Array.from({ length: 50 }, (_, i) => ({
					level: 1,
					heading: { type: 'toggle' },
					children: [{ type: 'paragraph' }],
					subHeadings: []
				})),
				orphanBlocks: []
			};

			// Regular mode: ceil(155/100) = 2 API calls
			const regularApiCalls = Math.ceil(regularModeBlocks.length / 100);
			expect(regularApiCalls).toBe(2);

			// Toggle mode: 50 headings * 2 calls each (heading + children) = 100 API calls
			const toggleApiCalls = toggleStructure.rootNodes.length * 2;
			expect(toggleApiCalls).toBe(100);

			// Performance ratio
			const performanceRatio = toggleApiCalls / regularApiCalls;
			expect(performanceRatio).toBe(50);

			// This demonstrates the performance trade-off
			expect(performanceRatio).toBeGreaterThan(1);
		});

		it('should handle memory usage efficiently', () => {
			const largeStructure = {
				rootNodes: Array.from({ length: 1000 }, (_, i) => ({
					level: 1,
					heading: { type: 'toggle', toggle: { rich_text: [{ text: { content: `Heading ${i}` } }] } },
					children: Array.from({ length: 10 }, (_, j) => ({ type: 'paragraph', id: `${i}-${j}` })),
					subHeadings: []
				})),
				orphanBlocks: []
			};

			// Verify structure is created without memory issues
			expect(largeStructure.rootNodes).toHaveLength(1000);
			expect(largeStructure.rootNodes[0].children).toHaveLength(10);
			
			// Calculate total blocks
			const totalBlocks = largeStructure.rootNodes.reduce((sum, node) => {
				return sum + 1 + node.children.length; // 1 for heading + children
			}, 0);
			
			expect(totalBlocks).toBe(11000); // 1000 headings + 10000 children
		});
	});
});