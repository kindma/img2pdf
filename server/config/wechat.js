// config/wechat.js
// 微信小程序配置

class WeChatConfig {
  constructor() {
    // 微信小程序配置
    this.appId = process.env.WECHAT_APP_ID || '';
    this.appSecret = process.env.WECHAT_APP_SECRET || '';
    
    // API地址
    this.apiBaseUrl = 'https://api.weixin.qq.com';
    this.code2SessionUrl = `${this.apiBaseUrl}/sns/jscode2session`;
    
    // 验证配置
    this.validateConfig();
  }
  
  // 验证配置
  validateConfig() {
    if (!this.appId || !this.appSecret) {
      console.warn('⚠️  微信小程序配置不完整，将使用模拟模式');
      console.warn('请设置环境变量: WECHAT_APP_ID 和 WECHAT_APP_SECRET');
      this.mockMode = true;
    } else {
      console.log('✅ 微信小程序配置已加载');
      this.mockMode = false;
    }
  }
  
  // 获取配置信息
  getConfig() {
    return {
      appId: this.appId,
      appSecret: this.appSecret,
      mockMode: this.mockMode
    };
  }
  
  // 构建code2session请求URL
  buildCode2SessionUrl(code) {
    const params = new URLSearchParams({
      appid: this.appId,
      secret: this.appSecret,
      js_code: code,
      grant_type: 'authorization_code'
    });
    
    return `${this.code2SessionUrl}?${params.toString()}`;
  }
}

module.exports = WeChatConfig;
