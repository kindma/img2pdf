# 照片转PDF助手

一个功能完整的微信小程序，可以将多张照片快速合并为一个PDF文件。支持图片压缩、实时预览、批量处理等功能。

## 📱 功能特性

### 核心功能
- **多图片选择**: 支持从相册选择最多20张图片
- **智能压缩**: 自动压缩大于2MB的图片，保持清晰度
- **实时预览**: 选择后即时预览，支持删除和重新排序
- **PDF生成**: 服务端高质量PDF生成，支持多种页面格式
- **在线预览**: 生成后可直接在小程序内预览PDF
- **文件下载**: 支持保存到手机本地存储
- **历史记录**: 查看和管理之前生成的PDF文件
- **分享功能**: 支持分享给微信好友

### 技术特点
- **响应式设计**: 适配各种屏幕尺寸
- **错误处理**: 完善的网络异常和错误重试机制
- **性能优化**: 图片压缩、分片上传、智能缓存
- **用户体验**: 流畅的动画效果和实时进度反馈

## 📱 功能演示

### 主要页面展示

#### 1. 首页 - 图片选择
- 简洁的操作界面
- 支持多图片选择和预览
- 实时显示图片数量和大小
- 一键清空和删除功能

#### 2. 处理页 - 上传进度
- 圆形进度指示器
- 分步骤状态展示
- 详细的处理信息反馈
- 支持取消操作

#### 3. 结果页 - 预览下载
- PDF文件信息展示
- 在线预览功能
- 一键下载到本地
- 分享给微信好友

#### 4. 历史记录页
- 查看所有生成的PDF
- 快速重新下载
- 文件管理功能
- 存储空间统计

### 核心功能流程
```
选择图片 → 预览编辑 → 开始上传 → 生成PDF → 预览下载 → 保存分享
   ↓           ↓           ↓           ↓           ↓           ↓
 多选支持    删除重排    进度显示    状态轮询    在线预览    历史记录
```

## 🏗️ 系统架构

### 整体架构图
```
┌─────────────────┐    HTTPS/WSS     ┌─────────────────┐
│   微信小程序      │ ◄──────────────► │   Nginx反向代理   │
│                │                  │                │
│ ┌─────────────┐ │                  │ ┌─────────────┐ │
│ │   首页      │ │                  │ │  SSL终端    │ │
│ │ 图片选择    │ │                  │ │  负载均衡    │ │
│ └─────────────┘ │                  │ └─────────────┘ │
│ ┌─────────────┐ │                  └─────────────────┘
│ │  处理页     │ │                           │
│ │ 上传进度    │ │                           │
│ └─────────────┘ │                  ┌─────────────────┐
│ ┌─────────────┐ │                  │  Node.js集群     │
│ │  结果页     │ │                  │                │
│ │ 预览下载    │ │                  │ ┌─────────────┐ │
│ └─────────────┘ │                  │ │ Express API │ │
│ ┌─────────────┐ │                  │ │   服务器     │ │
│ │  历史页     │ │                  │ └─────────────┘ │
│ │ 记录管理    │ │                  │ ┌─────────────┐ │
│ └─────────────┘ │                  │ │ PDF生成服务  │ │
└─────────────────┘                  │ │  (pdf-lib)  │ │
                                     │ └─────────────┘ │
                                     │ ┌─────────────┐ │
                                     │ │ 文件管理服务  │ │
                                     │ │ 清理&存储    │ │
                                     │ └─────────────┘ │
                                     └─────────────────┘
                                              │
                                     ┌─────────────────┐
                                     │   SQLite数据库   │
                                     │                │
                                     │ ┌─────────────┐ │
                                     │ │ 用户数据    │ │
                                     │ │ PDF历史     │ │
                                     │ │ 统计信息    │ │
                                     │ └─────────────┘ │
                                     └─────────────────┘
```

### 前端架构 (微信小程序)
```
miniprogram/
├── pages/              # 页面文件
│   ├── index/         # 首页 - 图片选择
│   │   ├── index.js   # 页面逻辑
│   │   ├── index.wxml # 页面结构
│   │   ├── index.wxss # 页面样式
│   │   └── index.json # 页面配置
│   ├── processing/    # 处理页 - 上传和生成进度
│   ├── result/        # 结果页 - 预览和下载
│   └── history/       # 历史记录页
├── components/        # 自定义组件
│   └── upload-progress/  # 上传进度组件
├── utils/            # 工具函数
│   ├── api.js        # API接口封装
│   └── util.js       # 通用工具函数
├── config/           # 配置文件
│   └── config.js     # 应用配置
├── images/           # 图片资源
├── app.js           # 应用入口
├── app.json         # 全局配置
├── app.wxss         # 全局样式
└── project.config.json # 项目配置
```

