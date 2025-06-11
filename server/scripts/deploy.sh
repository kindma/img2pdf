#!/bin/bash
# deploy.sh
# 生产环境部署脚本

set -e  # 遇到错误立即退出

echo "🚀 开始部署PDF生成服务到生产环境..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
APP_NAME="pdf-generator"
APP_DIR="/opt/$APP_NAME"
SERVICE_NAME="pdf-generator"
PORT=1919
USER="www-data"

# 检查是否为root用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}❌ 请使用root权限运行此脚本${NC}"
        echo "使用: sudo bash deploy.sh"
        exit 1
    fi
}

# 安装依赖
install_dependencies() {
    echo -e "${BLUE}📦 安装系统依赖...${NC}"
    
    # 更新包管理器
    apt-get update
    
    # 安装Node.js (如果未安装)
    if ! command -v node &> /dev/null; then
        echo "安装Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    fi
    
    # 安装PM2 (如果未安装)
    if ! command -v pm2 &> /dev/null; then
        echo "安装PM2..."
        npm install -g pm2
    fi
    
    # 安装其他依赖
    apt-get install -y nginx certbot python3-certbot-nginx
    
    echo -e "${GREEN}✅ 系统依赖安装完成${NC}"
}

# 创建应用目录和用户
setup_app_directory() {
    echo -e "${BLUE}📁 设置应用目录...${NC}"
    
    # 创建应用目录
    mkdir -p $APP_DIR
    mkdir -p $APP_DIR/logs
    mkdir -p $APP_DIR/ssl
    mkdir -p $APP_DIR/data
    mkdir -p $APP_DIR/uploads
    mkdir -p $APP_DIR/pdfs
    
    # 设置权限
    chown -R $USER:$USER $APP_DIR
    chmod -R 755 $APP_DIR
    
    echo -e "${GREEN}✅ 应用目录设置完成${NC}"
}

# 复制应用文件
copy_app_files() {
    echo -e "${BLUE}📋 复制应用文件...${NC}"
    
    # 复制应用文件到目标目录
    cp -r ./* $APP_DIR/
    
    # 安装npm依赖
    cd $APP_DIR
    npm install --production
    
    # 设置文件权限
    chown -R $USER:$USER $APP_DIR
    
    echo -e "${GREEN}✅ 应用文件复制完成${NC}"
}

# 配置SSL证书
setup_ssl() {
    echo -e "${BLUE}🔒 配置SSL证书...${NC}"
    
    read -p "请输入您的域名 (例如: example.com): " DOMAIN
    
    if [ -z "$DOMAIN" ]; then
        echo -e "${YELLOW}⚠️  未输入域名，跳过SSL配置${NC}"
        echo "您可以稍后手动配置SSL证书"
        return
    fi
    
    # 使用Let's Encrypt获取SSL证书
    echo "正在为域名 $DOMAIN 申请SSL证书..."
    certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    
    # 复制证书到应用目录
    if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $APP_DIR/ssl/cert.pem
        cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $APP_DIR/ssl/key.pem
        chown $USER:$USER $APP_DIR/ssl/*.pem
        chmod 600 $APP_DIR/ssl/key.pem
        chmod 644 $APP_DIR/ssl/cert.pem
        
        echo -e "${GREEN}✅ SSL证书配置完成${NC}"
    else
        echo -e "${RED}❌ SSL证书申请失败${NC}"
        echo "请手动配置SSL证书或使用HTTP模式"
    fi
}

# 创建PM2配置文件
create_pm2_config() {
    echo -e "${BLUE}⚙️  创建PM2配置...${NC}"
    
    cat > $APP_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$SERVICE_NAME',
    script: './app.js',
    cwd: '$APP_DIR',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: $PORT
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF
    
    chown $USER:$USER $APP_DIR/ecosystem.config.js
    
    echo -e "${GREEN}✅ PM2配置创建完成${NC}"
}

# 配置Nginx反向代理
setup_nginx() {
    echo -e "${BLUE}🌐 配置Nginx...${NC}"
    
    cat > /etc/nginx/sites-available/$SERVICE_NAME << EOF
server {
    listen 80;
    server_name _;
    
    # 重定向到HTTPS (如果启用SSL)
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;
    
    # SSL配置 (如果有证书)
    # ssl_certificate $APP_DIR/ssl/cert.pem;
    # ssl_certificate_key $APP_DIR/ssl/key.pem;
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # 代理到Node.js应用
    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # 文件上传大小限制
        client_max_body_size 50M;
    }
    
    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # 启用站点
    ln -sf /etc/nginx/sites-available/$SERVICE_NAME /etc/nginx/sites-enabled/
    
    # 测试Nginx配置
    nginx -t
    
    # 重启Nginx
    systemctl restart nginx
    systemctl enable nginx
    
    echo -e "${GREEN}✅ Nginx配置完成${NC}"
}

# 启动应用
start_application() {
    echo -e "${BLUE}🚀 启动应用...${NC}"
    
    cd $APP_DIR
    
    # 使用PM2启动应用
    sudo -u $USER pm2 start ecosystem.config.js
    sudo -u $USER pm2 save
    
    # 设置PM2开机自启
    pm2 startup systemd -u $USER --hp /home/$USER
    
    echo -e "${GREEN}✅ 应用启动完成${NC}"
}

# 显示部署信息
show_deployment_info() {
    echo -e "\n${GREEN}🎉 部署完成！${NC}"
    echo -e "${BLUE}📋 部署信息:${NC}"
    echo "应用名称: $APP_NAME"
    echo "应用目录: $APP_DIR"
    echo "运行端口: $PORT"
    echo "运行用户: $USER"
    echo ""
    echo -e "${BLUE}🔧 管理命令:${NC}"
    echo "查看状态: pm2 status"
    echo "查看日志: pm2 logs $SERVICE_NAME"
    echo "重启应用: pm2 restart $SERVICE_NAME"
    echo "停止应用: pm2 stop $SERVICE_NAME"
    echo ""
    echo -e "${BLUE}📁 重要目录:${NC}"
    echo "应用日志: $APP_DIR/logs/"
    echo "SSL证书: $APP_DIR/ssl/"
    echo "数据库: $APP_DIR/data/"
    echo "上传文件: $APP_DIR/uploads/"
    echo "PDF文件: $APP_DIR/pdfs/"
}

# 主部署流程
main() {
    echo -e "${BLUE}🚀 PDF生成服务生产环境部署脚本${NC}"
    echo "================================================"
    
    check_root
    install_dependencies
    setup_app_directory
    copy_app_files
    setup_ssl
    create_pm2_config
    setup_nginx
    start_application
    show_deployment_info
    
    echo -e "\n${GREEN}✅ 部署完成！服务已启动并运行在端口 $PORT${NC}"
}

# 运行主函数
main "$@"
