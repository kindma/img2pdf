const express = require('express');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const PDFHistoryDB = require('../database/pdf-history-db-simple');
const userService = require('../services/user-service');

// 存储任务状态（临时状态，仍使用内存）
const tasks = {};

// 初始化数据库
const historyDB = new PDFHistoryDB();

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

// 生成PDF
router.post('/generate', async (req, res) => {
  try {
    const { images } = req.body;
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的图片列表'
      });
    }
    
    // 创建任务ID
    const taskId = uuidv4();

    // 获取用户信息（从token中获取真实用户ID）
    const userId = userService.extractUserIdFromRequest(req);
    console.log('📋 PDF生成请求，用户ID:', userId);

    // 初始化任务状态
    tasks[taskId] = {
      status: 'processing',
      progress: 0,
      totalImages: images.length,
      processedImages: 0,
      createdAt: new Date(),
      userId: userId,
      images: images,
      result: null
    };
    
    // 异步处理PDF生成
    generatePDF(taskId, images);
    
    res.json({
      success: true,
      message: 'PDF生成任务已创建',
      data: {
        taskId,
        status: 'processing'
      }
    });
  } catch (error) {
    console.error('PDF生成错误:', error);
    res.status(500).json({
      success: false,
      message: 'PDF生成失败',
      error: error.message
    });
  }
});

// 查询生成状态
router.get('/status/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  if (!tasks[taskId]) {
    return res.status(404).json({
      success: false,
      message: '任务不存在'
    });
  }
  
  res.json({
    success: true,
    data: tasks[taskId]
  });
});

// 获取PDF下载链接
router.get('/download/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  if (!tasks[taskId] || tasks[taskId].status !== 'completed') {
    return res.status(404).json({
      success: false,
      message: '任务不存在或尚未完成'
    });
  }
  
  // 构建下载URL
  const downloadUrl = generateFullUrl(req, `/pdfs/${taskId}.pdf`);

  res.json({
    success: true,
    data: {
      downloadUrl: downloadUrl,
      filename: `document_${taskId.substring(0, 8)}.pdf`
    }
  });
});

// 获取分享链接
router.get('/share/:taskId', (req, res) => {
  const { taskId } = req.params;

  if (!tasks[taskId] || tasks[taskId].status !== 'completed') {
    return res.status(404).json({
      success: false,
      message: '任务不存在或尚未完成'
    });
  }

  // 生成分享链接
  const shareUrl = generateFullUrl(req, `/share/${taskId}`);

  res.json({
    success: true,
    data: {
      shareUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天后过期
    }
  });
});

// 获取PDF生成历史记录
router.get('/history', (req, res) => {
  try {
    const { limit = 50, offset = 0, userId } = req.query;

    // 获取真实的用户ID（openid）
    let actualUserId = null;

    if (userId) {
      // 如果传递了userId参数，检查是否为token
      const tokenResult = userService.verifyToken(userId);
      if (tokenResult.valid) {
        // 如果是有效token，提取openid
        actualUserId = tokenResult.openid;
        console.log('📋 从token提取用户ID:', actualUserId);
      } else {
        // 如果不是token，直接使用（可能是直接传递的openid）
        actualUserId = userId;
        console.log('📋 直接使用用户ID:', actualUserId);
      }
    } else {
      // 如果没有传递userId，尝试从Authorization头获取
      actualUserId = userService.extractUserIdFromRequest(req);
      console.log('📋 从请求头提取用户ID:', actualUserId);
    }

    // 使用数据库查询历史记录
    const records = historyDB.getHistory(actualUserId === 'anonymous' ? null : actualUserId, parseInt(limit), parseInt(offset));
    const total = historyDB.getHistoryCount(actualUserId === 'anonymous' ? null : actualUserId);

    res.json({
      success: true,
      data: {
        records: records,
        total: total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        userId: actualUserId // 返回实际使用的用户ID
      }
    });
  } catch (error) {
    console.error('获取历史记录错误:', error);
    res.status(500).json({
      success: false,
      message: '获取历史记录失败'
    });
  }
});

// 获取单个历史记录详情
router.get('/history/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;

    const record = historyDB.getHistoryDetail(taskId);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '历史记录不存在'
      });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('获取历史记录详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取历史记录详情失败'
    });
  }
});

