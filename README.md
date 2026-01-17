# n8n-nodes-markdown-to-notion

[![npm version](https://badge.fury.io/js/n8n-nodes-markdown-to-notion.svg)](https://badge.fury.io/js/n8n-nodes-markdown-to-notion)
[![CI](https://github.com/shawnli1874/n8n-nodes-markdown-to-notion/workflows/CI/badge.svg)](https://github.com/shawnli1874/n8n-nodes-markdown-to-notion/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A custom n8n node that converts markdown content to Notion page blocks with **proper formula handling**.

## 🎯 Why This Node?

Existing n8n community nodes for markdown-to-Notion conversion have a critical flaw: they incorrectly handle inline math formulas like `$E = mc^2$`, causing rendering errors in Notion. This node **solves that problem** by:

- ✅ **Preserving math formulas** exactly as written
- ✅ **Using reliable parsing** with the remark ecosystem  
- ✅ **Supporting all markdown elements** with proper formatting
- ✅ **Providing excellent error handling** and user feedback

## 🚀 Quick Start

### Installation

**Option 1: Install via n8n Community Nodes (Recommended)**

1. Open your n8n instance
2. Go to **Settings** → **Community Nodes**
3. Enter package name: `n8n-nodes-markdown-to-notion`
4. Click **Install**

**Option 2: Install via npm**

```bash
npm install -g n8n-nodes-markdown-to-notion
```

### Setup

1. **Create Notion Integration**
   - Go to [Notion Integrations](https://www.notion.so/my-integrations)
   - Create a new integration and copy the API key

2. **Configure n8n Credentials**
   - In n8n, create new **Notion API** credentials
   - Paste your API key

3. **Share Notion Page**
   - Open your target Notion page
   - Click **Share** → **Invite** → Add your integration

### Usage

1. Add the **Markdown to Notion** node to your workflow
2. Select **Append to Page** operation
3. Enter your **Page ID** (from the Notion page URL)
4. Input your **markdown content**
5. Configure options as needed

## 📋 Features

### Supported Markdown Elements

| Element | Notion Block Type | Status |
|---------|------------------|--------|
| Headings (H1-H3) | `heading_1/2/3` | ✅ |
| Paragraphs | `paragraph` | ✅ |
| **Bold** and *italic* | Rich text formatting | ✅ |
| `Inline code` | Code annotation | ✅ |
| Code blocks | `code` | ✅ |
| - Bulleted lists | `bulleted_list_item` | ✅ |
| 1. Numbered lists | `numbered_list_item` | ✅ |
| > Blockquotes | `quote` | ✅ |
| [Links](url) | Rich text with links | ✅ |
| **Math formulas** | Preserved as plain text | ✅ |

### Configuration Options

- **Preserve Math Formulas**: Keep `$formula$` syntax intact (default: enabled)
- **Math Formula Delimiter**: Customize the delimiter character (default: `$`)

## 🧮 Math Formula Handling

**The Problem**: Other nodes convert `$E = mc^2$` incorrectly, breaking Notion rendering.

**Our Solution**: Smart formula preservation algorithm:

```markdown
Input:  "This equation $E = mc^2$ is famous, but $10 is just money."
Output: "This equation $E = mc^2$ is famous, but $10 is just money."
```

The node intelligently distinguishes between math formulas and regular dollar signs.

## 📖 Examples

### Basic Usage

```markdown
# My Research Notes

This document contains the famous equation $E = mc^2$ discovered by Einstein.

## Key Points

- **Energy** and mass are equivalent
- The speed of light is *constant*
- This applies to `special relativity`

```javascript
const energy = mass * Math.pow(speedOfLight, 2);
```

> This formula revolutionized physics.
```

### Advanced Example

```markdown
# Mathematical Concepts

## Calculus
The derivative of $f(x) = x^2$ is $f'(x) = 2x$.

## Statistics  
The normal distribution: $f(x) = \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{1}{2}(\frac{x-\mu}{\sigma})^2}$

But remember, a coffee costs $5 at the local café.
```

## 🔧 Development

### Prerequisites

- Node.js 16+
- npm or yarn
- n8n for testing

### Setup

```bash
# Clone the repository
git clone https://github.com/shawnli1874/n8n-nodes-markdown-to-notion.git
cd n8n-nodes-markdown-to-notion

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Testing

```bash
# Run core functionality tests
npm test

# Test manually with n8n
cp -r dist/* ~/.n8n/custom/
# Restart n8n and test in the UI
```

## 🐛 Troubleshooting

### Common Issues

**Node not appearing in n8n**
- Ensure n8n is restarted after installation
- Check that the package is installed: `npm list -g n8n-nodes-markdown-to-notion`

**"Unauthorized" error**
- Verify your Notion API key is correct
- Ensure the integration is shared with the target page

**Math formulas not preserved**
- Check that "Preserve Math Formulas" option is enabled
- Verify your delimiter setting matches your content

**Page not found**
- Double-check the Page ID from the Notion URL
- Ensure the page is shared with your integration

### Debug Mode

Enable debug logging in n8n to see detailed error messages and API responses.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Contribution Guide

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure tests pass: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [n8n](https://n8n.io/) for the excellent workflow automation platform
- [Notion](https://notion.so/) for the powerful API
- [remark](https://remark.js.org/) for reliable markdown parsing
- The open source community for inspiration and feedback

## 📊 Project Stats

- **Language**: TypeScript
- **Package Manager**: npm
- **Testing**: Custom test suite
- **CI/CD**: GitHub Actions
- **License**: MIT

## 🔗 Links

- [npm Package](https://www.npmjs.com/package/n8n-nodes-markdown-to-notion)
- [GitHub Repository](https://github.com/shawnli1874/n8n-nodes-markdown-to-notion)
- [Issue Tracker](https://github.com/shawnli1874/n8n-nodes-markdown-to-notion/issues)
- [Changelog](CHANGELOG.md)
- [Contributing Guide](CONTRIBUTING.md)

---

**Made with ❤️ for the n8n community**

*If this node solved your formula conversion problems, please ⭐ star the repository!*