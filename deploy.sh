#!/bin/bash

# Dropbox永久链接服务一键部署脚本
# 使用方法: ./deploy.sh

echo "========================================"
echo "🚀 Dropbox永久链接服务部署脚本"
echo "========================================"

# 检查是否安装了必要的工具
check_dependencies() {
    echo "🔍 检查依赖项..."
    
    if ! command -v git &> /dev/null; then
        echo "❌ Git未安装，请先安装Git"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js未安装，请先安装Node.js"
        exit 1
    fi
    
    echo "✅ 所有依赖项已安装"
}

# 初始化Git仓库
init_git() {
    echo "📦 初始化Git仓库..."
    
    if [ ! -d ".git" ]; then
        git init
        echo "✅ Git仓库已初始化"
    else
        echo "ℹ️ Git仓库已存在"
    fi
}

# 安装依赖
install_dependencies() {
    echo "📥 安装Node.js依赖..."
    
    if [ -f "package.json" ]; then
        npm install
        echo "✅ 依赖安装完成"
    else
        echo "❌ package.json文件不存在"
        exit 1
    fi
}

# 本地测试
local_test() {
    echo "🧪 运行本地测试..."
    
    # 检查服务是否能在本地运行
    if node server.js &> /dev/null &
    then
        SERVER_PID=$!
        sleep 2
        
        # 测试健康检查端点
        if curl -s http://localhost:3000/api/health | grep -q "healthy"; then
            echo "✅ 本地测试通过"
            kill $SERVER_PID 2>/dev/null
        else
            echo "❌ 本地测试失败"
            kill $SERVER_PID 2>/dev/null
            exit 1
        fi
    else
        echo "❌ 无法启动本地服务"
        exit 1
    fi
}

# 创建GitHub仓库说明
github_instructions() {
    echo ""
    echo "========================================"
    echo "📁 GitHub仓库创建说明"
    echo "========================================"
    echo ""
    echo "1. 访问 https://github.com 并登录"
    echo "2. 点击右上角'+'号，选择'New repository'"
    echo "3. 输入仓库名称，如: dropbox-link-service"
    echo "4. 选择'Public'（公开）或'Private'（私有）"
    echo "5. 不要初始化README、.gitignore或license"
    echo "6. 点击'Create repository'"
    echo ""
    echo "然后将本地代码推送到GitHub:"
    echo ""
    echo "git add ."
    echo "git commit -m '初始提交: Dropbox永久链接服务'"
    echo "git branch -M main"
    echo "git remote add origin https://github.com/你的用户名/仓库名.git"
    echo "git push -u origin main"
    echo ""
}

# Railway部署说明
railway_instructions() {
    echo ""
    echo "========================================"
    echo "☁️ Railway部署说明"
    echo "========================================"
    echo ""
    echo "方法一: Web界面部署（推荐）"
    echo "1. 访问 https://railway.app"
    echo "2. 使用GitHub账号登录"
    echo "3. 点击'New Project'"
    echo "4. 选择'Deploy from GitHub repo'"
    echo "5. 选择您的仓库"
    echo "6. Railway会自动部署"
    echo ""
    echo "方法二: CLI部署"
    echo "1. 安装CLI: npm i -g @railway/cli"
    echo "2. 登录: railway login"
    echo "3. 初始化: railway init"
    echo "4. 部署: railway up"
    echo ""
    echo "部署完成后，Railway会提供一个永久地址，如:"
    echo "https://your-project.up.railway.app"
    echo ""
}

# 验证部署
verify_deployment() {
    echo ""
    echo "========================================"
    echo "✅ 部署完成验证步骤"
    echo "========================================"
    echo ""
    echo "1. 访问您的Railway项目地址"
    echo "2. 应该看到美观的文件中心界面"
    echo "3. 点击任意卡片，应该在新标签页打开Dropbox"
    echo "4. 分享这个地址给需要访问文件的人"
    echo ""
    echo "🎉 恭喜！您的Dropbox永久链接服务已部署完成！"
    echo ""
}

# 主函数
main() {
    echo "开始部署Dropbox永久链接服务..."
    echo ""
    
    check_dependencies
    echo ""
    
    init_git
    echo ""
    
    install_dependencies
    echo ""
    
    local_test
    echo ""
    
    github_instructions
    
    railway_instructions
    
    verify_deployment
}

# 运行主函数
main
