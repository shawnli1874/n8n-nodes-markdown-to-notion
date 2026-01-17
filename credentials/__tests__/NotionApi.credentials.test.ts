import { NotionApi } from '../NotionApi.credentials';

describe('NotionApi Credentials', () => {
	let credentials: NotionApi;

	beforeEach(() => {
		credentials = new NotionApi();
	});

	describe('Metadata', () => {
		it('should have correct name and displayName', () => {
			expect(credentials.name).toBe('notionApi');
			expect(credentials.displayName).toBe('Notion API');
		});

		it('should have documentation URL', () => {
			expect(credentials.documentationUrl).toBe('https://developers.notion.com/docs/getting-started');
		});
	});

	describe('Properties', () => {
		it('should have apiKey property', () => {
			const apiKeyProperty = credentials.properties.find(p => p.name === 'apiKey');
			expect(apiKeyProperty).toBeDefined();
			expect(apiKeyProperty!.type).toBe('string');
			expect(apiKeyProperty!.displayName).toBe('API Key');
		});

		it('should have apiKey as password type', () => {
			const apiKeyProperty = credentials.properties.find(p => p.name === 'apiKey');
			expect((apiKeyProperty as any).typeOptions?.password).toBe(true);
		});
	});

	describe('Authentication', () => {
		it('should use Bearer token authentication', () => {
			expect(credentials.authenticate.type).toBe('generic');
			expect(credentials.authenticate.properties.headers.Authorization).toBe('=Bearer {{$credentials.apiKey}}');
		});

		it('should include Notion-Version header', () => {
			expect(credentials.authenticate.properties.headers['Notion-Version']).toBe('2022-06-28');
		});

		it('should include Content-Type header', () => {
			expect(credentials.authenticate.properties.headers['Content-Type']).toBe('application/json');
		});
	});

	describe('Test Request', () => {
		it('should have test endpoint configured', () => {
			expect(credentials.test.request.baseURL).toBe('https://api.notion.com/v1');
			expect(credentials.test.request.url).toBe('/users/me');
		});
	});
});
