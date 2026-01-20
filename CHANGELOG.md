# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.6.0] - 2026-01-20

### 🚀 New Feature: Toggle Headings

This release introduces a new "Toggle Headings" option that converts all headings to collapsible toggle blocks, providing better document organization and navigation in Notion.

#### ✨ New Features

**📂 Toggle Headings Option**
- **New Configuration**: Added "Toggle Headings" boolean option in node settings
  - Default: `false` (maintains backward compatibility)
  - When enabled: All H1-H4 headings become collapsible toggle blocks
  - Description: "Convert all headings to collapsible toggle blocks instead of regular headings"

**🎨 Visual Hierarchy**
- **Level-based Styling**: Different heading levels use distinct colors for visual hierarchy
  - H1: Bold + Default color
  - H2: Bold + Gray color  
  - H3: Bold + Brown color
  - H4: Bold + Orange color
  - H5/H6: Continue as bold paragraphs (unchanged)

**📋 Content Preservation**
- **Complete Format Support**: All heading content preserved including:
  - Links within headings
  - Math formulas in headings
  - Text formatting (bold, italic, etc.)
  - Mixed content combinations

**🔄 Backward Compatibility**
- **Zero Breaking Changes**: Existing workflows continue to work unchanged
- **Default Behavior**: Toggle headings disabled by default
- **Gradual Adoption**: Users can enable the feature when needed

#### 🧪 Technical Implementation

**API Integration**:
- Utilizes Notion's native `toggle` block type
- Applies `rich_text` annotations for heading-style formatting
- Maintains all existing functionality while adding toggle capability

**User Experience**:
- **Collapsible Sections**: Users can expand/collapse document sections
- **Better Navigation**: Large documents become more manageable
- **Visual Clarity**: Color-coded heading levels improve readability

#### 📊 Testing

- Comprehensive comparison testing (normal vs toggle mode)
- 61 test blocks covering all scenarios
- Verified complex content handling (links, formulas, formatting)
- Confirmed visual hierarchy and collapsible functionality

## [1.5.2] - 2026-01-20

### 🐛 Critical Link and Formula Fixes

This release fixes critical issues where links were lost in certain contexts and math formula placeholders appeared in tables.

#### ✨ Fixed Issues

**🔗 Link Preservation in All Contexts**
- **Table Links Fixed**: Links in table cells now properly preserved
  - Previously: `[Link Text](url)` became plain text "Link Text"
  - Now: Correctly renders as clickable links in Notion table cells
  - Technical: Replaced `mdastToString(cell)` with `inlineNodesToRichText(cell.children, mathPlaceholders)`

- **Quote Block Links Fixed**: Links in blockquotes now properly preserved
  - Previously: Quote blocks flattened all inline content to plain text
  - Now: Correctly processes paragraph children to preserve links and formatting
  - Technical: Enhanced `createQuoteBlock` to handle nested paragraph structure

**🧮 Math Formula Display in Tables**
- **Placeholder Issue Fixed**: Math formulas in tables now render correctly
  - Previously: Displayed raw placeholders like "MATHPLACEHOLDER0MATHPLACEHOLDER"
  - Now: Properly renders as equation blocks in table cells
  - Technical: Math placeholder replacement now works in table context

#### 📊 Impact Summary

**Fixed Contexts**:
- ✅ Table cells with links (e.g., `| Site | [Google](https://google.com) |`)
- ✅ Quote blocks with links (e.g., `> Check [this link](https://example.com)`)
- ✅ Math formulas in tables (e.g., `| Formula | $E = mc^2$ |`)

**Always Worked (No Changes)**:
- ✅ Paragraph links
- ✅ List item links  
- ✅ Toggle block links (parsed as regular content)
- ✅ Mixed formatting with links

#### 🧪 Testing

- Comprehensive test suite with 37 test blocks
- All link types verified in Notion
- Math formula rendering confirmed
- Zero regressions detected

## [1.5.1] - 2026-01-19

### 🐛 Critical Bug Fixes

**Note**: Version 1.5.0 was published with incomplete fixes. This version (1.5.1) contains the actual working implementations.

#### ✨ Fixed Features

**📝 Complete Heading Support (H1-H6)**
- **H4 Heading Support**: Now correctly renders as `heading_4` block type
  - Previously: H4 was incorrectly converted to `heading_3`
  - Root cause: Code incorrectly assumed Notion API only supports H1-H3
  - Fix: Updated heading conversion logic to use native `heading_1` through `heading_4` types
  - Impact: All H4 headings now display at the correct level in Notion

- **H5/H6 Graceful Degradation**: Converts to bold paragraphs (Notion API limitation)
  - Notion API only supports heading levels 1-4
  - H5 (`#####`) → Bold paragraph with H5 text
  - H6 (`######`) → Bold paragraph with H6 text
  - Maintains content hierarchy while working within API constraints

