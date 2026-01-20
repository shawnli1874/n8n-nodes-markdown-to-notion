import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IRequestOptions,
	NodeOperationError,
} from 'n8n-workflow';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import { toString as mdastToString } from 'mdast-util-to-string';

interface NotionBlock {
	object: 'block';
	type: string;
	[key: string]: any;
}

interface RichTextObject {
	type: 'text';
	text: {
		content: string;
		link?: { url: string } | null;
	};
	annotations?: {
		bold?: boolean;
		italic?: boolean;
		strikethrough?: boolean;
		underline?: boolean;
		code?: boolean;
		color?: string;
	};
}

export class MarkdownToNotion implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Markdown to Notion',
		name: 'markdownToNotion',
		icon: 'file:notion.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Convert markdown content to Notion page blocks with proper formula handling',
		defaults: {
			name: 'Markdown to Notion',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'notionApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Append to Page',
						value: 'appendToPage',
						description: 'Convert markdown and append blocks to an existing Notion page',
						action: 'Append markdown content to a Notion page',
					},
				],
				default: 'appendToPage',
			},
			{
				displayName: 'Page ID',
				name: 'pageId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						operation: ['appendToPage'],
					},
				},
				default: '',
				placeholder: 'e.g. 59833787-2cf9-4fdf-8782-e53db20768a5',
				description: 'The ID of the Notion page to append content to. You can find this in the page URL.',
			},
			{
				displayName: 'Markdown Content',
				name: 'markdownContent',
				type: 'string',
				typeOptions: {
					rows: 10,
				},
				required: true,
				displayOptions: {
					show: {
						operation: ['appendToPage'],
					},
				},
				default: '',
				placeholder: '# Heading\\n\\nSome **bold** text with $inline formula$ and more content.',
				description: 'The markdown content to convert and append to the Notion page',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						operation: ['appendToPage'],
					},
				},
				options: [
					{
						displayName: 'Preserve Math Formulas',
						name: 'preserveMath',
						type: 'boolean',
						default: true,
						description: 'Whether to preserve inline math formulas (text between $ symbols) as plain text instead of converting them',
					},
					{
						displayName: 'Math Formula Delimiter',
						name: 'mathDelimiter',
						type: 'string',
						default: '$',
						description: 'The delimiter used for inline math formulas (default: $)',
						displayOptions: {
							show: {
								preserveMath: [true],
							},
						},
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const pageId = this.getNodeParameter('pageId', i) as string;
				const markdownContent = this.getNodeParameter('markdownContent', i) as string;
				const options = this.getNodeParameter('options', i, {}) as {
					preserveMath?: boolean;
					mathDelimiter?: string;
				};

			if (operation === 'appendToPage') {
				if (!pageId || !pageId.trim()) {
					throw new NodeOperationError(
						this.getNode(),
						'Page ID is required and cannot be empty.',
						{ itemIndex: i }
					);
				}

				const cleanPageId = pageId.replace(/-/g, '');
				if (!/^[a-f0-9]{32}$/i.test(cleanPageId)) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid Page ID format. Expected a UUID (32 or 36 characters). You can find the Page ID in the Notion page URL.',
						{ itemIndex: i }
					);
				}

				if (!markdownContent || !markdownContent.trim()) {
					throw new NodeOperationError(
						this.getNode(),
						'Markdown content is required and cannot be empty.',
						{ itemIndex: i }
					);
				}

			const blocks = await MarkdownToNotion.convertMarkdownToNotionBlocks(
				markdownContent,
				options.preserveMath ?? true,
				options.mathDelimiter ?? '$'
			);

			const MAX_BLOCKS_PER_REQUEST = 100;
			const allResponses: any[] = [];
			let totalBlocksAdded = 0;
			const warnings: string[] = [];

			for (let chunkIndex = 0; chunkIndex < blocks.length; chunkIndex += MAX_BLOCKS_PER_REQUEST) {
				const chunk = blocks.slice(chunkIndex, chunkIndex + MAX_BLOCKS_PER_REQUEST);
				
				const normalizedResult = MarkdownToNotion.normalizeBlocksForNotion(chunk);
				const normalizedChunk = normalizedResult.blocks;
				warnings.push(...normalizedResult.warnings);
				
				const requestOptions: IRequestOptions = {
					method: 'PATCH',
					url: `https://api.notion.com/v1/blocks/${pageId}/children`,
					body: {
						children: normalizedChunk,
					},
					json: true,
				};

				try {
					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'notionApi',
						requestOptions,
					);

					if (!response || typeof response !== 'object') {
						throw new NodeOperationError(
							this.getNode(),
							`Unexpected Notion API response for chunk ${Math.floor(chunkIndex / MAX_BLOCKS_PER_REQUEST) + 1}: ${JSON.stringify(response)}`,
							{ itemIndex: i }
						);
					}

					if (response.object === 'error') {
						const errorDetails = MarkdownToNotion.parseNotionError(response);
						
						const retryResult = await MarkdownToNotion.retryWithBisection(
							this,
							pageId,
							normalizedChunk,
							errorDetails
						);
						
						allResponses.push(retryResult.response);
						totalBlocksAdded += retryResult.blocksAdded;
						warnings.push(...retryResult.warnings);
					} else {
						allResponses.push(response);
						totalBlocksAdded += response.results?.length || 0;
					}
				} catch (error) {
					if (error.response && error.response.body) {
						const errorBody = typeof error.response.body === 'string' 
							? JSON.parse(error.response.body) 
							: error.response.body;
						
						const errorDetails = MarkdownToNotion.parseNotionError(errorBody);
						
						try {
							const retryResult = await MarkdownToNotion.retryWithBisection(
								this,
								pageId,
								normalizedChunk,
								errorDetails
							);
							
							allResponses.push(retryResult.response);
							totalBlocksAdded += retryResult.blocksAdded;
							warnings.push(...retryResult.warnings);
						} catch (retryError) {
							throw new NodeOperationError(
								this.getNode(),
								`Failed to process chunk ${Math.floor(chunkIndex / MAX_BLOCKS_PER_REQUEST) + 1} even with retry: ${retryError.message}`,
								{ itemIndex: i }
							);
						}
					} else {
						throw error;
					}
				}
			}

				returnData.push({
					json: {
						success: true,
						pageId,
						blocksAdded: totalBlocksAdded,
						chunksProcessed: allResponses.length,
						totalBlocks: blocks.length,
						warnings: warnings.length > 0 ? warnings : undefined,
						responses: allResponses,
					},
					pairedItem: {
						item: i,
					},
				});
			}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
							success: false,
						},
						pairedItem: {
							item: i,
						},
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex: i,
				});
			}
		}

		return [returnData];
	}

	private static sanitizeFencedCodeBlocks(markdown: string): string {
		const lines = markdown.split('\n');
		const fenceStack: { type: string; line: number }[] = [];
		const result: string[] = [];
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();
			
			if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
				const fenceType = trimmed.startsWith('```') ? '```' : '~~~';
				const lastFence = fenceStack[fenceStack.length - 1];
				
				if (lastFence && lastFence.type === fenceType) {
					fenceStack.pop();
				} else {
					fenceStack.push({ type: fenceType, line: i });
				}
			}
			
			result.push(line);
		}
		
		while (fenceStack.length > 0) {
			const unclosedFence = fenceStack.pop()!;
			result.push(unclosedFence.type);
		}
		
		return result.join('\n');
	}

	private static async convertMarkdownToNotionBlocks(
		markdown: string,
		preserveMath: boolean = true,
		mathDelimiter: string = '$'
	): Promise<NotionBlock[]> {
		let processedMarkdown = markdown;
		const mathPlaceholders: { [key: string]: string } = {};
		
		if (preserveMath) {
			const mathRegex = new RegExp(`\\${mathDelimiter}([^${mathDelimiter}]+)\\${mathDelimiter}`, 'g');
			let mathCounter = 0;
			
			processedMarkdown = markdown.replace(mathRegex, (match, formula) => {
				const placeholder = `MATHPLACEHOLDER${mathCounter}MATHPLACEHOLDER`;
				mathPlaceholders[placeholder] = match;
				mathCounter++;
				return placeholder;
			});
		}

		processedMarkdown = MarkdownToNotion.sanitizeFencedCodeBlocks(processedMarkdown);
		processedMarkdown = MarkdownToNotion.preprocessToggleBlocks(processedMarkdown);

		const processor = unified()
			.use(remarkParse)
			.use(remarkGfm);

		const tree = processor.parse(processedMarkdown);
		const blocks: NotionBlock[] = [];

		for (const node of tree.children) {
			const nodeBlocks = MarkdownToNotion.nodeToBlocks(node as any, mathPlaceholders);
			blocks.push(...nodeBlocks);
		}

		return blocks;
	}

	private static nodeToBlocks(node: any, mathPlaceholders: { [key: string]: string }): NotionBlock[] {
		switch (node.type) {
			case 'heading':
				return [MarkdownToNotion.createHeadingBlock(node, mathPlaceholders)];
			case 'paragraph': {
				const content = mdastToString(node).trim();
				
				if (MarkdownToNotion.isDivider(content)) {
					return [MarkdownToNotion.createDividerBlock()];
				}
				
				if (MarkdownToNotion.isStandaloneUrl(content)) {
					return [MarkdownToNotion.createBookmarkBlock(content)];
				}
				
				return [MarkdownToNotion.createParagraphBlock(node, mathPlaceholders)];
			}
			case 'list':
				return MarkdownToNotion.createListBlocks(node, mathPlaceholders);
			case 'code':
				return [MarkdownToNotion.createCodeBlock(node)];
			case 'blockquote':
				return [MarkdownToNotion.createQuoteBlock(node, mathPlaceholders)];
			case 'table':
				return [MarkdownToNotion.createTableBlock(node)];
			case 'thematicBreak':
				return [MarkdownToNotion.createDividerBlock()];
			case 'html':
				if (node.value && node.value.includes('<details>')) {
					return [MarkdownToNotion.createToggleBlock(node.value, mathPlaceholders)];
				}
				return [];
			default:
				return [];
		}
	}

	private static createListBlocks(listNode: any, mathPlaceholders: { [key: string]: string }): NotionBlock[] {
		const blocks: NotionBlock[] = [];
		const isOrdered = listNode.ordered;
		
		for (const listItem of listNode.children) {
			if (listItem.type === 'listItem') {
				const block = MarkdownToNotion.createListItemBlock(listItem, isOrdered, mathPlaceholders);
				blocks.push(block);
			}
		}
		
		return blocks;
	}

	private static createListItemBlock(listItem: any, isOrdered: boolean, mathPlaceholders: { [key: string]: string }): NotionBlock {
		const blockType = isOrdered ? 'numbered_list_item' : 'bulleted_list_item';
		
		let richText: RichTextObject[] = [];
		const children: NotionBlock[] = [];
		
		if (listItem.children && listItem.children.length > 0) {
			const firstChild = listItem.children[0];
			
			if (firstChild.type === 'paragraph') {
				richText = MarkdownToNotion.inlineNodesToRichText(firstChild.children || [], mathPlaceholders);
				
				for (let i = 1; i < listItem.children.length; i++) {
					const childBlocks = MarkdownToNotion.nodeToBlocks(listItem.children[i], mathPlaceholders);
					children.push(...childBlocks);
				}
			} else {
				richText = [{ type: 'text', text: { content: '' } }];
				
				for (const child of listItem.children) {
					const childBlocks = MarkdownToNotion.nodeToBlocks(child, mathPlaceholders);
					children.push(...childBlocks);
				}
			}
		}
		
		const block: NotionBlock = {
			object: 'block',
			type: blockType,
			[blockType]: {
				rich_text: richText,
			},
		};
		
		if (children.length > 0) {
			(block as any)[blockType].children = children;
		}
		
		return block;
	}

	private static inlineNodesToRichText(nodes: any[], mathPlaceholders: { [key: string]: string }): RichTextObject[] {
		const richText: RichTextObject[] = [];
		
		for (const node of nodes) {
			switch (node.type) {
				case 'text': {
					let content = node.value;
					
					for (const [placeholder, mathFormula] of Object.entries(mathPlaceholders)) {
						content = content.replace(placeholder, mathFormula);
					}
					
					if (content) {
						richText.push({
							type: 'text',
							text: { content },
						});
					}
					break;
				}
				case 'strong': {
					const strongText = MarkdownToNotion.inlineNodesToRichText(node.children || [], mathPlaceholders);
					for (const rt of strongText) {
						rt.annotations = { ...rt.annotations, bold: true };
					}
					richText.push(...strongText);
					break;
				}
				case 'emphasis': {
					const emphasisText = MarkdownToNotion.inlineNodesToRichText(node.children || [], mathPlaceholders);
					for (const rt of emphasisText) {
						rt.annotations = { ...rt.annotations, italic: true };
					}
					richText.push(...emphasisText);
					break;
				}
				case 'inlineCode': {
					richText.push({
						type: 'text',
						text: { content: node.value },
						annotations: { code: true },
					});
					break;
				}
				case 'link': {
					const linkText = MarkdownToNotion.inlineNodesToRichText(node.children || [], mathPlaceholders);
					for (const rt of linkText) {
						rt.text.link = { url: node.url };
					}
					richText.push(...linkText);
					break;
				}
				case 'delete': {
					const strikeText = MarkdownToNotion.inlineNodesToRichText(node.children || [], mathPlaceholders);
					for (const rt of strikeText) {
						rt.annotations = { ...rt.annotations, strikethrough: true };
					}
					richText.push(...strikeText);
					break;
				}
				default: {
					const fallbackContent = mdastToString(node);
					if (fallbackContent) {
						richText.push({
							type: 'text',
							text: { content: fallbackContent },
						});
					}
					break;
				}
			}
		}
		
		return richText;
	}

	private static normalizeBlocksForNotion(blocks: NotionBlock[]): { blocks: NotionBlock[], warnings: string[] } {
		const MAX_RICH_TEXT_LENGTH = 2000;
		const MAX_RICH_TEXT_ARRAY_LENGTH = 100;
		const normalizedBlocks: NotionBlock[] = [];
		const warnings: string[] = [];
		
		for (const block of blocks) {
			const blockType = block.type;
			const blockData = block[blockType];
			
			if (blockType === 'code' && blockData && blockData.rich_text && blockData.rich_text.length > 0) {
				const codeContent = blockData.rich_text[0]?.text?.content || '';
				
				if (codeContent.length > MAX_RICH_TEXT_LENGTH) {
					const chunks = [];
					for (let i = 0; i < codeContent.length; i += MAX_RICH_TEXT_LENGTH) {
						chunks.push(codeContent.substring(i, i + MAX_RICH_TEXT_LENGTH));
					}
					
					for (let i = 0; i < chunks.length; i++) {
						const newBlock = JSON.parse(JSON.stringify(block));
						newBlock.code.rich_text = [{
							type: 'text',
							text: { content: chunks[i] },
						}];
						normalizedBlocks.push(newBlock);
					}
					
					warnings.push(`Split code block with ${codeContent.length} characters into ${chunks.length} blocks`);
				} else {
					normalizedBlocks.push(block);
				}
			} else if (blockData && blockData.rich_text) {
				const richTextArray = blockData.rich_text;
				
				if (richTextArray.length > MAX_RICH_TEXT_ARRAY_LENGTH) {
					const chunks = [];
					for (let i = 0; i < richTextArray.length; i += MAX_RICH_TEXT_ARRAY_LENGTH) {
						chunks.push(richTextArray.slice(i, i + MAX_RICH_TEXT_ARRAY_LENGTH));
					}
					
					for (let i = 0; i < chunks.length; i++) {
						const newBlock = JSON.parse(JSON.stringify(block));
						newBlock[blockType].rich_text = chunks[i];
						normalizedBlocks.push(newBlock);
					}
					
					warnings.push(`Split ${blockType} block with ${richTextArray.length} rich_text elements into ${chunks.length} blocks`);
					continue;
				}
				
				let needsSplit = false;
				const splitRichText: RichTextObject[] = [];
				
				for (const richText of richTextArray) {
					if (richText.text && richText.text.content.length > MAX_RICH_TEXT_LENGTH) {
						needsSplit = true;
						const content = richText.text.content;
						const chunks = [];
						
						for (let i = 0; i < content.length; i += MAX_RICH_TEXT_LENGTH) {
							chunks.push(content.substring(i, i + MAX_RICH_TEXT_LENGTH));
						}
						
						for (const chunk of chunks) {
							splitRichText.push({
								...richText,
								text: { ...richText.text, content: chunk },
							});
						}
					} else {
						splitRichText.push(richText);
					}
				}
				
				if (needsSplit) {
					const newBlock = JSON.parse(JSON.stringify(block));
					newBlock[blockType].rich_text = splitRichText;
					normalizedBlocks.push(newBlock);
					warnings.push(`Split long text content in ${blockType} block`);
				} else {
					normalizedBlocks.push(block);
				}
			} else {
				normalizedBlocks.push(block);
			}
		}
		
		return { blocks: normalizedBlocks, warnings };
	}

	private static async retryWithBisection(
		executeFunctions: IExecuteFunctions,
		pageId: string,
		blocks: NotionBlock[],
		errorDetails: string
	): Promise<{ response: any, blocksAdded: number, warnings: string[] }> {
		const warnings: string[] = [];
		let totalBlocksAdded = 0;
		
		if (blocks.length === 1) {
			warnings.push(`Skipping problematic block: ${errorDetails}`);
			return {
				response: { results: [] },
				blocksAdded: 0,
				warnings,
			};
		}
		
		const mid = Math.floor(blocks.length / 2);
		const firstHalf = blocks.slice(0, mid);
		const secondHalf = blocks.slice(mid);
		
		for (const half of [firstHalf, secondHalf]) {
			if (half.length === 0) continue;
			
			try {
				const requestOptions: IRequestOptions = {
					method: 'PATCH',
					url: `https://api.notion.com/v1/blocks/${pageId}/children`,
					body: { children: half },
					json: true,
				};
				
				const response = await executeFunctions.helpers.httpRequestWithAuthentication.call(
					executeFunctions,
					'notionApi',
					requestOptions,
				);
				
				totalBlocksAdded += response.results?.length || 0;
			} catch (error) {
				const retryResult = await MarkdownToNotion.retryWithBisection(
					executeFunctions,
					pageId,
					half,
					error.message
				);
				
				totalBlocksAdded += retryResult.blocksAdded;
				warnings.push(...retryResult.warnings);
			}
		}
		
		return {
			response: { results: new Array(totalBlocksAdded) },
			blocksAdded: totalBlocksAdded,
			warnings,
		};
	}

	private static createHeadingBlock(node: any, mathPlaceholders: { [key: string]: string }): NotionBlock {
		const level = Math.min(node.depth, 3);
		const headingType = `heading_${level}` as 'heading_1' | 'heading_2' | 'heading_3';
		
		return {
			object: 'block',
			type: headingType,
			[headingType]: {
				rich_text: MarkdownToNotion.inlineNodesToRichText(node.children || [], mathPlaceholders),
			},
		};
	}

	private static createParagraphBlock(node: any, mathPlaceholders: { [key: string]: string }): NotionBlock {
		return {
			object: 'block',
			type: 'paragraph',
			paragraph: {
				rich_text: MarkdownToNotion.inlineNodesToRichText(node.children || [], mathPlaceholders),
			},
		};
	}

	private static createCodeBlock(node: any): NotionBlock {
		const language = node.lang || 'plain text';
		const content = node.value || '';
		
		return {
			object: 'block',
			type: 'code',
			code: {
				language: MarkdownToNotion.mapLanguageToNotion(language),
				rich_text: [
					{
						type: 'text',
						text: {
							content: content,
						},
					},
				],
			},
		};
	}

	private static createQuoteBlock(node: any, mathPlaceholders: { [key: string]: string }): NotionBlock {
		return {
			object: 'block',
			type: 'quote',
			quote: {
				rich_text: MarkdownToNotion.inlineNodesToRichText(node.children || [], mathPlaceholders),
			},
		};
	}

	private static createDividerBlock(): NotionBlock {
		return {
			object: 'block',
			type: 'divider',
			divider: {},
		};
	}

	private static createBookmarkBlock(url: string): NotionBlock {
		return {
			object: 'block',
			type: 'bookmark',
			bookmark: {
				url: url,
			},
		};
	}

	private static createTableBlock(node: any): NotionBlock {
		const rows = node.children || [];
		const tableWidth = rows.length > 0 ? (rows[0].children || []).length : 1;
		const hasColumnHeader = node.align ? true : false;
		const hasRowHeader = false;

		const children: NotionBlock[] = [];

		for (const row of rows) {
			const cells = row.children || [];
			const rowChildren: NotionBlock[] = [];

			for (const cell of cells) {
				const cellContent = mdastToString(cell).trim();
				rowChildren.push({
					object: 'block',
					type: 'table_row',
					table_row: {
						cells: [[{
							type: 'text',
							text: {
								content: cellContent,
							},
						}]],
					},
				});
			}

			if (rowChildren.length > 0) {
				children.push({
					object: 'block',
					type: 'table_row',
					table_row: {
						cells: rowChildren.map(child => child.table_row.cells[0]),
					},
				});
			}
		}

		return {
			object: 'block',
			type: 'table',
			table: {
				table_width: tableWidth,
				has_column_header: hasColumnHeader,
				has_row_header: hasRowHeader,
				children: children,
			},
		};
	}

	private static createToggleBlock(htmlContent: string, mathPlaceholders: { [key: string]: string }): NotionBlock {
		const summaryMatch = htmlContent.match(/<summary>(.*?)<\/summary>/s);
		const summary = summaryMatch ? summaryMatch[1].trim() : 'Toggle';
		
		const contentMatch = htmlContent.match(/<details[^>]*>.*?<summary>.*?<\/summary>(.*?)<\/details>/s);
		const content = contentMatch ? contentMatch[1].trim() : '';
		
		const children: NotionBlock[] = [];
		if (content) {
			children.push({
				object: 'block',
				type: 'paragraph',
				paragraph: {
					rich_text: [{
						type: 'text',
						text: { content: content },
					}],
				},
			});
		}
		
		return {
			object: 'block',
			type: 'toggle',
			toggle: {
				rich_text: [{
					type: 'text',
					text: { content: summary },
				}],
				children: children,
			},
		};
	}

	private static preprocessToggleBlocks(markdown: string): string {
		return markdown.replace(
			/<details[^>]*>\s*<summary>(.*?)<\/summary>(.*?)<\/details>/gs,
			(match, summary, content) => {
				return `\n\n**${summary.trim()}**\n\n${content.trim()}\n\n`;
			}
		);
	}

	private static isDivider(content: string): boolean {
		const dividerPatterns = [
			/^-{3,}$/,
			/^\*{3,}$/,
			/^_{3,}$/,
			/^={3,}$/,
		];
		
		return dividerPatterns.some(pattern => pattern.test(content.trim()));
	}

	private static isStandaloneUrl(content: string): boolean {
		try {
			const url = new URL(content.trim());
			return url.protocol === 'http:' || url.protocol === 'https:';
		} catch {
			return false;
		}
	}

	private static mapLanguageToNotion(language: string): string {
		const languageMap: { [key: string]: string } = {
			'js': 'javascript',
			'ts': 'typescript',
			'py': 'python',
			'rb': 'ruby',
			'sh': 'bash',
			'yml': 'yaml',
			'md': 'markdown',
			'mermaid': 'plain text',
		};
		
		return languageMap[language.toLowerCase()] || language.toLowerCase();
	}

	private static parseNotionError(errorResponse: any): string {
		if (!errorResponse || typeof errorResponse !== 'object') {
			return 'Unknown error format';
		}

		const code = errorResponse.code || 'unknown_error';
		const message = errorResponse.message || 'No error message provided';

		switch (code) {
			case 'validation_error':
				return `Validation Error: ${message}`;
			case 'invalid_request_url':
				return `Invalid Request URL: ${message}`;
			case 'invalid_request':
				return `Invalid Request: ${message}`;
			case 'unauthorized':
				return `Unauthorized: ${message}. Please check your Notion API key.`;
			case 'restricted_resource':
				return `Restricted Resource: ${message}. The integration may not have access to this page.`;
			case 'object_not_found':
				return `Object Not Found: ${message}. The page may not exist or the integration doesn't have access.`;
			case 'rate_limited':
				return `Rate Limited: ${message}. Please try again later.`;
			case 'internal_server_error':
				return `Internal Server Error: ${message}. This is a Notion API issue.`;
			case 'service_unavailable':
				return `Service Unavailable: ${message}. Notion API is temporarily unavailable.`;
			default:
				return `${code}: ${message}`;
		}
	}
}