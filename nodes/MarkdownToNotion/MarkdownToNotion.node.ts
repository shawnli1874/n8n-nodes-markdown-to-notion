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

interface ToggleHeadingNode {
	heading: NotionBlock;
	children: NotionBlock[];
	subHeadings: ToggleHeadingNode[];
	level: number;
	blockId?: string;
}

interface ToggleHeadingStructure {
	rootNodes: ToggleHeadingNode[];
	orphanBlocks: NotionBlock[];
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
						description: 'Whether to preserve inline math formulas as equation blocks in Notion',
					},
					{
						displayName: 'Math Formula Delimiter',
						name: 'mathDelimiter',
						type: 'string',
						default: '$',
						description: 'The delimiter used for inline math formulas (default: $). Also supports LaTeX \\(...\\) syntax automatically.',
						displayOptions: {
							show: {
								preserveMath: [true],
							},
						},
					},
					{
						displayName: 'Support LaTeX Inline Formulas',
						name: 'supportLatex',
						type: 'boolean',
						default: true,
						description: 'Whether to support LaTeX-style inline formulas \\(...\\) in addition to dollar delimiters',
						displayOptions: {
							show: {
								preserveMath: [true],
							},
						},
					},
					{
						displayName: 'Toggle Headings',
						name: 'toggleHeadings',
						type: 'boolean',
						default: false,
						description: 'Convert all headings to collapsible toggle blocks instead of regular headings. This allows users to expand/collapse sections in Notion.',
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
					supportLatex?: boolean;
					toggleHeadings?: boolean;
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

			if (options.toggleHeadings) {
				const result = await MarkdownToNotion.processToggleHeadingsWithAPI(
					this,
					pageId,
					markdownContent,
					options,
					i
				);
				returnData.push(result);
				continue;
			}

			const result = await MarkdownToNotion.convertMarkdownToNotionBlocks(
				markdownContent,
				options.preserveMath ?? true,
				options.mathDelimiter ?? '$',
				options.supportLatex ?? true,
				false
			);
			const blocks = result as NotionBlock[];

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
		mathDelimiter: string = '$',
		supportLatex: boolean = true,
		toggleHeadings: boolean = false
	): Promise<NotionBlock[] | ToggleHeadingStructure> {
		let processedMarkdown = markdown;
		const mathPlaceholders: { [key: string]: string } = {};
		
		if (preserveMath) {
			let mathCounter = 0;
			
			// Process LaTeX-style inline formulas \(...\) first
			if (supportLatex) {
				const latexMatches: Array<{match: string, formula: string, start: number, end: number}> = [];
				
				const latexRegex = /\\\(/g;
				let match: RegExpExecArray | null;
				
				while (true) {
					match = latexRegex.exec(processedMarkdown);
					if (!match) break;
					
					const startPos = match.index;
					let pos = startPos + 2;
					let depth = 1;
					let formula = '';
					
					while (pos < processedMarkdown.length && depth > 0) {
						const char = processedMarkdown[pos];
						const nextChar = processedMarkdown[pos + 1];
						
						if (char === '\\' && nextChar === ')') {
							depth--;
							if (depth === 0) {
								break;
							}
							formula += char + nextChar;
							pos += 2;
						} else {
							formula += char;
							pos++;
						}
					}
					
					if (depth === 0 && formula.trim().length > 0 && formula.trim().length <= 100) {
						const fullMatch = processedMarkdown.substring(startPos, pos + 2);
						latexMatches.push({
							match: fullMatch,
							formula: formula.trim(),
							start: startPos,
							end: pos + 2
						});
					}
				}
				
				latexMatches.reverse().forEach(({ match, formula }) => {
					const placeholder = `MATHPLACEHOLDER${mathCounter}MATHPLACEHOLDER`;
					mathPlaceholders[placeholder] = `$${formula}$`;
					mathCounter++;
					processedMarkdown = processedMarkdown.replace(match, placeholder);
				});
			}
			
			// Process dollar-delimited formulas with improved detection
			if (mathDelimiter === '$') {
				let lastIndex = 0;
				const parts: string[] = [];
				const regex = /\$([^$\n\r]+?)\$/g;
				let match: RegExpExecArray | null;
				
				while ((match = regex.exec(processedMarkdown))) {
					const fullMatch = match[0];
					const formula = match[1];
					const trimmedFormula = formula.trim();
					
					parts.push(processedMarkdown.substring(lastIndex, match.index));
					
					if (trimmedFormula.length === 0 || trimmedFormula.length > 100) {
						parts.push(fullMatch);
					} else if (MarkdownToNotion.isLikelyPrice(trimmedFormula)) {
						parts.push(fullMatch);
					} else if (MarkdownToNotion.isLikelyMathFormula(trimmedFormula)) {
						const placeholder = `MATHPLACEHOLDER${mathCounter}MATHPLACEHOLDER`;
						mathPlaceholders[placeholder] = fullMatch;
						mathCounter++;
						parts.push(placeholder);
					} else {
						parts.push(fullMatch);
					}
					
					lastIndex = regex.lastIndex;
				}
				
				parts.push(processedMarkdown.substring(lastIndex));
				processedMarkdown = parts.join('');
			} else {
				// Use custom delimiter with original logic
				const mathRegex = new RegExp(`\\${mathDelimiter}([^${mathDelimiter}\\n\\r]+?)\\${mathDelimiter}`, 'g');
				processedMarkdown = markdown.replace(mathRegex, (match, formula) => {
					const trimmedFormula = formula.trim();
					
					if (trimmedFormula.length > 100) {
						return match;
					}
					
					if (MarkdownToNotion.isLikelyMathFormula(trimmedFormula)) {
						const placeholder = `MATHPLACEHOLDER${mathCounter}MATHPLACEHOLDER`;
						mathPlaceholders[placeholder] = match;
						mathCounter++;
						return placeholder;
					}
					
					return match;
				});
			}
		}

		processedMarkdown = MarkdownToNotion.sanitizeFencedCodeBlocks(processedMarkdown);
		processedMarkdown = MarkdownToNotion.preprocessToggleBlocks(processedMarkdown);

		const processor = unified()
			.use(remarkParse)
			.use(remarkGfm);

		const tree = processor.parse(processedMarkdown);
		const blocks: NotionBlock[] = [];

		if (toggleHeadings) {
			return MarkdownToNotion.buildToggleHeadingStructure(tree.children, mathPlaceholders);
		} else {
			// Normal processing
			for (const node of tree.children) {
				const nodeBlocks = MarkdownToNotion.nodeToBlocks(node as any, mathPlaceholders, toggleHeadings);
				blocks.push(...nodeBlocks);
			}
		}

		return blocks;
	}

	private static processToggleHeadings(nodes: any[], mathPlaceholders: { [key: string]: string }): NotionBlock[] {
		const blocks: NotionBlock[] = [];

		for (const node of nodes) {
			const nodeBlocks = MarkdownToNotion.nodeToBlocks(node as any, mathPlaceholders, true);
			blocks.push(...nodeBlocks);
		}

		return blocks;
	}

	private static buildToggleHeadingStructure(nodes: any[], mathPlaceholders: { [key: string]: string }): ToggleHeadingStructure {
		const structure: ToggleHeadingStructure = {
			rootNodes: [],
			orphanBlocks: []
		};

		let currentIndex = 0;
		const nodeStack: ToggleHeadingNode[] = [];

		while (currentIndex < nodes.length) {
			const node = nodes[currentIndex];

			if (node.type === 'heading') {
				const headingLevel = node.depth;
				const headingBlock = MarkdownToNotion.createHeadingBlock(node, mathPlaceholders, true);
				
				const headingNode: ToggleHeadingNode = {
					heading: headingBlock,
					children: [],
					subHeadings: [],
					level: headingLevel
				};

				// Pop stack until we find the correct parent level
				while (nodeStack.length > 0 && nodeStack[nodeStack.length - 1].level >= headingLevel) {
					nodeStack.pop();
				}

				// Add to parent or root
				if (nodeStack.length === 0) {
					structure.rootNodes.push(headingNode);
				} else {
					nodeStack[nodeStack.length - 1].subHeadings.push(headingNode);
				}

				nodeStack.push(headingNode);
				currentIndex++;

				// Collect content until next heading
				while (currentIndex < nodes.length) {
					const nextNode = nodes[currentIndex];
					
					if (nextNode.type === 'heading') {
						break;
					}

					const contentBlocks = MarkdownToNotion.nodeToBlocks(nextNode, mathPlaceholders, false);
					headingNode.children.push(...contentBlocks);
					currentIndex++;
				}
			} else {
				// Orphan content (no heading)
				const orphanBlocks = MarkdownToNotion.nodeToBlocks(node, mathPlaceholders, false);
				structure.orphanBlocks.push(...orphanBlocks);
				currentIndex++;
			}
		}

		return structure;
	}

	private static nodeToBlocks(node: any, mathPlaceholders: { [key: string]: string }, toggleHeadings: boolean = false): NotionBlock[] {
		switch (node.type) {
			case 'heading':
				return [MarkdownToNotion.createHeadingBlock(node, mathPlaceholders, toggleHeadings)];
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
				return MarkdownToNotion.createListBlocks(node, mathPlaceholders, toggleHeadings);
			case 'code':
				return [MarkdownToNotion.createCodeBlock(node)];
			case 'blockquote':
				return [MarkdownToNotion.createQuoteBlock(node, mathPlaceholders)];
			case 'table':
				return [MarkdownToNotion.createTableBlock(node, mathPlaceholders)];
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

	private static createListBlocks(listNode: any, mathPlaceholders: { [key: string]: string }, toggleHeadings: boolean = false): NotionBlock[] {
		const blocks: NotionBlock[] = [];
		const isOrdered = listNode.ordered;
		
		for (const listItem of listNode.children) {
			if (listItem.type === 'listItem') {
				const block = MarkdownToNotion.createListItemBlock(listItem, isOrdered, mathPlaceholders, toggleHeadings);
				blocks.push(block);
			}
		}
		
		return blocks;
	}

	private static createListItemBlock(listItem: any, isOrdered: boolean, mathPlaceholders: { [key: string]: string }, toggleHeadings: boolean = false): NotionBlock {
		const blockType = isOrdered ? 'numbered_list_item' : 'bulleted_list_item';
		
		let richText: RichTextObject[] = [];
		const children: NotionBlock[] = [];
		
		if (listItem.children && listItem.children.length > 0) {
			const firstChild = listItem.children[0];
			
			if (firstChild.type === 'paragraph') {
				richText = MarkdownToNotion.inlineNodesToRichText(firstChild.children || [], mathPlaceholders);
				
				for (let i = 1; i < listItem.children.length; i++) {
					const childBlocks = MarkdownToNotion.nodeToBlocks(listItem.children[i], mathPlaceholders, toggleHeadings);
					children.push(...childBlocks);
				}
			} else {
				richText = [{ type: 'text', text: { content: '' } }];
				
				for (const child of listItem.children) {
					const childBlocks = MarkdownToNotion.nodeToBlocks(child, mathPlaceholders, toggleHeadings);
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
					const textParts: Array<{type: 'text' | 'equation', content: string}> = [{type: 'text', content}];
					
					for (const [placeholder, mathFormula] of Object.entries(mathPlaceholders)) {
						const formulaContent = mathFormula.replace(/^\$|\$$/g, '');
						
						for (let i = 0; i < textParts.length; i++) {
							const part = textParts[i];
							if (part.type === 'text' && part.content.includes(placeholder)) {
								const splitParts = part.content.split(placeholder);
								const newParts: Array<{type: 'text' | 'equation', content: string}> = [];
								
								for (let j = 0; j < splitParts.length; j++) {
									if (splitParts[j]) {
										newParts.push({type: 'text', content: splitParts[j]});
									}
									if (j < splitParts.length - 1) {
										newParts.push({type: 'equation', content: formulaContent});
									}
								}
								
								textParts.splice(i, 1, ...newParts);
								i += newParts.length - 1;
							}
						}
					}
					
					for (const part of textParts) {
						if (part.content) {
							if (part.type === 'text') {
								richText.push({
									type: 'text',
									text: { content: part.content },
								});
							} else {
								richText.push({
									type: 'equation',
									equation: { expression: part.content },
								} as any);
							}
						}
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

	private static createHeadingBlock(node: any, mathPlaceholders: { [key: string]: string }, toggleHeadings: boolean = false): NotionBlock {
		const level = node.depth;
		
		// H5/H6 always convert to bold paragraphs (Notion limitation)
		if (level > 4) {
			const richText = MarkdownToNotion.inlineNodesToRichText(node.children || [], mathPlaceholders);
			
			richText.forEach(rt => {
				if (rt.annotations) {
					rt.annotations.bold = true;
				} else {
					rt.annotations = { bold: true };
				}
			});
			
			return {
				object: 'block',
				type: 'paragraph',
				paragraph: {
					rich_text: richText,
				},
			};
		}
		
		const richText = MarkdownToNotion.inlineNodesToRichText(node.children || [], mathPlaceholders);
		
		const headingType = `heading_${level}` as 'heading_1' | 'heading_2' | 'heading_3' | 'heading_4';
		
		if (toggleHeadings) {
			return {
				object: 'block',
				type: headingType,
				[headingType]: {
					rich_text: richText,
					color: 'default',
					is_toggleable: true,
				},
			};
		}
		
		return {
			object: 'block',
			type: headingType,
			[headingType]: {
				rich_text: richText,
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
		let richText: RichTextObject[] = [];
		
		// 引用块的子节点通常是段落，需要提取段落的内联内容
		for (const child of node.children || []) {
			if (child.type === 'paragraph') {
				const childRichText = MarkdownToNotion.inlineNodesToRichText(child.children || [], mathPlaceholders);
				richText.push(...childRichText);
				
				// 如果不是最后一个段落，添加换行
				if (node.children.indexOf(child) < node.children.length - 1) {
					richText.push({
						type: 'text',
						text: { content: '\n' },
					});
				}
			} else {
				// 对于非段落子节点，直接处理
				const childRichText = MarkdownToNotion.inlineNodesToRichText([child], mathPlaceholders);
				richText.push(...childRichText);
			}
		}
		
		return {
			object: 'block',
			type: 'quote',
			quote: {
				rich_text: richText,
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

	private static createTableBlock(node: any, mathPlaceholders: { [key: string]: string } = {}): NotionBlock {
		const rows = node.children || [];
		const tableWidth = rows.length > 0 ? (rows[0].children || []).length : 1;
		const hasColumnHeader = node.align ? true : false;
		const hasRowHeader = false;

		const children: NotionBlock[] = [];

		for (const row of rows) {
			const cells = row.children || [];
			const rowCells: RichTextObject[][] = [];

			for (const cell of cells) {
				const cellRichText = MarkdownToNotion.inlineNodesToRichText(cell.children || [], mathPlaceholders);
				
				if (cellRichText.length === 0) {
					cellRichText.push({
						type: 'text',
						text: { content: '' },
					});
				}
				
				rowCells.push(cellRichText);
			}

			if (rowCells.length > 0) {
				children.push({
					object: 'block',
					type: 'table_row',
					table_row: {
						cells: rowCells,
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
			// 常见语言缩写映射
			'js': 'javascript',
			'ts': 'typescript',
			'py': 'python',
			'rb': 'ruby',
			'sh': 'bash',
			'yml': 'yaml',
			'md': 'markdown',
			'cpp': 'c++',
			'cs': 'c#',
			'kt': 'kotlin',
			'rs': 'rust',
			'go': 'go',
			'php': 'php',
			'java': 'java',
			'swift': 'swift',
			'scala': 'scala',
			'r': 'r',
			'sql': 'sql',
			'html': 'html',
			'css': 'css',
			'scss': 'scss',
			'sass': 'sass',
			'less': 'less',
			'json': 'json',
			'xml': 'xml',
			'dockerfile': 'docker',
			'makefile': 'makefile',
			'cmake': 'cmake',
			'powershell': 'powershell',
			'ps1': 'powershell',
			'bat': 'batch',
			'cmd': 'batch',
			'vim': 'vim script',
			'lua': 'lua',
			'perl': 'perl',
			'haskell': 'haskell',
			'clojure': 'clojure',
			'erlang': 'erlang',
			'elixir': 'elixir',
			'dart': 'dart',
			'groovy': 'groovy',
			'matlab': 'matlab',
			'octave': 'octave',
			'latex': 'latex',
			'tex': 'latex',
			'diff': 'diff',
			'patch': 'diff',
			'ini': 'ini',
			'toml': 'toml',
			'properties': 'properties',
			'conf': 'apache',
			'nginx': 'nginx',
			'apache': 'apache',
			'htaccess': 'apache',
			'gitignore': 'gitignore',
			'gitconfig': 'git config',
			'docker-compose': 'docker',
			'k8s': 'kubernetes',
			'kubernetes': 'kubernetes',
			'terraform': 'hcl',
			'tf': 'hcl',
			'hcl': 'hcl',
			'graphql': 'graphql',
			'gql': 'graphql',
			'proto': 'protocol buffer',
			'protobuf': 'protocol buffer',
			'thrift': 'thrift',
			'avro': 'avro',
			'assembly': 'assembly',
			'asm': 'assembly',
			'nasm': 'assembly',
			'masm': 'assembly',
			'fortran': 'fortran',
			'cobol': 'cobol',
			'pascal': 'pascal',
			'ada': 'ada',
			'vhdl': 'vhdl',
			'verilog': 'verilog',
			'systemverilog': 'systemverilog',
			'tcl': 'tcl',
			'awk': 'awk',
			'sed': 'sed',
			'regex': 'regex',
			'regexp': 'regex',
			'abnf': 'abnf',
			'ebnf': 'ebnf',
			'bnf': 'bnf',
			'antlr': 'antlr',
			'yacc': 'yacc',
			'lex': 'lex',
			'flex': 'flex',
			'bison': 'bison',
			// 图表和特殊格式
			'mermaid': 'mermaid',
			'plantuml': 'plantuml',
			'dot': 'graphviz',
			'graphviz': 'graphviz',
			'ditaa': 'ditaa',
			'flowchart': 'mermaid',
			'sequence': 'mermaid',
			'gantt': 'mermaid',
			'mindmap': 'mermaid',
			'timeline': 'mermaid',
			// 数据格式
			'csv': 'csv',
			'tsv': 'csv',
			'log': 'log',
			'logs': 'log',
			'syslog': 'log',
			'access': 'log',
			'error': 'log',
			// 配置文件
			'env': 'bash',
			'dotenv': 'bash',
			'editorconfig': 'editorconfig',
			'eslintrc': 'json',
			'prettierrc': 'json',
			'babelrc': 'json',
			'tsconfig': 'json',
			'package': 'json',
			'composer': 'json',
			'cargo': 'toml',
			'poetry': 'toml',
			'pipfile': 'toml',
			'requirements': 'text',
			'gemfile': 'ruby',
			'podfile': 'ruby',
			'rakefile': 'ruby',
			'vagrantfile': 'ruby',
			'berksfile': 'ruby',
			'capfile': 'ruby',
			'guardfile': 'ruby',
			'procfile': 'text',
			'cmakelists': 'cmake',
			'sconscript': 'python',
			'sconstruct': 'python',
			'wscript': 'python',
			'setup': 'python',
			'buildfile': 'text',
			'build': 'text',
			'ant': 'xml',
			'maven': 'xml',
			'gradle': 'groovy',
			'sbt': 'scala',
			'mix': 'elixir',
			'rebar': 'erlang',
			'dune': 'ocaml',
			'opam': 'opam',
			'cabal': 'cabal',
			'stack': 'yaml',
			'pubspec': 'yaml',
			'podspec': 'ruby',
			'cartfile': 'text',
			'brewfile': 'ruby',
			'fastfile': 'ruby',
			'appfile': 'ruby',
			'deliverfile': 'ruby',
			'gymfile': 'ruby',
			'matchfile': 'ruby',
			'scanfile': 'ruby',
			'snapshotfile': 'ruby',
			'pluginfile': 'ruby',
		};
		
		const normalizedLanguage = language.toLowerCase().trim();
		return languageMap[normalizedLanguage] || normalizedLanguage;
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

	private static isLikelyPrice(content: string): boolean {
		const hasMathSymbols = /[_{}^\\]/.test(content) || /\b(sum|int|lim|frac|sqrt|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|phi|psi|omega)\b/i.test(content);
		if (hasMathSymbols) {
			return false;
		}
		
		const pricePatterns = [
			/^\d+(\.\d{1,2})?$/,
			/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/,
			/^\d+(\.\d+)?\s*(USD|EUR|GBP|JPY|CNY|CAD|AUD)$/i,
			/^(USD|EUR|GBP|JPY|CNY|CAD|AUD)\s*\d+(\.\d+)?$/i,
			/^\d+(\.\d+)?\s*(dollars?|cents?|yuan|euros?|pounds?|yen)$/i,
			/^(dollars?|cents?|yuan|euros?|pounds?|yen)\s*\d+(\.\d+)?$/i,
			/^\d+k$/i,
			/^\d+(\.\d+)?[km]$/i,
			/^\d+\s*[，,]\s*那个/,
			/^\d+\s*[，,]\s*总共/,
			/^\d+\s*[，,]\s*这个/,
			/^\d+\s*和\s*/,
			/^\d+\s*[，,、]\s*\d+/,
			/^\d+\s*[元美金刀块毛分]/
		];
		
		const contextWords = ['price', 'cost', 'value', 'amount', 'total', 'fee', 'charge', 'bill', 'payment', '价格', '费用', '花费', '成本', '金额', '总共', '一共', '共计', '元', '美金', '刀', '块', '毛', '分', '美元', '人民币', '买', '卖', '购买', '支付', '付款', '收费', '便宜', '贵', '昂贵', '优惠', '折扣'];
		const hasContextWord = contextWords.some(word => 
			content.includes(word)
		);
		
		return pricePatterns.some(pattern => pattern.test(content.trim())) || hasContextWord;
	}

	private static isLikelyMathFormula(content: string): boolean {
		const currencyPatterns = [
			/^\d+$/,
			/^\d+[.,]\d+$/,
			/^\d+\s*[元美金刀块毛分]$/,
			/^\d+\s*[,，]\s*那个/,
			/^\d+\s*[,，]\s*总共/,
			/^\d+\s*[,，]\s*这个/,
			/^\d+\s*和\s*/,
			/^\d+\s*[,，、]\s*\d+/,
			/价格|费用|花费|成本|金额|总共|一共|共计|元|美金|刀|块|毛|分|美元|人民币|买|卖|购买|支付|付款|收费|便宜|贵|昂贵|优惠|折扣/
		];
		
		if (currencyPatterns.some(pattern => pattern.test(content))) {
			return false;
		}
		
		const strongMathIndicators = [
			/\\[a-zA-Z]+/,
			/[∑∫∏∆∇∂∞±≤≥≠≈∈∉⊂⊃∪∩]/,
			/\\(begin|end|left|right|frac|sqrt)/,
			/\b(sum|int|lim|frac|sqrt|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|phi|psi|omega|sin|cos|tan|log|ln|exp)\b/i,
			/[a-zA-Z]_\{[^}]+\}/,
			/[a-zA-Z]\^\{[^}]+\}/
		];
		
		if (strongMathIndicators.some(pattern => pattern.test(content))) {
			return true;
		}
		
		const mathIndicators = [
			/[_{}\\^]/,
			/[a-zA-Z]\s*[=<>]\s*[a-zA-Z]/,
			/\b[a-zA-Z]+\([a-zA-Z,\s]+\)/,
			/[a-zA-Z]\s*[+\-*/]\s*[a-zA-Z]/,
			/[a-zA-Z]\^[0-9]/
		];
		
		const mathCount = mathIndicators.filter(pattern => pattern.test(content)).length;
		return mathCount >= 2;
	}

	private static async processToggleHeadingsWithAPI(
		executeFunctions: IExecuteFunctions,
		pageId: string,
		markdownContent: string,
		options: any,
		itemIndex: number
	): Promise<any> {
		try {
			const structure = await MarkdownToNotion.convertMarkdownToToggleStructure(
				markdownContent,
				options.preserveMath ?? true,
				options.mathDelimiter ?? '$',
				options.supportLatex ?? true
			);

			let totalBlocksAdded = 0;
			const allResponses: any[] = [];
			const warnings: string[] = [];

			// Step 1: Add orphan blocks first
			if (structure.orphanBlocks.length > 0) {
				const orphanResult = await MarkdownToNotion.addBlocksToPage(
					executeFunctions,
					pageId,
					structure.orphanBlocks
				);
				totalBlocksAdded += orphanResult.blocksAdded;
				allResponses.push(orphanResult.response);
				warnings.push(...orphanResult.warnings);
			}

			// Step 2: Process all heading nodes recursively
			for (const rootNode of structure.rootNodes) {
				const nodeResult = await MarkdownToNotion.processToggleHeadingNode(
					executeFunctions,
					pageId,
					rootNode
				);
				totalBlocksAdded += nodeResult.blocksAdded;
				allResponses.push(...nodeResult.responses);
				warnings.push(...nodeResult.warnings);
			}

			return {
				json: {
					success: true,
					pageId,
					blocksAdded: totalBlocksAdded,
					chunksProcessed: allResponses.length,
					totalBlocks: totalBlocksAdded,
					responses: allResponses,
					warnings: warnings.length > 0 ? warnings : undefined,
				},
			};

		} catch (error) {
			throw new NodeOperationError(
				executeFunctions.getNode(),
				`Toggle headings processing failed: ${error.message}`,
				{ itemIndex }
			);
		}
	}

	private static async convertMarkdownToToggleStructure(
		markdown: string,
		preserveMath: boolean = true,
		mathDelimiter: string = '$',
		supportLatex: boolean = true
	): Promise<ToggleHeadingStructure> {
		let processedMarkdown = markdown;
		const mathPlaceholders: { [key: string]: string } = {};
		let mathCounter = 1;

		if (preserveMath) {
			if (supportLatex && mathDelimiter === '$') {
				const latexMatches: Array<{ match: string; formula: string; start: number; end: number }> = [];
				
				for (let pos = 0; pos < processedMarkdown.length - 1; pos++) {
					if (processedMarkdown.substring(pos, pos + 2) === '$$') {
						const startPos = pos;
						pos += 2;
						let depth = 1;
						let formula = '';
						
						while (pos < processedMarkdown.length - 1 && depth > 0) {
							const char = processedMarkdown[pos];
							const nextChar = processedMarkdown[pos + 1];
							
							if (char === '$' && nextChar === '$') {
								depth--;
								if (depth === 0) break;
								formula += char + nextChar;
								pos += 2;
							} else {
								formula += char;
								pos++;
							}
						}
						
						if (depth === 0 && formula.trim().length > 0 && formula.trim().length <= 100) {
							const fullMatch = processedMarkdown.substring(startPos, pos + 2);
							latexMatches.push({
								match: fullMatch,
								formula: formula.trim(),
								start: startPos,
								end: pos + 2
							});
						}
					}
					
					latexMatches.reverse().forEach(({ match, formula }) => {
						const placeholder = `MATHPLACEHOLDER${mathCounter}MATHPLACEHOLDER`;
						mathPlaceholders[placeholder] = `$${formula}$`;
						mathCounter++;
						processedMarkdown = processedMarkdown.replace(match, placeholder);
					});
				}
			}
			
			if (mathDelimiter === '$') {
				let lastIndex = 0;
				const parts: string[] = [];
				const regex = /\$([^$\n\r]+?)\$/g;
				let match: RegExpExecArray | null;
				
				while ((match = regex.exec(processedMarkdown))) {
					const fullMatch = match[0];
					const formula = match[1];
					const trimmedFormula = formula.trim();
					
					parts.push(processedMarkdown.substring(lastIndex, match.index));
					
					if (trimmedFormula.length === 0 || trimmedFormula.length > 100) {
						parts.push(fullMatch);
					} else if (MarkdownToNotion.isLikelyPrice(trimmedFormula)) {
						parts.push(fullMatch);
					} else if (MarkdownToNotion.isLikelyMathFormula(trimmedFormula)) {
						const placeholder = `MATHPLACEHOLDER${mathCounter}MATHPLACEHOLDER`;
						mathPlaceholders[placeholder] = fullMatch;
						mathCounter++;
						parts.push(placeholder);
					} else {
						parts.push(fullMatch);
					}
					
					lastIndex = regex.lastIndex;
				}
				
				parts.push(processedMarkdown.substring(lastIndex));
				processedMarkdown = parts.join('');
			} else {
				const mathRegex = new RegExp(`\\${mathDelimiter}([^${mathDelimiter}\\n\\r]+?)\\${mathDelimiter}`, 'g');
				processedMarkdown = markdown.replace(mathRegex, (match, formula) => {
					const trimmedFormula = formula.trim();
					
					if (trimmedFormula.length > 100) {
						return match;
					}
					
					if (MarkdownToNotion.isLikelyMathFormula(trimmedFormula)) {
						const placeholder = `MATHPLACEHOLDER${mathCounter}MATHPLACEHOLDER`;
						mathPlaceholders[placeholder] = match;
						mathCounter++;
						return placeholder;
					}
					
					return match;
				});
			}
		}

		processedMarkdown = MarkdownToNotion.sanitizeFencedCodeBlocks(processedMarkdown);
		processedMarkdown = MarkdownToNotion.preprocessToggleBlocks(processedMarkdown);

		const processor = unified()
			.use(remarkParse)
			.use(remarkGfm);

		const tree = processor.parse(processedMarkdown);
		return MarkdownToNotion.buildToggleHeadingStructure(tree.children, mathPlaceholders);
	}

	private static async processToggleHeadingNode(
		executeFunctions: IExecuteFunctions,
		parentId: string,
		node: ToggleHeadingNode
	): Promise<{ blocksAdded: number; responses: any[]; warnings: string[] }> {
		let totalBlocksAdded = 0;
		const allResponses: any[] = [];
		const warnings: string[] = [];

		// Step 1: Create the heading block
		const headingResult = await MarkdownToNotion.addBlocksToPage(
			executeFunctions,
			parentId,
			[node.heading]
		);
		
		totalBlocksAdded += headingResult.blocksAdded;
		allResponses.push(headingResult.response);
		warnings.push(...headingResult.warnings);

		if (headingResult.response?.results?.[0]?.id) {
			const headingBlockId = headingResult.response.results[0].id;
			node.blockId = headingBlockId;

			// Step 2: Add direct children to the heading
			if (node.children.length > 0) {
				const childrenResult = await MarkdownToNotion.addBlocksToPage(
					executeFunctions,
					headingBlockId,
					node.children
				);
				totalBlocksAdded += childrenResult.blocksAdded;
				allResponses.push(childrenResult.response);
				warnings.push(...childrenResult.warnings);
			}

			// Step 3: Process sub-headings recursively
			for (const subHeading of node.subHeadings) {
				const subResult = await MarkdownToNotion.processToggleHeadingNode(
					executeFunctions,
					headingBlockId,
					subHeading
				);
				totalBlocksAdded += subResult.blocksAdded;
				allResponses.push(...subResult.responses);
				warnings.push(...subResult.warnings);
			}
		}

		return {
			blocksAdded: totalBlocksAdded,
			responses: allResponses,
			warnings
		};
	}

	private static async addBlocksToPage(
		executeFunctions: IExecuteFunctions,
		pageId: string,
		blocks: NotionBlock[]
	): Promise<{ response: any; blocksAdded: number; warnings: string[] }> {
		if (blocks.length === 0) {
			return {
				response: { results: [] },
				blocksAdded: 0,
				warnings: []
			};
		}

		const normalizedResult = MarkdownToNotion.normalizeBlocksForNotion(blocks);
		const normalizedBlocks = normalizedResult.blocks;
		const warnings = normalizedResult.warnings;

		const requestOptions: IRequestOptions = {
			method: 'PATCH',
			url: `https://api.notion.com/v1/blocks/${pageId}/children`,
			body: {
				children: normalizedBlocks,
			},
			json: true,
		};

		try {
			const response = await executeFunctions.helpers.httpRequestWithAuthentication.call(
				executeFunctions,
				'notionApi',
				requestOptions,
			);

			if (!response || typeof response !== 'object') {
				throw new NodeOperationError(
					executeFunctions.getNode(),
					`Unexpected Notion API response: ${JSON.stringify(response)}`
				);
			}

			if (response.object === 'error') {
				const errorDetails = MarkdownToNotion.parseNotionError(response);
				throw new NodeOperationError(
					executeFunctions.getNode(),
					`Notion API error: ${errorDetails}`
				);
			}

			return {
				response,
				blocksAdded: response.results?.length || 0,
				warnings
			};

		} catch (error) {
			throw new NodeOperationError(
				executeFunctions.getNode(),
				`Failed to add blocks to Notion: ${error.message}`
			);
		}
	}
}