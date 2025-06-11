#!/usr/bin/env node
// scripts/generate-test-ssl.js
// 生成测试用的自签名SSL证书

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function generateTestSSL() {
  console.log('🔐 生成测试用SSL证书...');
  
  const sslDir = path.join(__dirname, '../ssl');
  
  // 确保SSL目录存在
  if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
    console.log('📁 创建SSL目录:', sslDir);
  }
  
  const keyPath = path.join(sslDir, 'key.pem');
  const certPath = path.join(sslDir, 'cert.pem');
  
  try {
    // 检查是否已存在证书
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      console.log('✅ SSL证书已存在，跳过生成');
      return true;
    }
    
    console.log('正在生成私钥...');
    // 生成私钥
    execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: 'pipe' });
    
    console.log('正在生成证书...');
    // 生成自签名证书
    const certCommand = `openssl req -new -x509 -key "${keyPath}" -out "${certPath}" -days 365 -subj "/C=CN/ST=Beijing/L=Beijing/O=Test/CN=localhost"`;
    execSync(certCommand, { stdio: 'pipe' });
    
    // 设置权限
    fs.chmodSync(keyPath, 0o600);
    fs.chmodSync(certPath, 0o644);
    
    console.log('✅ 测试SSL证书生成完成');
    console.log(`📄 证书文件: ${certPath}`);
    console.log(`🔑 私钥文件: ${keyPath}`);
    console.log('⚠️  警告: 这是测试证书，仅用于开发环境');
    
    return true;
  } catch (error) {
    console.error('❌ 生成SSL证书失败:', error.message);
    console.log('\n可能的解决方案:');
    console.log('1. 确保系统已安装 openssl');
    console.log('2. 手动创建证书文件');
    console.log('3. 设置 SSL_ENABLED=false 使用HTTP模式');
    return false;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  generateTestSSL();
}

module.exports = { generateTestSSL };
