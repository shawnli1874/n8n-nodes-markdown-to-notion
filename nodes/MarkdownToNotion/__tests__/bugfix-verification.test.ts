import { MarkdownToNotion } from '../MarkdownToNotion.node';

describe('MarkdownToNotion - Critical Bug Fix Verification', () => {
	let node: MarkdownToNotion;

	beforeEach(() => {
		node = new MarkdownToNotion();
	});

	test('convertMarkdownToNotionBlocks should be accessible as instance method', () => {
		expect(typeof (node as any).convertMarkdownToNotionBlocks).toBe('function');
	});

	test('should have validation methods', () => {
		expect(typeof (node as any).validatePageId).toBe('function');
		expect(typeof (node as any).validateMarkdownContent).toBe('function');
		expect(typeof (node as any).validateNotionApiResponse).toBe('function');
	});

	test('node description should be properly configured', () => {
		expect(node.description.displayName).toBe('Markdown to Notion');
		expect(node.description.name).toBe('markdownToNotion');
		expect(node.description.credentials).toBeDefined();
		expect(node.description.credentials![0].name).toBe('notionApi');
	});
});
