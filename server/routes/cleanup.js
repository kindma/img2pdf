// routes/cleanup.js
// 数据清理管理API

const express = require('express');
const router = express.Router();
const CleanupService = require('../services/cleanup-service');

// 创建清理服务实例
const cleanupService = new CleanupService();

// 获取清理统计信息
router.get('/stats', (req, res) => {
  try {
    const stats = cleanupService.getCleanupStats();
    
    if (!stats) {
      return res.status(500).json({
        success: false,
        message: '获取清理统计信息失败'
      });
    }
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取清理统计信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取清理统计信息失败'
    });
  }
});

// 手动执行清理
router.post('/manual', (req, res) => {
  try {
    const { beforeDate } = req.body;
    
    let cleanupDate;
    if (beforeDate) {
      cleanupDate = new Date(beforeDate);
      if (isNaN(cleanupDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: '无效的日期格式'
        });
      }
    } else {
      // 默认清理当前时间之前的所有数据
      cleanupDate = new Date();
    }
    
    console.log(`收到手动清理请求，清理 ${cleanupDate.toLocaleString()} 之前的数据`);
    
    const result = cleanupService.manualCleanup(cleanupDate);
    
    res.json({
      success: true,
      message: '手动清理完成',
      data: {
        deletedPdfCount: result.deletedPdfCount,
        deletedRecordCount: result.deletedRecordCount,
        cleanupDate: cleanupDate.toISOString()
      }
    });
  } catch (error) {
    console.error('手动清理错误:', error);
    res.status(500).json({
      success: false,
      message: '手动清理失败'
    });
  }
});

// 清理今天之前的所有数据
router.post('/cleanup-old', (req, res) => {
  try {
    // 获取今天开始的时间点
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log(`清理 ${today.toLocaleString()} 之前的所有数据`);
    
    const result = cleanupService.manualCleanup(today);
    
    res.json({
      success: true,
      message: '历史数据清理完成',
      data: {
        deletedPdfCount: result.deletedPdfCount,
        deletedRecordCount: result.deletedRecordCount,
        cleanupDate: today.toISOString()
      }
    });
  } catch (error) {
    console.error('清理历史数据错误:', error);
    res.status(500).json({
      success: false,
      message: '清理历史数据失败'
    });
  }
});

// 更新清理配置
router.put('/config', (req, res) => {
  try {
    const { retentionHours, cleanupIntervalMinutes, autoCleanup } = req.body;
    
    const newConfig = {};
    
    if (retentionHours !== undefined) {
      if (retentionHours < 1 || retentionHours > 168) { // 1小时到7天
        return res.status(400).json({
          success: false,
          message: '数据保留时间必须在1-168小时之间'
        });
      }
      newConfig.retentionTime = retentionHours * 60 * 60 * 1000;
    }
    
    if (cleanupIntervalMinutes !== undefined) {
      if (cleanupIntervalMinutes < 10 || cleanupIntervalMinutes > 1440) { // 10分钟到24小时
        return res.status(400).json({
          success: false,
          message: '清理间隔必须在10-1440分钟之间'
        });
      }
      newConfig.cleanupInterval = cleanupIntervalMinutes * 60 * 1000;
    }
    
    if (autoCleanup !== undefined) {
      newConfig.autoCleanup = Boolean(autoCleanup);
    }
    
    cleanupService.updateConfig(newConfig);
    
    res.json({
      success: true,
      message: '清理配置已更新',
      data: cleanupService.config
    });
  } catch (error) {
    console.error('更新清理配置错误:', error);
    res.status(500).json({
      success: false,
      message: '更新清理配置失败'
    });
  }
});

// 获取当前清理配置
router.get('/config', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        retentionHours: cleanupService.config.retentionTime / 1000 / 60 / 60,
        cleanupIntervalMinutes: cleanupService.config.cleanupInterval / 1000 / 60,
        autoCleanup: cleanupService.config.autoCleanup,
        isRunning: cleanupService.isRunning
      }
    });
  } catch (error) {
    console.error('获取清理配置错误:', error);
    res.status(500).json({
      success: false,
      message: '获取清理配置失败'
    });
  }
});

// 启动清理服务
router.post('/start', (req, res) => {
  try {
    cleanupService.start();
    res.json({
      success: true,
      message: '清理服务已启动'
    });
  } catch (error) {
    console.error('启动清理服务错误:', error);
    res.status(500).json({
      success: false,
      message: '启动清理服务失败'
    });
  }
});

// 停止清理服务
router.post('/stop', (req, res) => {
  try {
    cleanupService.stop();
    res.json({
      success: true,
      message: '清理服务已停止'
    });
  } catch (error) {
    console.error('停止清理服务错误:', error);
    res.status(500).json({
      success: false,
      message: '停止清理服务失败'
    });
  }
});

module.exports = router;
