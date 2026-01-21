import { MarkdownToNotion } from '../MarkdownToNotion.node';
import { IExecuteFunctions } from 'n8n-workflow';

describe('ToggleHeadings - Performance Regression', () => {
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

	const createLargeMarkdownDocument = (headingCount: number, contentPerHeading: number = 3) => {
		let markdown = '';
		
		for (let i = 1; i <= headingCount; i++) {
			const level = Math.min(Math.floor((i - 1) / 10) + 1, 6);
			const headingPrefix = '#'.repeat(level);
			
			markdown += `${headingPrefix} Heading ${i}\n\n`;
			
			for (let j = 1; j <= contentPerHeading; j++) {
				markdown += `This is paragraph ${j} under heading ${i}. `;
				markdown += `It contains some **bold text** and *italic text* for formatting. `;
				markdown += `Here's a code snippet: \`console.log('test')\`.\n\n`;
			}
			
			if (i % 5 === 0) {
				markdown += `\`\`\`javascript
function example${i}() {
    return "This is a code block under heading ${i}";
}
\`\`\`\n\n`;
			}
			
			if (i % 7 === 0) {
				markdown += `| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data ${i}A | Data ${i}B | Data ${i}C |
| More ${i} | Data ${i} | Here ${i} |

`;
			}
		}
		
		return markdown;
	};

	describe('Performance Benchmarks', () => {
		it('should maintain performance for regular mode (baseline)', async () => {
			const markdown = createLargeMarkdownDocument(50, 3);
			
			mockHttpRequest.mockResolvedValue({
				object: 'list',
				results: Array.from({ length: 100 }, (_, i) => ({ id: `block-${i}`, type: 'paragraph' }))
			});

			const startTime = process.hrtime.bigint();
			
			const result = await (MarkdownToNotion as any).convertMarkdownToNotionBlocks(
				markdown,
				true,
				'$',
				true,
				false
			);

			const endTime = process.hrtime.bigint();
			const durationMs = Number(endTime - startTime) / 1_000_000;

			expect(Array.isArray(result)).toBe(true);
			expect((result as any[]).length).toBeGreaterThan(100);
			expect(durationMs).toBeLessThan(1000);
		});

		it('should detect performance regression in toggle mode structure building', async () => {
			const markdown = createLargeMarkdownDocument(30, 2);
			
			const startTime = process.hrtime.bigint();
			
			const result = await (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown,
				true,
				'$',
				true
			);

			const endTime = process.hrtime.bigint();
			const durationMs = Number(endTime - startTime) / 1_000_000;

			expect(result.rootNodes).toBeDefined();
			expect(result.rootNodes.length).toBeGreaterThan(0);
			expect(durationMs).toBeLessThan(2000);
		});

		it('should track API call count for toggle mode vs regular mode', async () => {
			const markdown = createLargeMarkdownDocument(10, 2);
			
			mockHttpRequest.mockResolvedValue({
				object: 'list',
				results: [{ id: 'mock-block-id', type: 'paragraph' }]
			});

		mockHttpRequest.mockClear();
		const regularResult = await (MarkdownToNotion as any).convertMarkdownToNotionBlocks(
			markdown,
			true,
			'$',
			true,
			false
		);

		const toggleStructure = await (MarkdownToNotion as any).convertMarkdownToToggleStructure(
			markdown,
			true,
			'$',
			true
		);

		const expectedToggleApiCalls = calculateExpectedToggleApiCalls(toggleStructure);
		const regularBlocks = regularResult as any[];
		const expectedRegularApiCalls = Math.ceil(regularBlocks.length / 100);

			expect(expectedToggleApiCalls).toBeGreaterThan(expectedRegularApiCalls);
			
			const performanceRatio = expectedToggleApiCalls / expectedRegularApiCalls;
			expect(performanceRatio).toBeLessThan(20);
		});

		it('should handle memory usage efficiently for large documents', async () => {
			const markdown = createLargeMarkdownDocument(100, 5);
			
			const initialMemory = process.memoryUsage().heapUsed;
			
			const result = await (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown,
				true,
				'$',
				true
			);

			const finalMemory = process.memoryUsage().heapUsed;
			const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024;

			expect(result.rootNodes).toBeDefined();
			expect(memoryIncreaseMB).toBeLessThan(50);
		});

		it('should maintain reasonable performance with deep nesting', async () => {
			let markdown = '';
			for (let level = 1; level <= 10; level++) {
				const headingPrefix = '#'.repeat(Math.min(level, 6));
				markdown += `${headingPrefix} Level ${level} Heading\n`;
				markdown += `Content for level ${level}.\n\n`;
			}

			const startTime = process.hrtime.bigint();
			
			const result = await (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown,
				true,
				'$',
				true
			);

			const endTime = process.hrtime.bigint();
			const durationMs = Number(endTime - startTime) / 1_000_000;

			expect(result.rootNodes).toBeDefined();
			expect(durationMs).toBeLessThan(500);
			
			const maxDepth = calculateMaxDepth(result.rootNodes);
			expect(maxDepth).toBeLessThanOrEqual(6);
		});

		it('should handle concurrent processing efficiently', async () => {
			const markdown = createLargeMarkdownDocument(20, 2);
			
			const promises = Array.from({ length: 5 }, () =>
				(MarkdownToNotion as any).convertMarkdownToToggleStructure(
					markdown,
					true,
					'$',
					true
				)
			);

			const startTime = process.hrtime.bigint();
			const results = await Promise.all(promises);
			const endTime = process.hrtime.bigint();
			const durationMs = Number(endTime - startTime) / 1_000_000;

			expect(results).toHaveLength(5);
			results.forEach(result => {
				expect(result.rootNodes).toBeDefined();
				expect(result.rootNodes.length).toBeGreaterThan(0);
			});
			
			expect(durationMs).toBeLessThan(5000);
		});
	});

	describe('Performance Regression Detection', () => {
		const PERFORMANCE_THRESHOLDS = {
			STRUCTURE_BUILDING_MS: 2000,
			MEMORY_INCREASE_MB: 50,
			MAX_API_CALL_RATIO: 20,
			DEEP_NESTING_MS: 500,
			CONCURRENT_PROCESSING_MS: 5000
		};

		it('should fail if structure building exceeds threshold', async () => {
			const markdown = createLargeMarkdownDocument(100, 3);
			
			const startTime = process.hrtime.bigint();
			await (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown,
				true,
				'$',
				true
			);
			const endTime = process.hrtime.bigint();
			const durationMs = Number(endTime - startTime) / 1_000_000;

			if (durationMs > PERFORMANCE_THRESHOLDS.STRUCTURE_BUILDING_MS) {
				throw new Error(
					`Performance regression detected: Structure building took ${durationMs}ms, ` +
					`exceeding threshold of ${PERFORMANCE_THRESHOLDS.STRUCTURE_BUILDING_MS}ms`
				);
			}
		});

		it('should fail if memory usage exceeds threshold', async () => {
			const markdown = createLargeMarkdownDocument(200, 5);
			
			const initialMemory = process.memoryUsage().heapUsed;
			await (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown,
				true,
				'$',
				true
			);
			const finalMemory = process.memoryUsage().heapUsed;
			const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024;

			if (memoryIncreaseMB > PERFORMANCE_THRESHOLDS.MEMORY_INCREASE_MB) {
				throw new Error(
					`Performance regression detected: Memory usage increased by ${memoryIncreaseMB}MB, ` +
					`exceeding threshold of ${PERFORMANCE_THRESHOLDS.MEMORY_INCREASE_MB}MB`
				);
			}
		});

		it('should warn about API call efficiency degradation', async () => {
			const markdown = createLargeMarkdownDocument(50, 2);
			
			const regularResult = await (MarkdownToNotion as any).convertMarkdownToNotionBlocks(
				markdown,
				true,
				'$',
				true,
				false
			);
			
			const toggleStructure = await (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown,
				true,
				'$',
				true
			);

			const regularBlocks = regularResult as any[];
			const expectedRegularApiCalls = Math.ceil(regularBlocks.length / 100);
			const expectedToggleApiCalls = calculateExpectedToggleApiCalls(toggleStructure);
			
			const apiCallRatio = expectedToggleApiCalls / expectedRegularApiCalls;

			if (apiCallRatio > PERFORMANCE_THRESHOLDS.MAX_API_CALL_RATIO) {
				console.warn(
					`API efficiency warning: Toggle mode requires ${apiCallRatio}x more API calls ` +
					`than regular mode (${expectedToggleApiCalls} vs ${expectedRegularApiCalls})`
				);
			}

			expect(apiCallRatio).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_API_CALL_RATIO);
		});
	});

	describe('Stress Testing', () => {
		it('should handle extremely large documents without crashing', async () => {
			const markdown = createLargeMarkdownDocument(500, 1);
			
			await expect(
				(MarkdownToNotion as any).convertMarkdownToToggleStructure(
					markdown,
					true,
					'$',
					true
				)
			).resolves.toBeDefined();
		});

		it('should handle documents with many math formulas', async () => {
			let markdown = '# Math Heavy Document\n\n';
			for (let i = 1; i <= 100; i++) {
				markdown += `## Section ${i}\n`;
				markdown += `Formula ${i}: $x^${i} + y^${i} = z^${i}$\n\n`;
				markdown += `LaTeX formula: \\(\\sum_{i=1}^{${i}} x_i = ${i}\\)\n\n`;
			}

			const startTime = process.hrtime.bigint();
			const result = await (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown,
				true,
				'$',
				true
			);
			const endTime = process.hrtime.bigint();
			const durationMs = Number(endTime - startTime) / 1_000_000;

			expect(result.rootNodes).toBeDefined();
			expect(durationMs).toBeLessThan(5000);
		});

		it('should handle documents with complex tables', async () => {
			let markdown = '# Table Heavy Document\n\n';
			for (let i = 1; i <= 50; i++) {
				markdown += `## Table ${i}\n\n`;
				markdown += `| Col1 | Col2 | Col3 | Col4 | Col5 |\n`;
				markdown += `|------|------|------|------|------|\n`;
				for (let row = 1; row <= 10; row++) {
					markdown += `| Data${i}-${row}-1 | Data${i}-${row}-2 | Data${i}-${row}-3 | Data${i}-${row}-4 | Data${i}-${row}-5 |\n`;
				}
				markdown += '\n';
			}

			const result = await (MarkdownToNotion as any).convertMarkdownToToggleStructure(
				markdown,
				true,
				'$',
				true
			);

			expect(result.rootNodes).toBeDefined();
			expect(result.rootNodes.length).toBe(50);
		});
	});

});

