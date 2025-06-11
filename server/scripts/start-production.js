#!/usr/bin/env node
// scripts/start-production.js
// 生产环境启动脚本

const fs = require('fs');
const path = require('path');

// 设置生产环境
process.env.NODE_ENV = 'production';

console.log('🚀 启动生产环境服务器...\n');

// 检查生产环境配置
function checkProductionConfig() {
  const configPath = path.join(__dirname, '../.env.production');
  
  if (!fs.existsSync(configPath)) {
    console.error('❌ 生产环境配置文件不存在: .env.production');
    console.log('请创建 .env.production 文件并配置相关参数');
    process.exit(1);
  }
  
  console.log('✅ 生产环境配置文件检查通过');
}

// 检查必要目录
function checkDirectories() {
  const dirs = [
    path.join(__dirname, '../data'),
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../pdfs'),
    path.join(__dirname, '../logs'),
    path.join(__dirname, '../ssl')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 创建目录: ${path.relative(process.cwd(), dir)}`);
    }
  });
  
  console.log('✅ 目录结构检查完成');
}

// 检查SSL证书
function checkSSLCertificates() {
  const sslEnabled = process.env.SSL_ENABLED === 'true';
  
  if (!sslEnabled) {
    console.log('ℹ️  SSL未启用，将使用HTTP模式');
    return;
  }
  
  const certPath = path.join(__dirname, '../ssl/cert.pem');
  const keyPath = path.join(__dirname, '../ssl/key.pem');
  
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.error('❌ SSL证书文件不存在');
    console.log('请将SSL证书文件放置到 ssl/ 目录下:');
    console.log('- ssl/cert.pem (证书文件)');
    console.log('- ssl/key.pem (私钥文件)');
    console.log('- ssl/ca.pem (CA证书文件，可选)');
    console.log('\n或设置 SSL_ENABLED=false 使用HTTP模式');
    process.exit(1);
  }
  
  console.log('✅ SSL证书文件检查通过');
}

// 检查端口占用
function checkPort() {
  const net = require('net');
  const port = process.env.PORT || 1919;
  
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        console.log(`✅ 端口 ${port} 可用`);
        resolve();
      });
      server.close();
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ 端口 ${port} 已被占用`);
        console.log('请检查是否有其他服务占用该端口，或修改 PORT 配置');
        reject(err);
      } else {
        reject(err);
      }
    });
  });
}

// 主启动函数
async function startProduction() {
  try {
    console.log('📋 执行生产环境检查...\n');
    
    // 1. 检查配置文件
    checkProductionConfig();
    
    // 2. 检查目录结构
    checkDirectories();
    
    // 3. 检查SSL证书
    checkSSLCertificates();
    
    // 4. 检查端口
    await checkPort();
    
    console.log('\n🎯 所有检查通过，启动应用服务器...\n');
    
    // 启动应用
    require('../app.js');
    
  } catch (error) {
    console.error('\n❌ 生产环境启动失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  startProduction();
}

module.exports = { startProduction };