// 删除历史记录
router.delete('/history/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;

    // 先获取记录详情以便删除文件
    const record = historyDB.getHistoryDetail(taskId);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '历史记录不存在'
      });
    }

    // 删除PDF文件
    if (record.pdf_path && fs.existsSync(record.pdf_path)) {
      fs.unlinkSync(record.pdf_path);
    }

    // 删除数据库记录
    const deleteCount = historyDB.deleteHistory(taskId);

    res.json({
      success: true,
      message: '历史记录已删除',
      deletedCount: deleteCount
    });
  } catch (error) {
    console.error('删除历史记录错误:', error);
    res.status(500).json({
      success: false,
      message: '删除历史记录失败'
    });
  }
});

// 清空历史记录
router.delete('/history', (req, res) => {
  try {
    const { userId } = req.query;

    // 获取真实的用户ID（openid）
    let actualUserId = null;

    if (userId) {
      // 如果传递了userId参数，检查是否为token
      const tokenResult = userService.verifyToken(userId);
      if (tokenResult.valid) {
        // 如果是有效token，提取openid
        actualUserId = tokenResult.openid;
        console.log('📋 清空历史记录，从token提取用户ID:', actualUserId);
      } else {
        // 如果不是token，直接使用（可能是直接传递的openid）
        actualUserId = userId;
        console.log('📋 清空历史记录，直接使用用户ID:', actualUserId);
      }
    }

    if (actualUserId && actualUserId !== 'anonymous') {
      // 删除指定用户的历史记录
      // 先获取用户的所有记录以便删除文件
      const userRecords = historyDB.getHistory(actualUserId);

      // 删除对应的PDF文件
      userRecords.forEach(record => {
        if (record.pdf_path && fs.existsSync(record.pdf_path)) {
          fs.unlinkSync(record.pdf_path);
        }
      });

      // 从数据库中删除用户记录
      const deleteCount = historyDB.clearUserHistory(actualUserId);

      res.json({
        success: true,
        message: `用户 ${actualUserId} 的历史记录已清空`,
        deletedCount: deleteCount
      });
    } else {
      // 清空所有历史记录
      const allRecords = historyDB.getHistory();

      // 删除所有PDF文件
      allRecords.forEach(record => {
        if (record.pdf_path && fs.existsSync(record.pdf_path)) {
          fs.unlinkSync(record.pdf_path);
        }
      });

      // 清空数据库
      const deleteCount = historyDB.clearUserHistory(); // 不传userId则清空所有

      res.json({
        success: true,
        message: '所有历史记录已清空',
        deletedCount: deleteCount
      });
    }
  } catch (error) {
    console.error('清空历史记录错误:', error);
    res.status(500).json({
      success: false,
      message: '清空历史记录失败'
    });
  }
});

