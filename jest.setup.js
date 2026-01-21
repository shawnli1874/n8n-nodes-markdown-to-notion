// Mock ES modules that Jest can't handle
jest.mock('unified', () => ({
  unified: jest.fn()
}));

jest.mock('remark-parse', () => jest.fn());
jest.mock('remark-gfm', () => jest.fn());
jest.mock('unist-util-visit', () => ({
  visit: jest.fn()
}));
jest.mock('mdast-util-to-string', () => ({
  toString: jest.fn()
}));
