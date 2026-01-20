# Task Plan: 添加 Toggle Headings 功能

## Goal
为 n8n-nodes-md2notion 添加一个 "Toggle Headings" 开关选项，当启用时，所有标题块都使用 toggle 类型代替普通 heading 类型。

## Phases
- [x] Phase 1: 研究 Notion API 中的 toggle 块支持
- [x] Phase 2: 设计 UI 配置选项
- [x] Phase 3: 实现 toggle heading 转换逻辑
- [x] Phase 4: 测试功能并验证效果
- [x] Phase 5: 更新文档和版本

## Key Questions
1. Notion API 是否支持 toggle 块作为标题？
2. toggle 块是否支持标题级别的样式？
3. 如何在 n8n 节点中添加新的配置选项？
4. toggle 块的内容结构是什么？

## Decisions Made
- ✅ Notion API 完全支持 toggle 块
- ✅ Toggle 块可以通过 rich_text annotations 模拟标题样式
- ✅ Toggle 块支持嵌套和子内容
- ✅ 实现了 UI 配置选项 "Toggle Headings"
- ✅ 实现了完整的 toggle heading 转换逻辑
- ✅ 功能测试通过，效果良好

## Errors Encountered
- 待记录

## Status
**COMPLETED** - Toggle Headings 功能已完成实现、测试并发布为 v1.6.0