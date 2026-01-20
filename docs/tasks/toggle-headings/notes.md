# Notes: Toggle Headings 功能研究

## 任务背景

用户希望添加一个 "Toggle Headings" 开关，当启用时：
- 所有标题块（H1-H6）都使用 toggle 类型代替普通 heading 类型
- 这样可以让标题变成可折叠的，提供更好的文档组织体验

## 需要研究的问题

### 1. Notion API Toggle 块支持
- toggle 块的基本结构和属性
- toggle 块是否支持标题样式
- toggle 块的 rich_text 格式要求

### 2. 实现方案
- 如何在现有的 createHeadingBlock 函数中添加 toggle 选项
- UI 配置选项的设计和实现
- 向后兼容性考虑

### 3. 测试验证
- 创建测试用例验证 toggle heading 效果
- 确保在 Notion 中正确显示

## 调研结果

### ✅ Notion API Toggle 块支持验证

**测试结果**：Toggle 块完全支持，功能丰富
- ✅ 基本 toggle 块正常工作
- ✅ 支持 rich_text 格式和 annotations（粗体、颜色等）
- ✅ 支持子内容（children 属性）
- ✅ 支持嵌套 toggle 块
- ✅ 空 toggle 块也支持

**关键发现**：
1. **样式模拟**：可以通过 `annotations: { bold: true }` 模拟标题的粗体效果
2. **层级区分**：可以通过不同的 `color` 属性区分标题级别
3. **内容支持**：toggle 块的 `children` 属性可以包含任意 Notion 块类型
4. **视觉效果**：在 Notion 中显示为可折叠的标题，用户体验良好

### 实现方案设计

**配置选项设计**：
- 添加 "Toggle Headings" 布尔选项到节点配置
- 默认值：false（保持向后兼容）
- 描述：将所有标题转换为可折叠的 toggle 块

**技术实现**：
1. 修改 `createHeadingBlock` 函数，添加 `useToggleHeadings` 参数
2. 当启用时，返回 toggle 块而不是 heading 块
3. 使用 annotations 模拟不同级别的标题样式
4. 保持原有的 H5/H6 → 粗体段落的逻辑

## 功能实现完成

### ✅ UI 配置选项
- 在节点的 Options 集合中添加了 "Toggle Headings" 布尔选项
- 默认值：false（保持向后兼容）
- 描述：将所有标题转换为可折叠的 toggle 块

### ✅ 技术实现
1. **函数签名更新**：
   - `convertMarkdownToNotionBlocks` 添加 `toggleHeadings` 参数
   - `nodeToBlocks` 添加 `toggleHeadings` 参数传递
   - `createHeadingBlock` 添加 `toggleHeadings` 参数和逻辑

2. **Toggle 标题样式映射**：
   - H1: `{ bold: true, color: 'default' }`
   - H2: `{ bold: true, color: 'gray' }`
   - H3: `{ bold: true, color: 'brown' }`
   - H4: `{ bold: true, color: 'orange' }`
   - H5/H6: 继续使用粗体段落（不变）

3. **向后兼容性**：
   - 默认 `toggleHeadings = false`，保持原有行为
   - 现有工作流无需修改

### ✅ 测试验证
- 创建了全面的对比测试
- 测试了普通模式 vs Toggle 模式
- 验证了复杂内容（链接、公式、格式）的处理
- 确认了不同级别标题的视觉区分
- 61 个测试块成功导入 Notion

### 功能特点
1. **可折叠标题**：所有 H1-H4 标题变成可折叠的 toggle 块
2. **视觉层级**：通过颜色区分不同级别的标题
3. **内容保留**：标题下的所有内容都会成为 toggle 的子内容
4. **格式支持**：标题中的链接、公式、格式都正确保留
5. **用户体验**：提供更好的文档组织和导航体验

### 下一步
- 更新版本号到 1.6.0（新功能）
- 更新 README 和 CHANGELOG
- 准备发布