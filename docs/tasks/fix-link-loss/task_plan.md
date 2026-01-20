# Task Plan: 修复 Markdown 链接丢失问题

## Goal
修复 n8n-nodes-md2notion 中的链接丢失问题，包括引用块、表格、Toggle 块中的链接，以及表格中数学公式占位符显示问题。

## Phases
- [x] Phase 1: 问题分析和测试环境搭建
- [x] Phase 2: 创建全面的测试用例
- [x] Phase 3: 定位具体问题代码
- [x] Phase 4: 修复链接丢失问题
- [x] Phase 5: 修复数学公式占位符问题
- [x] Phase 6: 验证修复效果
- [x] Phase 7: 更新版本和文档

## Key Questions
1. 哪些场景下链接会丢失？（引用块、表格、Toggle）
2. 数学公式占位符为什么会显示在表格中？
3. 如何在不破坏现有功能的前提下修复？

## Decisions Made
- 使用 Notion API 直接测试，不依赖 n8n 环境
- 测试代码放在 test-scripts/ 目录，不进入 npm 包
- 使用 .env 文件存储测试凭据
- **表格问题修复**：将 `mdastToString(cell)` 替换为 `inlineNodesToRichText(cell.children, mathPlaceholders)`
- **引用块问题修复**：改进 `createQuoteBlock` 函数，正确处理段落子节点结构

## Errors Encountered
- 初始测试脚本依赖问题：unified 模块导入失败

## Status
**COMPLETED** - 所有问题已修复、验证并发布为 v1.5.2