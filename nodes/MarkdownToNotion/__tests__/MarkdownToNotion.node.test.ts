import { MarkdownToNotion } from '../MarkdownToNotion.node';
import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

describe('MarkdownToNotion Node', () => {
	let node: MarkdownToNotion;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;

	beforeEach(() => {
		node = new MarkdownToNotion();
		
		mockExecuteFunctions = {
			getInputData: jest.fn(() => [{ json: {} }]),
			getNodeParameter: jest.fn(),
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'test', typeVersion: 1, position: [0, 0] })),
			continueOnFail: jest.fn(() => false),
			helpers: {
				httpRequestWithAuthentication: jest.fn(),
			} as any,
		};
	});

	describe('Node Description', () => {
		it('should have correct metadata', () => {
			expect(node.description.displayName).toBe('Markdown to Notion');
			expect(node.description.name).toBe('markdownToNotion');
			expect(node.description.version).toBe(1);
			expect(node.description.group).toContain('transform');
		});

		it('should require notionApi credentials', () => {
			const credentials = node.description.credentials;
			expect(credentials).toBeDefined();
			expect(credentials![0].name).toBe('notionApi');
			expect(credentials![0].required).toBe(true);
		});

		it('should have appendToPage operation', () => {
			const operationProperty = node.description.properties.find(p => p.name === 'operation');
			expect(operationProperty).toBeDefined();
			expect(operationProperty!.type).toBe('options');
			
			const options = (operationProperty as any).options;
			expect(options[0].value).toBe('appendToPage');
		});
	});

	describe('Input Validation', () => {
		it('should validate empty Page ID', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('# Test')
				.mockReturnValueOnce({});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions)
			).rejects.toThrow('Page ID is required and cannot be empty');
		});

		it('should validate invalid Page ID format', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce('invalid-id')
				.mockReturnValueOnce('# Test')
				.mockReturnValueOnce({});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions)
			).rejects.toThrow('Invalid Page ID format');
		});

		it('should accept valid UUID Page ID with dashes', async () => {
			const validPageId = '59833787-2cf9-4fdf-8782-e53db20768a5';
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(validPageId)
				.mockReturnValueOnce('# Test')
				.mockReturnValueOnce({});

			(mockExecuteFunctions.helpers!.httpRequestWithAuthentication as jest.Mock)
				.mockResolvedValueOnce({ object: 'list', results: [] });

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockExecuteFunctions.helpers!.httpRequestWithAuthentication).toHaveBeenCalled();
		});

		it('should accept valid UUID Page ID without dashes', async () => {
			const validPageId = '598337872cf94fdf8782e53db20768a5';
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(validPageId)
				.mockReturnValueOnce('# Test')
				.mockReturnValueOnce({});

			(mockExecuteFunctions.helpers!.httpRequestWithAuthentication as jest.Mock)
				.mockResolvedValueOnce({ object: 'list', results: [] });

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockExecuteFunctions.helpers!.httpRequestWithAuthentication).toHaveBeenCalled();
		});

		it('should validate empty markdown content', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce('59833787-2cf9-4fdf-8782-e53db20768a5')
				.mockReturnValueOnce('')
				.mockReturnValueOnce({});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions)
			).rejects.toThrow('Markdown content is required and cannot be empty');
		});
	});

	describe('API Response Validation', () => {
		it('should handle Notion API error response', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce('59833787-2cf9-4fdf-8782-e53db20768a5')
				.mockReturnValueOnce('# Test')
				.mockReturnValueOnce({});

			(mockExecuteFunctions.helpers!.httpRequestWithAuthentication as jest.Mock)
				.mockResolvedValueOnce({
					object: 'error',
					message: 'Invalid page ID'
				});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions)
			).rejects.toThrow('Notion API error: Invalid page ID');
		});

		it('should handle unexpected API response', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce('59833787-2cf9-4fdf-8782-e53db20768a5')
				.mockReturnValueOnce('# Test')
				.mockReturnValueOnce({});

			(mockExecuteFunctions.helpers!.httpRequestWithAuthentication as jest.Mock)
				.mockResolvedValueOnce(null);

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions)
			).rejects.toThrow('Unexpected Notion API response');
		});
	});

	describe('Successful Execution', () => {
		it('should successfully append markdown to Notion page', async () => {
			const validPageId = '59833787-2cf9-4fdf-8782-e53db20768a5';
			const markdownContent = '# Test Heading\n\nSome content';
			
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(validPageId)
				.mockReturnValueOnce(markdownContent)
				.mockReturnValueOnce({});

			const mockApiResponse = {
				object: 'list',
				results: [
					{ id: 'block-1', type: 'heading_1' },
					{ id: 'block-2', type: 'paragraph' }
				]
			};

			(mockExecuteFunctions.helpers!.httpRequestWithAuthentication as jest.Mock)
				.mockResolvedValueOnce(mockApiResponse);

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toMatchObject({
				success: true,
				pageId: validPageId,
				blocksAdded: 2
			});
		});

		it('should not include Notion-Version header in request', async () => {
			const validPageId = '59833787-2cf9-4fdf-8782-e53db20768a5';
			
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(validPageId)
				.mockReturnValueOnce('# Test')
				.mockReturnValueOnce({});

			(mockExecuteFunctions.helpers!.httpRequestWithAuthentication as jest.Mock)
				.mockResolvedValueOnce({ object: 'list', results: [] });

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			const requestOptions = (mockExecuteFunctions.helpers!.httpRequestWithAuthentication as jest.Mock).mock.calls[0][1];
			expect(requestOptions.headers).toBeUndefined();
		});
	});

	describe('Error Handling', () => {
		it('should handle continueOnFail mode', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('# Test')
				.mockReturnValueOnce({});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json.success).toBe(false);
			expect(result[0][0].json.error).toBeDefined();
		});
	});
});