### 后端架构 (Node.js + Express)
```
server/
├── routes/           # 路由模块
│   ├── auth.js      # 用户认证 (微信登录)
│   ├── file.js      # 文件上传处理
│   ├── pdf.js       # PDF生成和管理
│   ├── share.js     # 分享功能
│   ├── stats.js     # 统计功能
│   └── cleanup.js   # 清理服务
├── services/         # 业务服务
│   ├── cleanup-service.js  # 文件清理服务
│   ├── user-service.js     # 用户管理服务
│   └── wechat-service.js   # 微信API服务
├── database/         # 数据库模块
│   └── pdf-history-db-simple.js  # SQLite数据库操作
├── config/          # 配置文件
│   ├── ssl.js       # SSL证书配置
│   └── wechat.js    # 微信小程序配置
├── scripts/         # 部署和维护脚本
│   └── deploy.sh    # 自动部署脚本
├── data/            # 数据存储
│   └── pdf_history.db  # SQLite数据库文件
├── uploads/         # 上传文件临时存储
├── pdfs/           # 生成的PDF文件存储
├── logs/           # 日志文件
├── .env.production # 生产环境配置
├── ecosystem.config.js # PM2配置
├── package.json    # 依赖配置
└── app.js         # 服务器入口
```

## 🛠️ 技术栈

### 前端技术
- **框架**: 微信小程序原生框架
- **样式**: WXSS + Flexbox布局
- **状态管理**: 页面级状态 + 全局数据管理
- **组件化**: 自定义组件开发

### 后端技术
- **运行环境**: Node.js 16+
- **Web框架**: Express.js
- **数据库**: SQLite (better-sqlite3)
- **PDF生成**: pdf-lib
- **文件处理**: multer
- **进程管理**: PM2

### 部署技术
- **反向代理**: Nginx
- **SSL证书**: Let's Encrypt (可选)
- **进程管理**: PM2 Cluster模式
- **自动部署**: Shell脚本

## 🚀 快速开始

### 5分钟快速体验
```bash
# 1. 克隆项目
git clone <repository-url>
cd img2pdfnew

# 2. 启动后端服务
cd server
npm install
npm run dev

# 3. 配置小程序
# 使用微信开发者工具打开 miniprogram 目录
# 修改 config/config.js 中的服务器地址为 http://localhost:3000

# 4. 开始使用
# 在微信开发者工具中预览小程序
```

## 📦 安装部署

### 环境要求
- Node.js 16.0+
- npm 8.0+
- 微信开发者工具
- 服务器 (Ubuntu 20.04+ 推荐)
- 域名和SSL证书 (生产环境)

### 1. 克隆项目
```bash
git clone <repository-url>
cd img2pdfnew
```

### 2. 后端部署

#### 本地开发环境
```bash
cd server
npm install
npm run dev
```

#### 生产环境部署
```bash
# 使用自动部署脚本
cd server/scripts
chmod +x deploy.sh
sudo ./deploy.sh

# 或手动部署
cd server
npm install --production
cp .env.production .env
pm2 start ecosystem.config.js --env production
```

### 3. 前端配置

#### 配置服务器地址
编辑 `miniprogram/config/config.js`:
```javascript
const config = {
  env: 'production', // 或 'development'
  server: {
    production: {
      baseUrl: 'https://your-domain.com',
      apiUrl: 'https://your-domain.com/api'
    }
  }
}
```

#### 配置微信小程序
1. 在微信公众平台注册小程序账号
2. 获取AppID
3. 编辑 `miniprogram/project.config.json`:
```json
{
  "appid": "your-app-id"
}
```

### 4. 发布小程序
1. 使用微信开发者工具打开 `miniprogram` 目录
2. 预览和调试功能
3. 上传代码到微信后台
4. 提交审核并发布

## ⚙️ 配置说明

### 服务器配置
主要配置文件: `server/.env.production`
```bash
# 基本配置
NODE_ENV=production
PORT=1919
BASE_URL=https://your-domain.com

# 微信小程序配置
WECHAT_APP_ID=your-app-id
WECHAT_APP_SECRET=your-app-secret

# 文件存储配置
UPLOAD_DIR=./uploads
PDF_DIR=./pdfs
MAX_FILE_SIZE=10485760

# 数据库配置
DB_PATH=./data/pdf_history.db

# 清理服务配置
CLEANUP_RETENTION_HOURS=24
CLEANUP_AUTO_ENABLED=true
```

### 小程序配置
主要配置文件: `miniprogram/config/config.js`
```javascript
const config = {
  app: {
    limits: {
      maxImages: 20,              // 最大图片数量
      maxImageSize: 10 * 1024 * 1024,  // 单张图片最大10MB
      maxTotalSize: 50 * 1024 * 1024,  // 总大小限制50MB
      compressQuality: 0.8,       // 压缩质量
      compressThreshold: 2 * 1024 * 1024  // 2MB以上压缩
    },
    timeout: {
      request: 30000,   // 请求超时30秒
      upload: 120000,   // 上传超时2分钟
      generate: 300000  // PDF生成超时5分钟
    }
  }
}
```

## 🚀 使用说明

### 用户操作流程
1. **选择图片**: 点击"选择照片"从相册选择图片
2. **预览编辑**: 查看选中的图片，可删除不需要的
3. **开始生成**: 点击"生成PDF"开始处理
4. **等待处理**: 查看上传和生成进度
5. **预览下载**: 生成完成后预览PDF并下载保存

