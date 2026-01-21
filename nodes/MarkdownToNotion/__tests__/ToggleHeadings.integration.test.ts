import { MarkdownToNotion } from '../MarkdownToNotion.node';
import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

describe('ToggleHeadings - Integration Tests', () => {
	let node: MarkdownToNotion;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockHttpRequest: jest.Mock;

	beforeEach(() => {
		node = new MarkdownToNotion();
		mockHttpRequest = jest.fn();
		
		mockExecuteFunctions = {
			getInputData: jest.fn(() => [{ json: {} }]),
			getNodeParameter: jest.fn(),
			getNode: jest.fn(() => ({
				id: 'test-node-id',
				name: 'Test Node',
				type: 'test',
				typeVersion: 1,
				position: [0, 0],
				parameters: {}
			})),
			continueOnFail: jest.fn(() => false),
			helpers: {
				httpRequestWithAuthentication: mockHttpRequest
			} as any,
		};
	});

	describe('End-to-End Toggle Headings Flow', () => {
		it('should execute complete toggle headings workflow', async () => {
			const pageId = '59833787-2cf9-4fdf-8782-e53db20768a5';
			const markdown = `# Main Section
This is the main content with **bold** text.

## Subsection A
- List item 1
- List item 2

### Deep Section
\`\`\`javascript
console.log('Hello World');
\`\`\`

## Subsection B
> This is a blockquote

# Another Section
Final content here.`;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(pageId)
				.mockReturnValueOnce(markdown)
				.mockReturnValueOnce({ toggleHeadings: true, preserveMath: true });

			const mockResponses = [
				{ object: 'list', results: [{ id: 'heading-1-id', type: 'toggle' }] },
				{ object: 'list', results: [{ id: 'content-1-id', type: 'paragraph' }] },
				{ object: 'list', results: [{ id: 'heading-2-id', type: 'toggle' }] },
				{ object: 'list', results: [{ id: 'list-1-id', type: 'bulleted_list_item' }] },
				{ object: 'list', results: [{ id: 'heading-3-id', type: 'toggle' }] },
				{ object: 'list', results: [{ id: 'code-1-id', type: 'code' }] },
				{ object: 'list', results: [{ id: 'heading-4-id', type: 'toggle' }] },
				{ object: 'list', results: [{ id: 'quote-1-id', type: 'quote' }] },
				{ object: 'list', results: [{ id: 'heading-5-id', type: 'toggle' }] },
				{ object: 'list', results: [{ id: 'content-2-id', type: 'paragraph' }] }
			];

			mockHttpRequest.mockImplementation(() => 
				Promise.resolve(mockResponses.shift())
			);

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toMatchObject({
				success: true,
				pageId,
				blocksAdded: 10,
				chunksProcessed: 10
			});

			expect(mockHttpRequest).toHaveBeenCalledTimes(10);
		});

		it('should handle toggle headings with math formulas', async () => {
			const pageId = '59833787-2cf9-4fdf-8782-e53db20768a5';
			const markdown = `# Mathematical Concepts
Introduction to mathematics.

## Algebra: $x^2 + y^2 = z^2$
The Pythagorean theorem: $a^2 + b^2 = c^2$

## Calculus: \\(\\frac{d}{dx}x^2 = 2x\\)
Derivative of $x^2$ is $2x$.`;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(pageId)
				.mockReturnValueOnce(markdown)
				.mockReturnValueOnce({ 
					toggleHeadings: true, 
					preserveMath: true, 
					mathDelimiter: '$',
					supportLatex: true 
				});

			mockHttpRequest.mockResolvedValue({
				object: 'list',
				results: [{ id: 'mock-id', type: 'toggle' }]
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.success).toBe(true);

			const apiCalls = mockHttpRequest.mock.calls;
			const hasEquationBlocks = apiCalls.some(call =>
				call[1].body.children.some((block: any) => block.type === 'equation')
			);

			expect(hasEquationBlocks).toBe(true);
		});

		it('should handle toggle headings with orphan content', async () => {
			const pageId = '59833787-2cf9-4fdf-8782-e53db20768a5';
			const markdown = `This is orphan content at the beginning.

Another orphan paragraph.

# First Heading
Content under first heading.

# Second Heading
Content under second heading.`;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(pageId)
				.mockReturnValueOnce(markdown)
				.mockReturnValueOnce({ toggleHeadings: true });

			const mockResponses = [
				{ object: 'list', results: [
					{ id: 'orphan-1-id', type: 'paragraph' },
					{ id: 'orphan-2-id', type: 'paragraph' }
				]},
				{ object: 'list', results: [{ id: 'heading-1-id', type: 'toggle' }] },
				{ object: 'list', results: [{ id: 'content-1-id', type: 'paragraph' }] },
				{ object: 'list', results: [{ id: 'heading-2-id', type: 'toggle' }] },
				{ object: 'list', results: [{ id: 'content-2-id', type: 'paragraph' }] }
			];

			mockHttpRequest.mockImplementation(() => 
				Promise.resolve(mockResponses.shift())
			);

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.success).toBe(true);
			expect(result[0][0].json.blocksAdded).toBe(6);

			const firstCall = mockHttpRequest.mock.calls[0][1];
			expect(firstCall.url).toBe(`https://api.notion.com/v1/blocks/${pageId}/children`);
			expect(firstCall.body.children).toHaveLength(2);
		});

		it('should handle complex nested structure with mixed content types', async () => {
			const pageId = '59833787-2cf9-4fdf-8782-e53db20768a5';
			const markdown = `# Documentation
Welcome to our documentation.

## Getting Started
Follow these steps:

1. Install the package
2. Configure settings
3. Run the application

### Installation
\`\`\`bash
npm install package-name
\`\`\`

### Configuration
Create a config file:

\`\`\`json
{
  "setting": "value"
}
\`\`\`

## API Reference
Available endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /api/users | Get users |
| POST   | /api/users | Create user |

### Authentication
> **Note**: All API calls require authentication.

Use Bearer tokens:
\`Authorization: Bearer <token>\`

## Examples
Here are some examples.`;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(pageId)
				.mockReturnValueOnce(markdown)
				.mockReturnValueOnce({ toggleHeadings: true });

			mockHttpRequest.mockResolvedValue({
				object: 'list',
				results: [{ id: 'mock-id', type: 'toggle' }]
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.success).toBe(true);
			expect(mockHttpRequest).toHaveBeenCalled();

			const apiCalls = mockHttpRequest.mock.calls;
			const hasCodeBlocks = apiCalls.some(call =>
				call[1].body.children.some((block: any) => block.type === 'code')
			);
			const hasTableBlocks = apiCalls.some(call =>
				call[1].body.children.some((block: any) => block.type === 'table')
			);
			const hasQuoteBlocks = apiCalls.some(call =>
				call[1].body.children.some((block: any) => block.type === 'quote')
			);

			expect(hasCodeBlocks).toBe(true);
			expect(hasTableBlocks).toBe(true);
			expect(hasQuoteBlocks).toBe(true);
		});

		it('should handle errors gracefully and provide meaningful messages', async () => {
			const pageId = '59833787-2cf9-4fdf-8782-e53db20768a5';
			const markdown = `# Test Heading
Content`;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(pageId)
				.mockReturnValueOnce(markdown)
				.mockReturnValueOnce({ toggleHeadings: true });

			mockHttpRequest.mockRejectedValueOnce(new Error('Network timeout'));

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions)
			).rejects.toThrow('Toggle headings processing failed: Network timeout');
		});

		it('should handle continueOnFail mode for toggle headings', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			
			const pageId = '59833787-2cf9-4fdf-8782-e53db20768a5';
			const markdown = `# Test Heading
Content`;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(pageId)
				.mockReturnValueOnce(markdown)
				.mockReturnValueOnce({ toggleHeadings: true });

			mockHttpRequest.mockRejectedValueOnce(new Error('API Error'));

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json.success).toBe(false);
			expect(result[0][0].json.error).toContain('Toggle headings processing failed');
		});
	});

	describe('Toggle vs Regular Mode Comparison', () => {
		it('should produce different API call patterns for same content', async () => {
			const pageId = '59833787-2cf9-4fdf-8782-e53db20768a5';
			const markdown = `# Heading 1
Content 1

# Heading 2
Content 2`;

			mockHttpRequest.mockResolvedValue({
				object: 'list',
				results: [{ id: 'mock-id', type: 'paragraph' }]
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(pageId)
				.mockReturnValueOnce(markdown)
				.mockReturnValueOnce({ toggleHeadings: false });

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);
			const regularModeCallCount = mockHttpRequest.mock.calls.length;

			mockHttpRequest.mockClear();

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(pageId)
				.mockReturnValueOnce(markdown)
				.mockReturnValueOnce({ toggleHeadings: true });

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);
			const toggleModeCallCount = mockHttpRequest.mock.calls.length;

			expect(toggleModeCallCount).toBeGreaterThan(regularModeCallCount);
		});

		it('should create different block structures for same markdown', async () => {
			const pageId = '59833787-2cf9-4fdf-8782-e53db20768a5';
			const markdown = `# Main Heading
Content under main heading`;

			mockHttpRequest.mockResolvedValue({
				object: 'list',
				results: [{ id: 'mock-id', type: 'heading_1' }]
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(pageId)
				.mockReturnValueOnce(markdown)
				.mockReturnValueOnce({ toggleHeadings: false });

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);
			const regularModeBlocks = mockHttpRequest.mock.calls[0][1].body.children;

			mockHttpRequest.mockClear();
			mockHttpRequest.mockResolvedValue({
				object: 'list',
				results: [{ id: 'mock-id', type: 'toggle' }]
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(pageId)
				.mockReturnValueOnce(markdown)
				.mockReturnValueOnce({ toggleHeadings: true });

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);
			const toggleModeBlocks = mockHttpRequest.mock.calls[0][1].body.children;

			expect(regularModeBlocks[0].type).toBe('heading_1');
			expect(toggleModeBlocks[0].type).toBe('toggle');
		});
	});

	describe('Real-world Scenarios', () => {
		it('should handle documentation with code examples', async () => {
			const pageId = '59833787-2cf9-4fdf-8782-e53db20768a5';
			const markdown = `# API Documentation

## Authentication
All requests require authentication.

### Getting API Key
1. Log into dashboard
2. Navigate to API section
3. Generate new key

\`\`\`bash
curl -H "Authorization: Bearer YOUR_KEY" https://api.example.com
\`\`\`

## Endpoints

### Users
Get user information:

\`\`\`javascript
const response = await fetch('/api/users/123');
const user = await response.json();
\`\`\`

### Posts
Create a new post:

\`\`\`python
import requests

data = {"title": "Hello", "content": "World"}
response = requests.post("/api/posts", json=data)
\`\`\``;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(pageId)
				.mockReturnValueOnce(markdown)
				.mockReturnValueOnce({ toggleHeadings: true });

			mockHttpRequest.mockResolvedValue({
				object: 'list',
				results: [{ id: 'mock-id', type: 'toggle' }]
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.success).toBe(true);
			expect(mockHttpRequest).toHaveBeenCalled();

			const apiCalls = mockHttpRequest.mock.calls;
			const codeBlockLanguages: string[] = [];
			
			apiCalls.forEach(call => {
				call[1].body.children.forEach((block: any) => {
					if (block.type === 'code' && block.code?.language) {
						codeBlockLanguages.push(block.code.language);
					}
				});
			});

			expect(codeBlockLanguages).toContain('bash');
			expect(codeBlockLanguages).toContain('javascript');
			expect(codeBlockLanguages).toContain('python');
		});

		it('should handle scientific document with formulas and tables', async () => {
			const pageId = '59833787-2cf9-4fdf-8782-e53db20768a5';
			const markdown = `# Physics Formulas

## Classical Mechanics
Newton's second law: $F = ma$

### Kinematic Equations
Position: $x = x_0 + v_0t + \\frac{1}{2}at^2$

Velocity: $v = v_0 + at$

## Data Table

| Variable | Symbol | Unit |
|----------|--------|------|
| Force    | F      | N    |
| Mass     | m      | kg   |
| Acceleration | a  | m/s² |

## Quantum Mechanics
Schrödinger equation: $i\\hbar\\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi$`;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(pageId)
				.mockReturnValueOnce(markdown)
				.mockReturnValueOnce({ 
					toggleHeadings: true, 
					preserveMath: true,
					supportLatex: true 
				});

			mockHttpRequest.mockResolvedValue({
				object: 'list',
				results: [{ id: 'mock-id', type: 'toggle' }]
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.success).toBe(true);

			const apiCalls = mockHttpRequest.mock.calls;
			let hasEquations = false;
			let hasTables = false;

			apiCalls.forEach(call => {
				call[1].body.children.forEach((block: any) => {
					if (block.type === 'equation') hasEquations = true;
					if (block.type === 'table') hasTables = true;
				});
			});

			expect(hasEquations).toBe(true);
			expect(hasTables).toBe(true);
		});

		it('should handle large document with performance monitoring', async () => {
			const pageId = '59833787-2cf9-4fdf-8782-e53db20768a5';
			
			let markdown = '# Large Document\n\n';
			for (let i = 1; i <= 20; i++) {
				markdown += `## Section ${i}\n`;
				markdown += `Content for section ${i}.\n\n`;
				
				for (let j = 1; j <= 3; j++) {
					markdown += `### Subsection ${i}.${j}\n`;
					markdown += `Detailed content for subsection ${i}.${j}.\n\n`;
				}
			}

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('appendToPage')
				.mockReturnValueOnce(pageId)
				.mockReturnValueOnce(markdown)
				.mockReturnValueOnce({ toggleHeadings: true });

			mockHttpRequest.mockResolvedValue({
				object: 'list',
				results: [{ id: 'mock-id', type: 'toggle' }]
			});

			const startTime = process.hrtime.bigint();
			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);
			const endTime = process.hrtime.bigint();
			const durationMs = Number(endTime - startTime) / 1_000_000;

			expect(result[0][0].json.success).toBe(true);
			expect(durationMs).toBeLessThan(10000);
			expect(mockHttpRequest).toHaveBeenCalled();
		});
	});
});