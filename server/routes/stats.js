const express = require('express');
const router = express.Router();

// 简单的内存存储，实际应用中应使用数据库
const usageStats = [];

// 记录使用统计
router.post('/usage', (req, res) => {
  try {
    const { action, data = {} } = req.body;
    
    if (!action) {
      return res.status(400).json({
        success: false,
        message: '缺少操作类型'
      });
    }
    
    const stat = {
      id: usageStats.length + 1,
      action,
      data,
      timestamp: new Date(),
      ip: req.ip
    };
    
    usageStats.push(stat);
    
    res.json({
      success: true,
      message: '统计记录成功'
    });
  } catch (error) {
    console.error('记录统计错误:', error);
    res.status(500).json({
      success: false,
      message: '记录统计失败'
    });
  }
});

// 获取使用统计
router.get('/usage', (req, res) => {
  try {
    const { limit = 100, action } = req.query;

    let filteredStats = usageStats;

    // 按操作类型过滤
    if (action) {
      filteredStats = usageStats.filter(stat => stat.action === action);
    }

    // 限制返回数量
    const limitedStats = filteredStats
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      data: limitedStats,
      total: filteredStats.length
    });
  } catch (error) {
    console.error('获取统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取统计失败'
    });
  }
});

// 获取统计摘要
router.get('/summary', (req, res) => {
  try {
    const summary = {
      total: usageStats.length,
      actions: {}
    };

    // 统计各种操作的数量
    usageStats.forEach(stat => {
      if (summary.actions[stat.action]) {
        summary.actions[stat.action]++;
      } else {
        summary.actions[stat.action] = 1;
      }
    });

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('获取统计摘要错误:', error);
    res.status(500).json({
      success: false,
      message: '获取统计摘要失败'
    });
  }
});

module.exports = router;