const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const https = require('https');
const http = require('http');

// 加载环境变量
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: envFile });

// 导入SSL配置
const SSLConfig = require('./config/ssl');

// 导入路由
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/file');
const pdfRoutes = require('./routes/pdf');
const shareRoutes = require('./routes/share');
const statsRoutes = require('./routes/stats');
const cleanupRoutes = require('./routes/cleanup');

// 导入清理服务
const CleanupService = require('./services/cleanup-service');

// 创建 Express 应用
const app = express();
const PORT = process.env.PORT || 3000;

// 确保上传目录存在
const uploadDir = path.join(__dirname, 'uploads');
const pdfDir = path.join(__dirname, 'pdfs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

// 中间件
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/pdfs', express.static(path.join(__dirname, 'pdfs')));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/file', fileRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/cleanup', cleanupRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 初始化SSL配置
const sslConfig = new SSLConfig();

// 初始化清理服务
const cleanupService = new CleanupService();

// 创建服务器
function createServer() {
  const sslOptions = sslConfig.getSSLOptions();

  if (sslOptions) {
    // 创建HTTPS服务器
    console.log('启用HTTPS模式');
    return https.createServer(sslOptions, app);
  } else {
    // 创建HTTP服务器
    console.log('启用HTTP模式');
    return http.createServer(app);
  }
}

// 启动服务器
function startServer() {
  try {
    // 验证SSL配置（如果启用）
    if (process.env.SSL_ENABLED === 'true') {
      const validation = sslConfig.validateSSLConfig();
      if (!validation.valid) {
        console.error('SSL配置验证失败:');
        validation.errors.forEach(error => console.error(`- ${error}`));

        // 尝试创建SSL目录和说明文件
        sslConfig.createSSLDirectory();

        console.log('\n请配置SSL证书后重新启动服务器');
        console.log('或设置 SSL_ENABLED=false 使用HTTP模式');
        process.exit(1);
      }
    }

    const server = createServer();

    server.listen(PORT, () => {
      const protocol = process.env.SSL_ENABLED === 'true' ? 'https' : 'http';
      console.log(`\n🚀 服务器启动成功!`);
      console.log(`📍 地址: ${protocol}://localhost:${PORT}`);
      console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔒 SSL: ${process.env.SSL_ENABLED === 'true' ? '已启用' : '未启用'}`);

      // 启动清理服务
      cleanupService.start();
    });

    // 优雅关闭处理
    const gracefulShutdown = (signal) => {
      console.log(`\n收到 ${signal} 信号，正在关闭服务器...`);

      server.close(() => {
        console.log('HTTP服务器已关闭');
        cleanupService.stop();
        process.exit(0);
      });

      // 强制关闭超时
      setTimeout(() => {
        console.error('强制关闭服务器');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    return server;
  } catch (error) {
    console.error('服务器启动失败:', error.message);
    process.exit(1);
  }
}

// 启动服务器
const server = startServer();

module.exports = app;