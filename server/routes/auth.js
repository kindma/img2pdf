const express = require('express');
const router = express.Router();
const WeChatService = require('../services/wechat-service');
const userService = require('../services/user-service');

// 微信小程序登录
router.post('/login', async (req, res) => {
  try {
    const { code, userInfo } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: '缺少登录码'
      });
    }

    console.log('🔐 用户登录请求，code:', code);

    // 调用微信API获取openid和session_key
    const wechatService = new WeChatService();
    const wechatResult = await wechatService.code2Session(code);

    if (!wechatResult.success) {
      return res.status(400).json({
        success: false,
        message: '微信登录失败',
        error: wechatResult.error
      });
    }

    const { openid, session_key } = wechatResult.data;
    console.log('✅ 微信登录成功，openid:', openid);

    // 创建或更新用户信息
    const user = userService.createOrUpdateUser(openid, userInfo);

    // 生成token
    const token = userService.generateToken(openid);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        expiresIn: 7200, // 2小时过期
        user: {
          openid: user.openid,
          nickName: user.nickName,
          avatarUrl: user.avatarUrl,
          isNewUser: user.loginCount === 1
        },
        mock: wechatResult.mock || false
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      message: '登录失败',
      error: error.message
    });
  }
});

// 获取用户信息
router.get('/user/info', (req, res) => {
  try {
    // 从请求中提取用户ID
    const userId = userService.extractUserIdFromRequest(req);

    if (userId === 'anonymous') {
      return res.status(401).json({
        success: false,
        message: '用户未登录'
      });
    }

    // 获取用户信息
    const userInfo = userService.getUserInfo(userId);

    if (!userInfo) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: userInfo
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败',
      error: error.message
    });
  }
});

// 用户统计接口
router.get('/user/stats', (req, res) => {
  try {
    const stats = userService.getUserStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取用户统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取统计失败',
      error: error.message
    });
  }
});

module.exports = router;