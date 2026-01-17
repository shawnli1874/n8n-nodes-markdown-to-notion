#!/bin/bash

echo "🚀 准备发布 n8n-nodes-md2notion v1.3.0 到 npm..."
echo ""
echo "📋 检查清单："
echo "  ✅ 代码已修复"
echo "  ✅ 已编译到 dist/"
echo "  ✅ 已提交到 GitHub"
echo "  ✅ 包内容已优化（排除测试文件）"
echo ""
echo "⚠️  你需要输入双因素认证（2FA）代码"
echo ""
read -p "请输入你的 Authenticator 6位数代码: " otp

if [ -z "$otp" ]; then
    echo "❌ 未输入 OTP 代码，取消发布"
    exit 1
fi

echo ""
echo "🔄 正在发布到 npm..."
npm publish --otp=$otp

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 发布成功！"
    echo ""
    echo "🔗 查看发布："
    echo "   npm: https://www.npmjs.com/package/n8n-nodes-md2notion"
    echo "   GitHub: https://github.com/shawnli1874/n8n-nodes-md2notion"
    echo ""
    echo "📦 用户现在可以通过以下方式更新："
    echo "   npm update n8n-nodes-md2notion"
    echo "   或在 n8n 社区节点中重新安装"
else
    echo ""
    echo "❌ 发布失败！请检查错误信息"
    echo ""
    echo "💡 常见问题："
    echo "   - OTP 代码错误或过期：请重新运行此脚本"
    echo "   - 版本号已存在：需要更新 package.json 中的版本号"
    echo "   - npm 登录过期：运行 'npm login' 重新登录"
    exit 1
fi