**🧮 Improved Math Formula Detection**
- **Smart Currency vs. Formula Distinction**: Conservative detection algorithm
  - New `isLikelyPrice()` function detects currency patterns:
    - Simple prices: `$50`, `$100`
    - With currency words: `$100 美元`, `$25 块`
    - Chinese currency context: 元、美金、刀、块、毛、分
    - Conjunction patterns: `$25 和`, `$30 或`
  
  - Enhanced `isLikelyMathFormula()` requires strong indicators:
    - LaTeX commands: `\frac`, `\sum`, `\int`, `\sqrt`, etc.
    - Greek letters: `\alpha`, `\beta`, `\gamma`, etc.
    - Math symbols: `^`, `_`, `{`, `}`
    - **Requires 2+ indicators** to confirm as formula
  
  - Examples:
    - ✅ Preserved as text: `$50`, `$100 美元`, `$25 和公式`
    - ✅ Detected as formula: `$E = mc^2$`, `$\frac{a}{b}$`, `$\alpha + \beta$`

**✍️ Better Text Formatting**
- **Strikethrough Support**: Properly renders `~~text~~` with strikethrough annotation
- **Dual Italic Syntax**: Supports both `*italic*` and `_italic_` markdown syntax

#### 📝 Documentation Updates
- Added strikethrough to supported features table
- Updated italic syntax documentation to show both formats
- Enhanced formula detection explanation with examples
- Added H4/H5/H6 examples to comprehensive example section

#### 🔧 Package Improvements
- Updated `.npmignore` to exclude `test-scripts/` directory
- Reduced package size by excluding development test files

### 🧪 Testing
- Verified with comprehensive test file (53 blocks)
- All heading levels tested (H1-H6)
- Currency patterns tested: `$50`, `$100 美元`, `$25 和`
- Math formulas tested: 7 different types
- Text formatting: bold, italic, strikethrough all working

## [1.5.0] - 2026-01-19 [YANKED]

**⚠️ This version was published with incomplete implementations. Use 1.5.1 instead.**

## [1.4.0] - 2026-01-17

### 🚀 Major Feature Release: Large Document Support & Advanced Error Handling

This release completely solves the "Bad request" error that occurred with large documents and introduces enterprise-grade error handling and content validation.

#### ✨ New Features

**🔄 Automatic Document Chunking**
- **Large Document Support**: Automatically handles documents with 100+ blocks
- **Smart Chunking**: Splits large documents into multiple API calls (max 100 blocks each)
- **Progress Tracking**: Returns `chunksProcessed`, `totalBlocks`, and `blocksAdded` for monitoring
- **Seamless Processing**: No user intervention required - works transparently

**🛡️ Advanced Content Validation**
- **Length Validation**: Automatically truncates content exceeding 2000 characters
- **Rich Text Limits**: Enforces Notion's 100-element rich_text array limit
- **Safe Truncation**: Adds `...[截断]` indicator when content is truncated
- **Preserves Structure**: Maintains block integrity during validation

**🔍 Enterprise Error Handling**
- **Detailed Error Messages**: Specific error codes with actionable solutions
- **Error Classification**: Handles validation, authorization, rate limiting, and server errors
- **HTTP Error Parsing**: Extracts meaningful error information from failed requests
- **Recovery Guidance**: Provides specific steps to resolve each error type

#### 🐛 Critical Bug Fixes

**Fixed "Bad request - please check your parameters" Error**
- **Root Cause**: Documents with 100+ blocks exceeded Notion API limits
- **Solution**: Automatic chunking splits large requests into compliant chunks
- **Impact**: Documents of any size now process successfully
- **Backward Compatible**: Small documents continue to work as before

**Enhanced Error Reporting**
- **Before**: Generic "Bad request" with no details
- **After**: Specific error codes like `validation_error`, `unauthorized`, `object_not_found`
- **Includes**: Detailed explanations and resolution steps for each error type

## [1.3.2] - 2026-01-16

### 🐛 Bug Fixes
- Fixed math formula preservation edge cases
- Improved error messages for invalid page IDs

## [1.3.1] - 2026-01-15

### 🐛 Bug Fixes
- Fixed table parsing for complex markdown tables
- Improved callout icon handling

## [1.3.0] - 2026-01-14

### ✨ New Features
- Added support for toggle blocks (`<details>` HTML)
- Enhanced table support with proper cell alignment

## [1.2.0] - 2026-01-10

### ✨ New Features
- Added callout support with multiple types
- Improved code block language detection

## [1.1.0] - 2026-01-08

### ✨ New Features
- Added math formula preservation
- Support for inline and block equations

## [1.0.0] - 2026-01-05

### 🎉 Initial Release
- Basic markdown to Notion conversion
- Support for headings, paragraphs, lists, code blocks
- Image and link support
- Todo list support
