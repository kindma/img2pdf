// ecosystem.config.js
// PM2进程管理配置文件

module.exports = {
  apps: [{
    // 应用基本信息
    name: 'pdf-generator',
    script: './app.js',
    cwd: __dirname,
    
    // 集群模式配置
    instances: process.env.NODE_ENV === 'production' ? 'max' : 1,
    exec_mode: process.env.NODE_ENV === 'production' ? 'cluster' : 'fork',
    
    // 环境变量
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 1919,
      SSL_ENABLED: false,
      BASE_URL: 'https://youdomain.com'
    },
    env_production_ssl: {
      NODE_ENV: 'production',
      PORT: 1919,
      SSL_ENABLED: true,
      BASE_URL: 'https://youdomain.com',
      SSL_CERT_PATH: './ssl/cert.pem',
      SSL_KEY_PATH: './ssl/key.pem'
    },
    
    // 日志配置
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // 性能配置
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    
    // 监控配置
    watch: false,
    ignore_watch: [
      'node_modules',
      'logs',
      'uploads',
      'pdfs',
      'data'
    ],
    
    // 重启配置
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // 其他配置
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }],
  
  // 部署配置
  deploy: {
    production: {
      user: 'root',
      host: ['your-server-ip'],
      ref: 'origin/main',
      repo: 'https://github.com/your-username/your-repo.git',
      path: '/opt/pdf-generator',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt-get update && apt-get install -y git nodejs npm',
      env: {
        NODE_ENV: 'production',
        PORT: 1919
      }
    }
  }
};
