#!/bin/bash

# n8n-nodes-md2notion v1.5.2 发布脚本
# 使用方法: ./publish.sh

set -e

echo "🚀 准备发布 n8n-nodes-md2notion v1.5.2..."
echo

# 1. 检查当前分支
current_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
if [ "$current_branch" != "main" ] && [ "$current_branch" != "master" ] && [ "$current_branch" != "unknown" ]; then
    echo "⚠️  警告: 当前不在 main/master 分支 (当前: $current_branch)"
    read -p "是否继续? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 发布已取消"
        exit 1
    fi
fi

# 2. 运行构建
echo "🔨 构建项目..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi

# 3. 运行验证
echo "🧪 运行验证测试..."
node verify-fixes.js
if [ $? -ne 0 ]; then
    echo "❌ 验证测试失败"
    exit 1
fi

# 4. 检查包内容
echo "📦 检查包内容..."
npm pack --dry-run > /tmp/npm-pack-output.txt 2>/dev/null || true
if [ -f /tmp/npm-pack-output.txt ]; then
    echo "包大小: $(grep 'package size:' /tmp/npm-pack-output.txt | awk '{print $3 $4}' || echo '未知')"
    echo "文件数量: $(grep 'total files:' /tmp/npm-pack-output.txt | awk '{print $3}' || echo '未知')"
fi

# 5. 显示版本信息
current_version=$(node -p "require('./package.json').version")
echo
echo "📋 发布信息:"
echo "   包名: n8n-nodes-md2notion"
echo "   版本: $current_version"
echo "   描述: $(node -p "require('./package.json').description")"
echo

# 6. 显示主要更新
echo "🎯 主要更新 (v1.5.2):"
echo "   🔗 修复表格中链接丢失问题"
echo "   🔗 修复引用块中链接丢失问题"  
echo "   🧮 修复表格中数学公式占位符问题"
echo "   ✅ 链接现在在所有上下文中都能正常工作"
echo

# 7. 最终确认
read -p "确认发布到 npm? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 发布已取消"
    exit 1
fi

# 8. 获取 OTP（如果需要）
echo "⚠️  如果你的账户启用了 2FA，需要输入验证码"
read -p "请输入 2FA 验证码 (如无 2FA 直接回车): " otp

# 9. 发布到 npm
echo "🚀 发布到 npm..."
if [ -n "$otp" ]; then
    npm publish --otp=$otp
else
    npm publish
fi

if [ $? -eq 0 ]; then
    echo
    echo "🎉 发布成功!"
    echo
    echo "📦 包信息:"
    echo "   npm: https://www.npmjs.com/package/n8n-nodes-md2notion"
    echo "   版本: $current_version"
    echo
    echo "📝 后续步骤:"
    echo "   1. 创建 Git tag: git tag v$current_version && git push origin v$current_version"
    echo "   2. 创建 GitHub Release"
    echo "   3. 更新文档和示例"
    echo
    echo "🔗 安装命令:"
    echo "   npm install -g n8n-nodes-md2notion@$current_version"
    echo
    echo "👥 用户升级命令:"
    echo "   npm update n8n-nodes-md2notion"
else
    echo "❌ 发布失败"
    echo
    echo "💡 常见问题:"
    echo "   - OTP 代码错误或过期：请重新运行此脚本"
    echo "   - 版本号已存在：需要更新 package.json 中的版本号"
    echo "   - npm 登录过期：运行 'npm login' 重新登录"
    exit 1
fi