// PDF生成函数
async function generatePDF(taskId, images) {
  try {
    const pdfDoc = await PDFDocument.create();
    const uploadsDir = path.join(__dirname, '../uploads');
    const pdfDir = path.join(__dirname, '../pdfs');

    console.log(`开始生成PDF，任务ID: ${taskId}，图片数量: ${images.length}`);

    for (let i = 0; i < images.length; i++) {
      const imageInfo = images[i];
      console.log(`处理第${i + 1}张图片:`, imageInfo);

      // 根据图片信息查找对应的文件
      let imagePath;

      if (typeof imageInfo === 'string') {
        // 如果是字符串，直接作为文件名
        imagePath = path.join(uploadsDir, imageInfo);
      } else if (imageInfo && (imageInfo.filename || imageInfo.id)) {
        // 优先使用filename，其次使用id
        let targetFile = imageInfo.filename;

        if (!targetFile && imageInfo.id) {
          // 如果没有filename，根据id查找文件
          const files = fs.readdirSync(uploadsDir);
          targetFile = files.find(file => file.startsWith(imageInfo.id));
        }

        if (!targetFile) {
          console.error(`找不到图片文件，imageInfo:`, imageInfo);
          continue;
        }

        imagePath = path.join(uploadsDir, targetFile);
      } else {
        console.error(`无效的图片信息:`, imageInfo);
        continue;
      }

      if (!fs.existsSync(imagePath)) {
        console.error(`图片文件不存在: ${imagePath}`);
        continue;
      }

      console.log(`读取图片文件: ${imagePath}`);
      const imageBytes = fs.readFileSync(imagePath);
      let pdfImage;

      // 根据图片类型添加到PDF
      const ext = path.extname(imagePath).toLowerCase();
      if (ext === '.jpg' || ext === '.jpeg') {
        pdfImage = await pdfDoc.embedJpg(imageBytes);
      } else if (ext === '.png') {
        pdfImage = await pdfDoc.embedPng(imageBytes);
      } else {
        console.error(`不支持的图片类型: ${imagePath}`);
        continue;
      }

      // 创建页面，设置合适的尺寸
      const pageWidth = 595; // A4宽度
      const pageHeight = 842; // A4高度

      // 计算图片缩放比例以适应页面
      const scaleX = pageWidth / pdfImage.width;
      const scaleY = pageHeight / pdfImage.height;
      const scale = Math.min(scaleX, scaleY);

      const scaledWidth = pdfImage.width * scale;
      const scaledHeight = pdfImage.height * scale;

      // 居中显示
      const x = (pageWidth - scaledWidth) / 2;
      const y = (pageHeight - scaledHeight) / 2;

      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      page.drawImage(pdfImage, {
        x: x,
        y: y,
        width: scaledWidth,
        height: scaledHeight
      });

      console.log(`第${i + 1}张图片处理完成`);

      // 更新进度
      tasks[taskId].processedImages = i + 1;
      tasks[taskId].progress = Math.round(((i + 1) / images.length) * 100);
    }
    
    // 保存PDF
    const pdfBytes = await pdfDoc.save();
    const pdfPath = path.join(pdfDir, `${taskId}.pdf`);
    fs.writeFileSync(pdfPath, pdfBytes);
    
    // 更新任务状态
    tasks[taskId].status = 'completed';
    tasks[taskId].progress = 100;
    tasks[taskId].completedAt = new Date();
    tasks[taskId].result = {
      pdfPath,
      size: pdfBytes.length,
      pageCount: pdfDoc.getPageCount()
    };

    // 添加到数据库历史记录
    const historyRecord = {
      taskId: taskId,
      userId: tasks[taskId].userId || 'anonymous',
      filename: `document_${taskId.substring(0, 8)}.pdf`,
      originalImages: tasks[taskId].images || [],
      imageCount: tasks[taskId].totalImages || 0,
      pdfPath: pdfPath,
      fileSize: pdfBytes.length,
      pageCount: pdfDoc.getPageCount(),
      status: 'completed',
      createdAt: tasks[taskId].createdAt,
      completedAt: new Date(),
      downloadUrl: process.env.BASE_URL ? `${process.env.BASE_URL}/pdfs/${taskId}.pdf` : `/pdfs/${taskId}.pdf`,
      processingTime: new Date() - tasks[taskId].createdAt,
      metadata: {
        version: '1.0'
      }
    };

    try {
      const recordId = historyDB.addHistory(historyRecord);
      console.log(`PDF生成完成: ${pdfPath}`);
      console.log(`历史记录已添加到数据库，记录ID: ${recordId}`);
    } catch (dbError) {
      console.error('添加历史记录到数据库失败:', dbError);
      // 即使数据库操作失败，PDF生成仍然成功
    }

    // 清理上传的图片文件
    try {
      console.log('开始清理上传的图片文件...');
      let deletedCount = 0;

      for (const image of tasks[taskId].images) {
        const imagePath = path.join(__dirname, '../uploads', image.filename);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          deletedCount++;
          console.log(`已删除图片文件: ${image.filename}`);
        }
      }

      console.log(`图片清理完成，共删除 ${deletedCount} 个文件`);
    } catch (cleanupError) {
      console.error('清理图片文件失败:', cleanupError);
      // 清理失败不影响PDF生成结果
    }
  } catch (error) {
    console.error(`PDF生成失败: ${error.message}`);
    tasks[taskId].status = 'failed';
    tasks[taskId].error = error.message;
  }
}

module.exports = router;