### API接口说明
- `POST /api/auth/login` - 用户登录认证
- `POST /api/file/upload` - 图片文件上传
- `POST /api/pdf/generate` - 生成PDF请求
- `GET /api/pdf/status/:taskId` - 查询生成状态
- `GET /api/pdf/download/:taskId` - 下载PDF文件
- `GET /api/pdf/history` - 获取历史记录

## 🔧 开发指南

### 本地开发
```bash
# 启动后端服务
cd server
npm run dev

# 使用微信开发者工具打开前端项目
# 导入 miniprogram 目录
```

### 调试技巧
- 使用微信开发者工具的调试面板
- 查看 Network 面板监控API请求
- 使用真机调试测试完整功能
- 检查 Console 面板的日志输出

### 常见问题
1. **图片选择失败**: 检查相册访问权限
2. **上传失败**: 检查网络连接和服务器状态
3. **PDF预览失败**: 确认微信版本支持文档预览
4. **文件保存失败**: 检查存储权限设置

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进项目。

## 🔍 项目特色

### 用户体验优化
- **智能压缩**: 自动检测图片大小，超过2MB自动压缩
- **实时反馈**: 上传进度、生成状态实时显示
- **错误恢复**: 网络异常自动重试，操作失败友好提示
- **缓存机制**: 智能缓存减少重复请求

### 性能优化
- **分片上传**: 大文件分片上传，提高成功率
- **并发处理**: 服务端支持多任务并发处理
- **资源清理**: 自动清理过期文件，节省存储空间
- **集群部署**: PM2集群模式，提高并发处理能力

### 安全特性
- **文件验证**: 严格的文件格式和大小验证
- **权限控制**: 用户数据隔离，确保隐私安全
- **HTTPS支持**: 全程加密传输
- **定期清理**: 自动清理临时文件和过期数据

## 📊 系统监控

### 日志管理
```bash
# 查看应用日志
pm2 logs pdf-generator

# 查看错误日志
pm2 logs pdf-generator --err

# 查看实时日志
pm2 logs pdf-generator --lines 100
```

### 性能监控
```bash
# 查看进程状态
pm2 status

# 查看详细信息
pm2 show pdf-generator

# 重启应用
pm2 restart pdf-generator

# 重载应用 (零停机)
pm2 reload pdf-generator
```

### 数据库管理
```bash
# 进入数据库目录
cd server/data

# 查看数据库文件
ls -la pdf_history.db

# 备份数据库
cp pdf_history.db pdf_history_backup_$(date +%Y%m%d).db
```

## 🔧 故障排除

### 常见问题及解决方案

#### 1. 服务启动失败
```bash
# 检查端口占用
netstat -tlnp | grep 1919

# 检查PM2状态
pm2 status

# 查看错误日志
pm2 logs pdf-generator --err
```

#### 2. 文件上传失败
- 检查 `uploads` 目录权限
- 确认文件大小限制配置
- 检查磁盘空间是否充足

#### 3. PDF生成失败
- 检查 `pdfs` 目录权限
- 确认 pdf-lib 依赖正常安装
- 查看服务器内存使用情况

#### 4. 小程序无法连接服务器
- 检查服务器域名配置
- 确认微信小程序后台域名白名单
- 验证SSL证书是否有效

### 性能调优建议

#### 服务器优化
```bash
# 增加文件描述符限制
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# 优化内核参数
echo "net.core.somaxconn = 65535" >> /etc/sysctl.conf
sysctl -p
```

#### 应用优化
- 调整PM2集群实例数量
- 配置适当的内存限制
- 启用Nginx gzip压缩
- 配置静态文件缓存

## 📈 扩展功能

### 计划中的功能
- [ ] 图片编辑功能 (裁剪、旋转、滤镜)
- [ ] PDF密码保护
- [ ] 批量处理多个PDF
- [ ] 云存储集成 (阿里云OSS、腾讯云COS)
- [ ] 用户账号系统
- [ ] 高级PDF编辑功能
- [ ] 模板系统
- [ ] 水印添加功能

### 技术升级计划
- [ ] 迁移到TypeScript
- [ ] 引入Redis缓存
- [ ] 实现WebSocket实时通信
- [ ] 添加单元测试
- [ ] 集成CI/CD流水线
- [ ] 容器化部署 (Docker)

## 📚 相关文档

### 开发文档
- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [Express.js 官方文档](https://expressjs.com/)
- [pdf-lib 使用指南](https://pdf-lib.js.org/)
- [PM2 进程管理](https://pm2.keymetrics.io/)

### API文档
详细的API接口文档请参考 `server/routes/` 目录下的各个路由文件。

### 更新日志
- **v1.0.0** (2024-01-01)
  - 初始版本发布
  - 基础PDF生成功能
  - 微信小程序客户端
  - 历史记录管理

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 GitHub Issue
- 发送邮件至项目维护者

## 🙏 致谢

感谢以下开源项目的支持：
- [pdf-lib](https://github.com/Hopding/pdf-lib) - PDF生成库
- [Express.js](https://github.com/expressjs/express) - Web框架
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite数据库
- [PM2](https://github.com/Unitech/pm2) - 进程管理器
