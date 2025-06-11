// config/ssl.js
// SSL证书配置模块

const fs = require('fs');
const path = require('path');

class SSLConfig {
  constructor() {
    this.sslEnabled = process.env.SSL_ENABLED === 'true';
    this.certPath = process.env.SSL_CERT_PATH || './ssl/cert.pem';
    this.keyPath = process.env.SSL_KEY_PATH || './ssl/key.pem';
    this.caPath = process.env.SSL_CA_PATH || './ssl/ca.pem';
  }

  // 获取SSL选项
  getSSLOptions() {
    if (!this.sslEnabled) {
      console.log('SSL未启用，使用HTTP模式');
      return null;
    }

    try {
      const options = {};

      // 读取证书文件
      const certFullPath = path.resolve(this.certPath);
      const keyFullPath = path.resolve(this.keyPath);

      if (!fs.existsSync(certFullPath)) {
        throw new Error(`SSL证书文件不存在: ${certFullPath}`);
      }

      if (!fs.existsSync(keyFullPath)) {
        throw new Error(`SSL私钥文件不存在: ${keyFullPath}`);
      }

      options.cert = fs.readFileSync(certFullPath);
      options.key = fs.readFileSync(keyFullPath);

      // 可选的CA证书
      const caFullPath = path.resolve(this.caPath);
      if (fs.existsSync(caFullPath)) {
        options.ca = fs.readFileSync(caFullPath);
        console.log('已加载CA证书文件');
      }

      console.log('SSL证书配置成功');
      console.log(`证书文件: ${certFullPath}`);
      console.log(`私钥文件: ${keyFullPath}`);

      return options;
    } catch (error) {
      console.error('SSL配置失败:', error.message);
      throw error;
    }
  }

  // 验证SSL配置
  validateSSLConfig() {
    if (!this.sslEnabled) {
      return { valid: true, message: 'SSL未启用' };
    }

    const errors = [];

    // 检查证书文件
    if (!fs.existsSync(path.resolve(this.certPath))) {
      errors.push(`证书文件不存在: ${this.certPath}`);
    }

    // 检查私钥文件
    if (!fs.existsSync(path.resolve(this.keyPath))) {
      errors.push(`私钥文件不存在: ${this.keyPath}`);
    }

    // 检查文件权限
    try {
      fs.accessSync(path.resolve(this.certPath), fs.constants.R_OK);
      fs.accessSync(path.resolve(this.keyPath), fs.constants.R_OK);
    } catch (error) {
      errors.push('SSL文件权限不足，请检查文件读取权限');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, message: 'SSL配置验证通过' };
  }

  // 创建SSL目录和示例文件
  createSSLDirectory() {
    const sslDir = path.resolve('./ssl');
    
    if (!fs.existsSync(sslDir)) {
      fs.mkdirSync(sslDir, { recursive: true });
      console.log('已创建SSL目录:', sslDir);
    }

    // 创建README文件
    const readmePath = path.join(sslDir, 'README.md');
    if (!fs.existsSync(readmePath)) {
      const readmeContent = `# SSL证书配置

## 文件说明
- \`cert.pem\` - SSL证书文件
- \`key.pem\` - SSL私钥文件  
- \`ca.pem\` - CA证书文件（可选）

## 获取SSL证书

### 1. 使用Let's Encrypt（免费）
\`\`\`bash
# 安装certbot
sudo apt-get install certbot

# 获取证书
sudo certbot certonly --standalone -d yourdomain.com

# 证书文件位置
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem -> cert.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem -> key.pem
\`\`\`

### 2. 使用阿里云SSL证书
1. 在阿里云控制台申请SSL证书
2. 下载证书文件
3. 将证书文件重命名并放置到此目录

### 3. 自签名证书（仅用于测试）
\`\`\`bash
# 生成私钥
openssl genrsa -out key.pem 2048

# 生成证书
openssl req -new -x509 -key key.pem -out cert.pem -days 365
\`\`\`

## 文件权限
确保证书文件权限正确：
\`\`\`bash
chmod 600 key.pem
chmod 644 cert.pem
\`\`\`
`;
      fs.writeFileSync(readmePath, readmeContent);
      console.log('已创建SSL配置说明文件');
    }
  }

  // 生成自签名证书（仅用于开发测试）
  generateSelfSignedCert() {
    const { execSync } = require('child_process');
    const sslDir = path.resolve('./ssl');

    try {
      console.log('正在生成自签名SSL证书（仅用于测试）...');

      // 生成私钥
      execSync(`openssl genrsa -out ${path.join(sslDir, 'key.pem')} 2048`, { stdio: 'inherit' });

      // 生成证书
      const certCommand = `openssl req -new -x509 -key ${path.join(sslDir, 'key.pem')} -out ${path.join(sslDir, 'cert.pem')} -days 365 -subj "/C=CN/ST=State/L=City/O=Organization/CN=localhost"`;
      execSync(certCommand, { stdio: 'inherit' });

      console.log('自签名SSL证书生成完成');
      console.log('⚠️  警告: 自签名证书仅用于开发测试，生产环境请使用正式SSL证书');

      return true;
    } catch (error) {
      console.error('生成自签名证书失败:', error.message);
      console.log('请手动生成SSL证书或使用HTTP模式');
      return false;
    }
  }
}

module.exports = SSLConfig;
