// services/wechat-service.js
// 微信API服务

const https = require('https');
const WeChatConfig = require('../config/wechat');

class WeChatService {
  constructor() {
    this.config = new WeChatConfig();
  }
  
  // 通过code获取openid和session_key
  async code2Session(code) {
    if (this.config.mockMode) {
      // 模拟模式
      console.log('🔧 使用模拟模式进行微信登录');
      return this.mockCode2Session(code);
    }
    
    try {
      const url = this.config.buildCode2SessionUrl(code);
      const response = await this.httpsRequest(url);
      
      if (response.errcode) {
        throw new Error(`微信API错误: ${response.errcode} - ${response.errmsg}`);
      }
      
      return {
        success: true,
        data: {
          openid: response.openid,
          session_key: response.session_key,
          unionid: response.unionid
        }
      };
    } catch (error) {
      console.error('微信code2session失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // 模拟微信登录
  mockCode2Session(code) {
    console.log('📋 模拟微信登录，code:', code);
    
    // 生成模拟的openid（基于code生成，保证同一个code返回同一个openid）
    const hash = this.simpleHash(code);
    const mockOpenId = `mock_openid_${hash}`;
    const mockSessionKey = `mock_session_${Math.random().toString(36).substring(2, 15)}`;
    
    return {
      success: true,
      data: {
        openid: mockOpenId,
        session_key: mockSessionKey,
        unionid: null
      },
      mock: true
    };
  }
  
  // 简单哈希函数
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }
  
  // HTTPS请求封装
  httpsRequest(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (error) {
            reject(new Error('响应解析失败'));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
    });
  }
  
  // 验证session_key是否有效
  async checkSessionKey(openid, sessionKey) {
    // 实际项目中可以通过解密数据来验证session_key
    // 这里简化处理
    if (this.config.mockMode) {
      return { valid: true, mock: true };
    }
    
    // 真实环境中的验证逻辑
    return { valid: true };
  }
  
  // 解密用户数据
  decryptUserData(encryptedData, iv, sessionKey) {
    if (this.config.mockMode) {
      // 模拟解密结果
      return {
        success: true,
        data: {
          nickName: '微信用户' + Math.floor(Math.random() * 1000),
          avatarUrl: 'https://thirdwx.qlogo.cn/mmopen/vi_32/POgEwh4mIHO4nibH0KlMECNjjGxQUq24ZEaGT4poC6icRiccVGKSyXwibcPq4BWmiaIGuG1icwxaQX6grC9VemZoJ8rg/132',
          gender: Math.floor(Math.random() * 3),
          country: '中国',
          province: '广东',
          city: '深圳',
          language: 'zh_CN'
        },
        mock: true
      };
    }
    
    // 真实环境中的解密逻辑
    // 需要使用crypto模块进行AES解密
    try {
      const crypto = require('crypto');
      const decipher = crypto.createDecipheriv('aes-128-cbc', 
        Buffer.from(sessionKey, 'base64'), 
        Buffer.from(iv, 'base64')
      );
      
      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return {
        success: true,
        data: JSON.parse(decrypted)
      };
    } catch (error) {
      return {
        success: false,
        error: '解密失败'
      };
    }
  }
}

module.exports = WeChatService;
