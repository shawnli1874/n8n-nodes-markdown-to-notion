# n8n-nodes-md2notion

[![npm version](https://badge.fury.io/js/n8n-nodes-md2notion.svg)](https://badge.fury.io/js/n8n-nodes-md2notion)
[![CI](https://github.com/shawnli1874/n8n-nodes-md2notion/workflows/CI/badge.svg)](https://github.com/shawnli1874/n8n-nodes-md2notion/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Tested](https://img.shields.io/badge/Tests-Passing-brightgreen.svg)](https://jestjs.io/)

A custom n8n node that converts markdown content to Notion page blocks with **comprehensive block type support** and **proper formula handling**.

## 🎯 Why This Node?

Existing n8n community nodes for markdown-to-Notion conversion have critical limitations: they incorrectly handle inline math formulas like `$E = mc^2$` and support only basic block types. This node **solves these problems** by:

- ✅ **Preserving math formulas** exactly as written (inline and block)
- ✅ **Supporting 16+ Notion block types** including todos, callouts, tables, toggles, and more
- ✅ **Using reliable parsing** with the remark ecosystem  
- ✅ **Providing excellent error handling** and user feedback
- ✅ **Production-ready quality** with TypeScript strict mode and comprehensive tests

## 🚀 Quick Start

### Installation

**Option 1: Install via n8n Community Nodes (Recommended)**

1. Open your n8n instance
2. Go to **Settings** → **Community Nodes**
3. Enter package name: `n8n-nodes-md2notion`
4. Click **Install**

**Option 2: Install via npm**

```bash
npm install -g n8n-nodes-md2notion
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

| Element | Notion Block Type | Syntax | Status |
|---------|------------------|--------|--------|
| **Text & Formatting** | | | |
| Headings (H1-H3) | `heading_1/2/3` | `# ## ###` | ✅ |
| Paragraphs | `paragraph` | Regular text | ✅ |
| **Bold** and *italic* | Rich text formatting | `**bold** *italic*` | ✅ |
| `Inline code` | Code annotation | `` `code` `` | ✅ |
| [Links](url) | Rich text with links | `[text](url)` | ✅ |
| **Lists & Tasks** | | | |
| - Bulleted lists | `bulleted_list_item` | `- item` | ✅ |
| 1. Numbered lists | `numbered_list_item` | `1. item` | ✅ |
| - [ ] Todo items | `to_do` | `- [ ] task` | ✅ |
| - [x] Completed todos | `to_do` | `- [x] done` | ✅ |
| **Content Blocks** | | | |
| Code blocks | `code` | ``` ```language ``` | ✅ |
| > Blockquotes | `quote` | `> quote` | ✅ |
| > [!note] Callouts | `callout` | `> [!note] text` | ✅ |
| **Media & Links** | | | |
| ![Images](url) | `image` | `![alt](url)` | ✅ |
| Bookmarks | `bookmark` | `https://example.com` | ✅ |
| **Structure** | | | |
| Dividers | `divider` | `---` or `***` | ✅ |
| Tables | `table` + `table_row` | Markdown tables | ✅ |
| Toggle blocks | `toggle` | `<details><summary>` | ✅ |
| **Math** | | | |
| Inline formulas | Preserved text | `$E = mc^2$` | ✅ |
| Block equations | `equation` | `$$formula$$` | ✅ |

### Callout Types Supported

| Syntax | Icon | Description |
|--------|------|-------------|
| `> [!note]` | 📝 | General notes and information |
| `> [!warning]` | ⚠️ | Important warnings |
| `> [!tip]` | 💡 | Helpful tips and suggestions |
| `> [!info]` | ℹ️ | Additional information |
| `> [!important]` | ❗ | Critical information |
| `> [!caution]` | ⚠️ | Cautionary notes |

### Configuration Options

- **Preserve Math Formulas**: Keep `$formula$` syntax intact (default: enabled)
- **Math Formula Delimiter**: Customize the delimiter character (default: `$`)

## 🧮 Math Formula Handling

**The Problem**: Other nodes convert `$E = mc^2$` incorrectly, breaking Notion rendering.

**Our Solution**: Smart formula preservation algorithm that handles both inline and block equations:

```markdown
Input:  "This equation $E = mc^2$ is famous, but $10 is just money."
Output: "This equation $E = mc^2$ is famous, but $10 is just money."

Block equation:
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

The node intelligently distinguishes between math formulas and regular dollar signs.

## 📖 Examples

### Comprehensive Example

This example showcases all supported block types:

```markdown
# Project Documentation

This is a regular paragraph with **bold** and *italic* text, plus inline math: $E = mc^2$.

## Task List

- [ ] Review the codebase
- [x] Write comprehensive tests  
- [ ] Calculate the integral $\int x^2 dx$

## Important Notes

> [!warning] Critical Issue
> The server will be down for maintenance.

> [!tip] Pro Tip
> Use keyboard shortcuts to speed up your workflow.

> This is a regular blockquote for general information.

## Code Example

```javascript
const energy = mass * Math.pow(speedOfLight, 2);
console.log(`Energy: ${energy}`);
```

## Expandable Sections

<details>
<summary>Advanced Configuration</summary>

### Database Settings
- Connection timeout: 30 seconds
- Max pool size: 10
- Enable SSL: true

### Performance Tuning
The system can handle up to $10^6$ requests per second with proper configuration.
</details>

<details>
<summary>Troubleshooting Guide</summary>
If you encounter issues, check the following:

1. Verify API credentials
2. Check network connectivity  
3. Review error logs
</details>

## Data Table

| Name | Formula | Value |
|------|---------|-------|
| Energy | $E = mc^2$ | Variable |
| Force | $F = ma$ | Variable |

---

## Mathematical Proof

The fundamental theorem of calculus:

$$
\int_a^b f'(x) dx = f(b) - f(a)
$$

For more information, visit: https://en.wikipedia.org/wiki/Calculus

![Mathematical Diagram](https://via.placeholder.com/400x200)

Final paragraph with mixed content: **bold**, *italic*, `code`, and $f(x) = x^2$ formula.
```

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

- [npm Package](https://www.npmjs.com/package/n8n-nodes-md2notion)
- [GitHub Repository](https://github.com/shawnli1874/n8n-nodes-markdown-to-notion)
- [Issue Tracker](https://github.com/shawnli1874/n8n-nodes-markdown-to-notion/issues)
- [Changelog](CHANGELOG.md)
- [Contributing Guide](CONTRIBUTING.md)

---

**Made with ❤️ for the n8n community**

*If this node solved your formula conversion problems, please ⭐ star the repository!*