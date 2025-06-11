const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// 配置文件存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// 上传单个文件
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: '没有文件上传'
    });
  }

  const fileInfo = {
    id: path.parse(req.file.filename).name,
    originalName: req.file.originalname,
    filename: req.file.filename,
    path: req.file.path,
    size: req.file.size,
    mimetype: req.file.mimetype,
    url: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
  };

  res.json({
    success: true,
    message: '文件上传成功',
    data: fileInfo
  });
});

// 获取文件信息
router.get('/info/:fileId', (req, res) => {
  const { fileId } = req.params;
  const uploadsDir = path.join(__dirname, '../uploads');
  
  // 查找匹配的文件
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '服务器错误'
      });
    }
    
    const file = files.find(f => f.startsWith(fileId));
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }
    
    const filePath = path.join(uploadsDir, file);
    fs.stat(filePath, (err, stats) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: '获取文件信息失败'
        });
      }
      
      res.json({
        success: true,
        data: {
          id: fileId,
          filename: file,
          size: stats.size,
          createdAt: stats.birthtime,
          url: `${req.protocol}://${req.get('host')}/uploads/${file}`
        }
      });
    });
  });
});

// 删除文件
router.delete('/:fileId', (req, res) => {
  const { fileId } = req.params;
  const uploadsDir = path.join(__dirname, '../uploads');
  
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '服务器错误'
      });
    }
    
    const file = files.find(f => f.startsWith(fileId));
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }
    
    const filePath = path.join(uploadsDir, file);
    fs.unlink(filePath, err => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: '删除文件失败'
        });
      }
      
      res.json({
        success: true,
        message: '文件删除成功'
      });
    });
  });
});

module.exports = router;