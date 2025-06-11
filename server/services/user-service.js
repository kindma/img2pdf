// services/user-service.js
// 用户管理服务

const crypto = require('crypto');

class UserService {
  constructor() {
    // 用户数据存储（实际项目中应使用数据库）
    this.users = new Map();
    this.sessions = new Map();
  }
  
  // 创建或更新用户
  createOrUpdateUser(openid, userInfo = {}) {
    const now = new Date();
    
    if (this.users.has(openid)) {
      // 更新现有用户
      const user = this.users.get(openid);
      user.lastLoginAt = now;
      user.loginCount = (user.loginCount || 0) + 1;
      
      // 更新用户信息
      if (userInfo.nickName) user.nickName = userInfo.nickName;
      if (userInfo.avatarUrl) user.avatarUrl = userInfo.avatarUrl;
      if (userInfo.gender !== undefined) user.gender = userInfo.gender;
      if (userInfo.country) user.country = userInfo.country;
      if (userInfo.province) user.province = userInfo.province;
      if (userInfo.city) user.city = userInfo.city;
      
      console.log(`用户登录: ${user.nickName || openid}`);
      return user;
    } else {
      // 创建新用户
      const user = {
        openid,
        nickName: userInfo.nickName || `用户${openid.substring(-6)}`,
        avatarUrl: userInfo.avatarUrl || 'https://thirdwx.qlogo.cn/mmopen/vi_32/POgEwh4mIHO4nibH0KlMECNjjGxQUq24ZEaGT4poC6icRiccVGKSyXwibcPq4BWmiaIGuG1icwxaQX6grC9VemZoJ8rg/132',
        gender: userInfo.gender || 0,
        country: userInfo.country || '',
        province: userInfo.province || '',
        city: userInfo.city || '',
        language: userInfo.language || 'zh_CN',
        createdAt: now,
        lastLoginAt: now,
        loginCount: 1,
        usageCount: 0
      };
      
      this.users.set(openid, user);
      console.log(`新用户注册: ${user.nickName}`);
      return user;
    }
  }
  
  // 生成用户token
  generateToken(openid) {
    const payload = {
      openid,
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(2)
    };
    
    // 简单的token生成（实际项目中应使用JWT）
    const token = Buffer.from(JSON.stringify(payload)).toString('base64');
    
    // 存储session
    this.sessions.set(token, {
      openid,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7200000) // 2小时过期
    });
    
    return token;
  }
  
  // 验证token
  verifyToken(token) {
    if (!token) {
      return { valid: false, error: 'Token不存在' };
    }
    
    const session = this.sessions.get(token);
    if (!session) {
      return { valid: false, error: 'Token无效' };
    }
    
    if (new Date() > session.expiresAt) {
      this.sessions.delete(token);
      return { valid: false, error: 'Token已过期' };
    }
    
    return {
      valid: true,
      openid: session.openid
    };
  }
  
  // 获取用户信息
  getUserInfo(openid) {
    const user = this.users.get(openid);
    if (!user) {
      return null;
    }
    
    // 返回安全的用户信息（不包含敏感数据）
    return {
      openid: user.openid,
      nickName: user.nickName,
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      country: user.country,
      province: user.province,
      city: user.city,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      loginCount: user.loginCount,
      usageCount: user.usageCount
    };
  }
  
  // 更新用户使用统计
  updateUsageCount(openid) {
    const user = this.users.get(openid);
    if (user) {
      user.usageCount = (user.usageCount || 0) + 1;
      return user.usageCount;
    }
    return 0;
  }
  
  // 从请求中提取用户ID
  extractUserIdFromRequest(req) {
    // 优先从Authorization头获取token
    let token = req.headers.authorization;
    if (token && token.startsWith('Bearer ')) {
      token = token.substring(7);
    }
    
    // 验证token
    const tokenResult = this.verifyToken(token);
    if (tokenResult.valid) {
      return tokenResult.openid;
    }
    
    // 备用方案：从user-id头获取
    const userId = req.headers['user-id'];
    if (userId && userId !== 'anonymous') {
      return userId;
    }
    
    // 默认返回匿名用户
    return 'anonymous';
  }
  
  // 清理过期session
  cleanupExpiredSessions() {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`清理了 ${cleanedCount} 个过期session`);
    }
    
    return cleanedCount;
  }
  
  // 获取用户统计
  getUserStats() {
    return {
      totalUsers: this.users.size,
      activeSessions: this.sessions.size,
      totalUsage: Array.from(this.users.values()).reduce((sum, user) => sum + (user.usageCount || 0), 0)
    };
  }
}

// 创建单例实例
const userService = new UserService();

// 定期清理过期session
setInterval(() => {
  userService.cleanupExpiredSessions();
}, 30 * 60 * 1000); // 每30分钟清理一次

module.exports = userService;
