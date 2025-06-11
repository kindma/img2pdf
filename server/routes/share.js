const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// 存储分享信息
const shares = {};

// 辅助函数：生成完整的URL
function generateFullUrl(req, path) {
  if (process.env.BASE_URL) {
    // 生产环境使用配置的域名
    return `${process.env.BASE_URL}${path}`;
  } else {
    // 开发环境使用请求头中的域名
    return `${req.protocol}://${req.get('host')}${path}`;
  }
}

// 创建分享
router.post('/create', (req, res) => {
  try {
    const { taskId, options = {} } = req.body;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: '缺少任务ID'
      });
    }
    
    const shareId = uuidv4();
    const expiresAt = options.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 默认7天后过期
    
    shares[shareId] = {
      taskId,
      createdAt: new Date(),
      expiresAt,
      options
    };
    
    // 生成分享链接 - 使用配置的域名
    const shareUrl = generateFullUrl(req, `/share/${shareId}`);
    
    res.json({
      success: true,
      message: '分享创建成功',
      data: {
        shareId,
        shareUrl,
        expiresAt
      }
    });
  } catch (error) {
    console.error('创建分享错误:', error);
    res.status(500).json({
      success: false,
      message: '创建分享失败',
      error: error.message
    });
  }
});

// 获取分享信息
router.get('/:shareId', (req, res) => {
  const { shareId } = req.params;
  
  if (!shares[shareId]) {
    return res.status(404).json({
      success: false,
      message: '分享不存在'
    });
  }
  
  const share = shares[shareId];
  
  // 检查是否过期
  if (new Date() > new Date(share.expiresAt)) {
    return res.status(410).json({
      success: false,
      message: '分享已过期'
    });
  }
  
  res.json({
    success: true,
    data: {
      shareId,
      taskId: share.taskId,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
      downloadUrl: generateFullUrl(req, `/pdfs/${share.taskId}.pdf`)
    }
  });
});

module.exports = router;