function calculateExpectedToggleApiCalls(structure: any): number {
		let apiCalls = 0;
		
		if (structure.orphanBlocks && structure.orphanBlocks.length > 0) {
			apiCalls += Math.ceil(structure.orphanBlocks.length / 100);
		}
		
	const countNodeApiCalls = (node: any): number => {
		let calls = 1;
		
		if (node.children && node.children.length > 0) {
			calls += Math.ceil(node.children.length / 100);
		}
		
		if (node.subHeadings) {
			for (const subHeading of node.subHeadings) {
				calls += countNodeApiCalls(subHeading);
			}
		}
		
		return calls;
	};
	
	for (const rootNode of structure.rootNodes) {
		apiCalls += countNodeApiCalls(rootNode);
	}
	
	return apiCalls;
}

function calculateMaxDepth(nodes: any[]): number {
		let maxDepth = 0;
		
		const getDepth = (node: any, currentDepth: number): number => {
			let depth = currentDepth;
			
			if (node.subHeadings && node.subHeadings.length > 0) {
				for (const subHeading of node.subHeadings) {
					depth = Math.max(depth, getDepth(subHeading, currentDepth + 1));
				}
			}
			
			return depth;
		};
		
		for (const node of nodes) {
			maxDepth = Math.max(maxDepth, getDepth(node, 1));
		}
		
		return maxDepth;
}