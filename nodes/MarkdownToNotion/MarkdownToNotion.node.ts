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
				(this as any).validatePageId(pageId, i, this);
				(this as any).validateMarkdownContent(markdownContent, i, this);

				const blocks = await (this as any).convertMarkdownToNotionBlocks(
					markdownContent,
					options.preserveMath ?? true,
					options.mathDelimiter ?? '$'
				);

				const requestOptions: IRequestOptions = {
					method: 'PATCH',
					url: `https://api.notion.com/v1/blocks/${pageId}/children`,
					body: {
						children: blocks,
					},
					json: true,
				};

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'notionApi',
					requestOptions,
				);

				(this as any).validateNotionApiResponse(response, i, this);

				returnData.push({
					json: {
						success: true,
						pageId,
						blocksAdded: response.results?.length || 0,
						blocks: response.results,
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

	private async convertMarkdownToNotionBlocks(
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
				const placeholder = `__MATH_PLACEHOLDER_${mathCounter}__`;
				mathPlaceholders[placeholder] = match;
				mathCounter++;
				return placeholder;
			});
		}

		// Pre-process toggle blocks (details/summary)
		processedMarkdown = this.preprocessToggleBlocks(processedMarkdown);

		const processor = unified()
			.use(remarkParse)
			.use(remarkGfm);

		const tree = processor.parse(processedMarkdown);
		const blocks: NotionBlock[] = [];

		visit(tree, (node: any) => {
			switch (node.type) {
				case 'heading':
					blocks.push(this.createHeadingBlock(node, mathPlaceholders));
					break;
				case 'paragraph': {
					const content = mdastToString(node).trim();
					
					if (this.isDivider(content)) {
						blocks.push(this.createDividerBlock());
						break;
					}
					
					if (this.isStandaloneUrl(content)) {
						blocks.push(this.createBookmarkBlock(content));
						break;
					}
					
					if (this.isBlockEquation(content)) {
						blocks.push(this.createEquationBlock(content));
						break;
					}
					
					if (this.isCallout(content)) {
						blocks.push(this.createCalloutBlock(node, mathPlaceholders));
						break;
					}

					if (this.isToggleBlock(content)) {
						blocks.push(this.createToggleBlock(content, mathPlaceholders));
						break;
					}
					
					const paragraphBlock = this.createParagraphBlock(node, mathPlaceholders);
					if (paragraphBlock) {
						blocks.push(paragraphBlock);
					}
					break;
				}
				case 'list':
					blocks.push(...this.createListBlocks(node, mathPlaceholders));
					break;
				case 'code':
					blocks.push(this.createCodeBlock(node));
					break;
				case 'blockquote': {
					const quoteContent = mdastToString(node).trim();
					if (this.isCallout(quoteContent)) {
						blocks.push(this.createCalloutBlock(node, mathPlaceholders));
					} else {
						blocks.push(this.createQuoteBlock(node, mathPlaceholders));
					}
					break;
				}
				case 'image':
					blocks.push(this.createImageBlock(node));
					break;
				case 'table':
					blocks.push(...this.createTableBlocks(node, mathPlaceholders));
					break;
				case 'thematicBreak':
					blocks.push(this.createDividerBlock());
					break;
			}
		});

		return blocks;
	}

	private createHeadingBlock(node: any, mathPlaceholders: { [key: string]: string }): NotionBlock {
		const level = Math.min(node.depth, 3);
		const headingType = `heading_${level}`;
		
		return {
			object: 'block',
			type: headingType,
			[headingType]: {
				rich_text: this.convertToRichText(node, mathPlaceholders),
			},
		};
	}

	private createParagraphBlock(node: any, mathPlaceholders: { [key: string]: string }): NotionBlock | null {
		const richText = this.convertToRichText(node, mathPlaceholders);
		
		if (richText.length === 0 || (richText.length === 1 && richText[0].text.content.trim() === '')) {
			return null;
		}

		return {
			object: 'block',
			type: 'paragraph',
			paragraph: {
				rich_text: richText,
			},
		};
	}

	private createListBlocks(node: any, mathPlaceholders: { [key: string]: string }): NotionBlock[] {
		const blocks: NotionBlock[] = [];

		for (const listItem of node.children) {
			if (listItem.type === 'listItem') {
				const content = mdastToString(listItem).trim();
				
				if (this.isTodoItem(content)) {
					blocks.push(this.createTodoBlock(listItem, mathPlaceholders));
				} else {
					const listType = node.ordered ? 'numbered_list_item' : 'bulleted_list_item';
					blocks.push({
						object: 'block',
						type: listType,
						[listType]: {
							rich_text: this.convertToRichText(listItem, mathPlaceholders),
						},
					});
				}
			}
		}

		return blocks;
	}

	private createCodeBlock(node: any): NotionBlock {
		return {
			object: 'block',
			type: 'code',
			code: {
				rich_text: [
					{
						type: 'text',
						text: {
							content: node.value || '',
						},
					},
				],
				language: node.lang || 'plain text',
			},
		};
	}

	private createQuoteBlock(node: any, mathPlaceholders: { [key: string]: string }): NotionBlock {
		return {
			object: 'block',
			type: 'quote',
			quote: {
				rich_text: this.convertToRichText(node, mathPlaceholders),
			},
		};
	}

	private convertToRichText(node: any, mathPlaceholders: { [key: string]: string }): RichTextObject[] {
		const richText: RichTextObject[] = [];
		
		let textContent = mdastToString(node);
		
		for (const [placeholder, originalMath] of Object.entries(mathPlaceholders)) {
			textContent = textContent.replace(placeholder, originalMath);
		}

		if (textContent.trim()) {
			this.processInlineFormatting(node, richText, mathPlaceholders);
		}

		if (richText.length === 0 && textContent.trim()) {
			richText.push({
				type: 'text',
				text: {
					content: textContent,
				},
			});
		}

		return richText;
	}

	private processInlineFormatting(node: any, richText: RichTextObject[], mathPlaceholders: { [key: string]: string }): void {
		if (node.type === 'text') {
			let content = node.value;
			
			for (const [placeholder, originalMath] of Object.entries(mathPlaceholders)) {
				content = content.replace(placeholder, originalMath);
			}

			if (content) {
				richText.push({
					type: 'text',
					text: {
						content,
					},
				});
			}
		} else if (node.type === 'strong') {
			const textContent = mdastToString(node);
			if (textContent) {
				richText.push({
					type: 'text',
					text: {
						content: textContent,
					},
					annotations: {
						bold: true,
					},
				});
			}
		} else if (node.type === 'emphasis') {
			const textContent = mdastToString(node);
			if (textContent) {
				richText.push({
					type: 'text',
					text: {
						content: textContent,
					},
					annotations: {
						italic: true,
					},
				});
			}
		} else if (node.type === 'inlineCode') {
			richText.push({
				type: 'text',
				text: {
					content: node.value,
				},
				annotations: {
					code: true,
				},
			});
		} else if (node.type === 'link') {
			const textContent = mdastToString(node);
			if (textContent) {
				richText.push({
					type: 'text',
					text: {
						content: textContent,
						link: { url: node.url },
					},
				});
			}
		} else if (node.children) {
			for (const child of node.children) {
				this.processInlineFormatting(child, richText, mathPlaceholders);
			}
		}
	}

	private isTodoItem(content: string): boolean {
		return /^- \[([ x])\]/.test(content);
	}

	private createTodoBlock(node: any, mathPlaceholders: { [key: string]: string }): NotionBlock {
		const content = mdastToString(node).trim();
		const isChecked = /^- \[x\]/.test(content);
		const textContent = content.replace(/^- \[([ x])\]\s*/, '');
		
		return {
			object: 'block',
			type: 'to_do',
			to_do: {
				rich_text: [{
					type: 'text',
					text: {
						content: this.restoreMathPlaceholders(textContent, mathPlaceholders),
					},
				}],
				checked: isChecked,
			},
		};
	}

	private isDivider(content: string): boolean {
		return /^(-{3,}|\*{3,})$/.test(content);
	}

	private createDividerBlock(): NotionBlock {
		return {
			object: 'block',
			type: 'divider',
			divider: {},
		};
	}

	private isStandaloneUrl(content: string): boolean {
		const urlRegex = /^https?:\/\/[^\s]+$/;
		return urlRegex.test(content);
	}

	private createBookmarkBlock(url: string): NotionBlock {
		return {
			object: 'block',
			type: 'bookmark',
			bookmark: {
				url: url,
				caption: [],
			},
		};
	}

	private isBlockEquation(content: string): boolean {
		return /^\$\$[\s\S]*\$\$$/.test(content.trim());
	}

	private createEquationBlock(content: string): NotionBlock {
		const equation = content.replace(/^\$\$\s*|\s*\$\$$/g, '');
		return {
			object: 'block',
			type: 'equation',
			equation: {
				expression: equation,
			},
		};
	}

	private isCallout(content: string): boolean {
		return /^>\s*\[!(note|warning|info|tip|important|caution)\]/i.test(content);
	}

	private createCalloutBlock(node: any, mathPlaceholders: { [key: string]: string }): NotionBlock {
		const content = mdastToString(node).trim();
		const match = content.match(/^>\s*\[!(note|warning|info|tip|important|caution)\]\s*(.*)/is);
		
		if (match) {
			const calloutType = match[1].toLowerCase();
			const calloutContent = match[2] || '';
			
			const iconMap: { [key: string]: string } = {
				note: '📝',
				warning: '⚠️',
				info: 'ℹ️',
				tip: '💡',
				important: '❗',
				caution: '⚠️',
			};

			return {
				object: 'block',
				type: 'callout',
				callout: {
					rich_text: [{
						type: 'text',
						text: {
							content: this.restoreMathPlaceholders(calloutContent, mathPlaceholders),
						},
					}],
					icon: {
						type: 'emoji',
						emoji: iconMap[calloutType] || '📝',
					},
					color: 'default',
				},
			};
		}

		return this.createQuoteBlock(node, mathPlaceholders);
	}

	private createImageBlock(node: any): NotionBlock {
		return {
			object: 'block',
			type: 'image',
			image: {
				type: 'external',
				external: {
					url: node.url,
				},
				caption: node.alt ? [{
					type: 'text',
					text: {
						content: node.alt,
					},
				}] : [],
			},
		};
	}

	private createTableBlocks(node: any, mathPlaceholders: { [key: string]: string }): NotionBlock[] {
		const blocks: NotionBlock[] = [];
		
		if (!node.children || node.children.length === 0) {
			return blocks;
		}

		const tableRows = node.children.filter((child: any) => child.type === 'tableRow');
		
		for (let i = 0; i < tableRows.length; i++) {
			const row = tableRows[i];
			const isHeader = i === 0;
			
			const cells = row.children.map((cell: any) => ({
				rich_text: [{
					type: 'text',
					text: {
						content: this.restoreMathPlaceholders(mdastToString(cell), mathPlaceholders),
					},
					annotations: isHeader ? { bold: true } : {},
				}],
			}));

			blocks.push({
				object: 'block',
				type: 'table_row',
				table_row: {
					cells: cells,
				},
			});
		}

		if (blocks.length > 0) {
			const tableBlock: NotionBlock = {
				object: 'block',
				type: 'table',
				table: {
					table_width: tableRows[0]?.children?.length || 1,
					has_column_header: true,
					has_row_header: false,
					children: blocks,
				},
			};
			
			return [tableBlock];
		}

		return blocks;
	}

	private restoreMathPlaceholders(text: string, mathPlaceholders: { [key: string]: string }): string {
		let result = text;
		for (const [placeholder, originalMath] of Object.entries(mathPlaceholders)) {
			result = result.replace(placeholder, originalMath);
		}
		return result;
	}

	private preprocessToggleBlocks(markdown: string): string {
		const detailsRegex = /<details>\s*<summary>(.*?)<\/summary>\s*([\s\S]*?)<\/details>/gi;
		
		return markdown.replace(detailsRegex, (match, summary, content) => {
			const cleanSummary = summary.trim();
			const cleanContent = content.trim();
			
			return `__TOGGLE_START__${cleanSummary}__TOGGLE_CONTENT__${cleanContent}__TOGGLE_END__`;
		});
	}

	private isToggleBlock(content: string): boolean {
		return content.includes('__TOGGLE_START__') && content.includes('__TOGGLE_END__');
	}

	private createToggleBlock(content: string, mathPlaceholders: { [key: string]: string }): NotionBlock {
		const match = content.match(/__TOGGLE_START__(.*?)__TOGGLE_CONTENT__(.*?)__TOGGLE_END__/s);
		
		if (!match) {
			return this.createParagraphBlock({ children: [{ type: 'text', value: content }] }, mathPlaceholders) || {
				object: 'block',
				type: 'paragraph',
				paragraph: { rich_text: [] }
			};
		}

		const [, summary, toggleContent] = match;
		const cleanSummary = this.restoreMathPlaceholders(summary.trim(), mathPlaceholders);
		const cleanContent = this.restoreMathPlaceholders(toggleContent.trim(), mathPlaceholders);

		const children: NotionBlock[] = [];
		
		if (cleanContent) {
			const contentLines = cleanContent.split('\n').filter(line => line.trim());
			
			for (const line of contentLines) {
				const trimmedLine = line.trim();
				if (trimmedLine) {
					if (trimmedLine.startsWith('#')) {
						const level = Math.min((trimmedLine.match(/^#+/) || [''])[0].length, 3);
						const headingType = `heading_${level}`;
						const headingText = trimmedLine.replace(/^#+\s*/, '');
						
						children.push({
							object: 'block',
							type: headingType,
							[headingType]: {
								rich_text: [{
									type: 'text',
									text: { content: headingText }
								}]
							}
						});
					} else if (trimmedLine.startsWith('- ')) {
						children.push({
							object: 'block',
							type: 'bulleted_list_item',
							bulleted_list_item: {
								rich_text: [{
									type: 'text',
									text: { content: trimmedLine.substring(2) }
								}]
							}
						});
					} else {
						children.push({
							object: 'block',
							type: 'paragraph',
							paragraph: {
								rich_text: [{
									type: 'text',
									text: { content: trimmedLine }
								}]
							}
						});
					}
				}
			}
		}

		return {
			object: 'block',
			type: 'toggle',
			toggle: {
				rich_text: [{
					type: 'text',
					text: {
						content: cleanSummary || 'Toggle'
					}
				}],
				color: 'default',
				children: children
			}
		};
	}

	private validatePageId(pageId: string, itemIndex: number, context: IExecuteFunctions): void {
		if (!pageId || !pageId.trim()) {
			throw new NodeOperationError(
				context.getNode(),
				'Page ID is required and cannot be empty.',
				{ itemIndex }
			);
		}

		const cleanPageId = pageId.replace(/-/g, '');
		if (!/^[a-f0-9]{32}$/i.test(cleanPageId)) {
			throw new NodeOperationError(
				context.getNode(),
				'Invalid Page ID format. Expected a UUID (32 or 36 characters). You can find the Page ID in the Notion page URL.',
				{ itemIndex }
			);
		}
	}

	private validateMarkdownContent(markdownContent: string, itemIndex: number, context: IExecuteFunctions): void {
		if (!markdownContent || !markdownContent.trim()) {
			throw new NodeOperationError(
				context.getNode(),
				'Markdown content is required and cannot be empty.',
				{ itemIndex }
			);
		}
	}

	private validateNotionApiResponse(response: any, itemIndex: number, context: IExecuteFunctions): void {
		if (!response || typeof response !== 'object') {
			throw new NodeOperationError(
				context.getNode(),
				`Unexpected Notion API response: ${JSON.stringify(response)}`,
				{ itemIndex }
			);
		}

		if (response.object === 'error') {
			throw new NodeOperationError(
				context.getNode(),
				`Notion API error: ${response.message || 'Unknown error'}`,
				{ itemIndex }
			);
		}
	}
}