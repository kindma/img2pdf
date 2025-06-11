// config/config.js
// 应用配置文件

const config = {
  // 环境配置
  env: 'production', // development, production
  
  // 服务器配置
  server: {
    development: {
      baseUrl: 'http://localhost:3000',
      apiUrl: 'http://localhost:3000/api',
      uploadUrl: 'http://localhost:3000/api/file/upload'
    },
    production: {
      baseUrl: 'https://youdomain.com',
      apiUrl: 'https://youdomain.com/api',
      uploadUrl: 'https://youdomain.com/api/file/upload'
    }
  },

  // 应用配置
  app: {
    name: '照片转PDF助手',
    version: '1.0.0',
    description: '轻松将多张照片合并为一个PDF文件',
    
    // 功能限制
    limits: {
      maxImages: 20, // 最大图片数量
      maxImageSize: 10 * 1024 * 1024, // 单张图片最大大小 (10MB)
      maxTotalSize: 50 * 1024 * 1024, // 总大小限制 (50MB)
      supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp'], // 支持的图片格式
      compressQuality: 0.8, // 压缩质量
      compressThreshold: 2 * 1024 * 1024 // 压缩阈值 (2MB)
    },

    // 超时配置
    timeout: {
      request: 30000, // 请求超时 (30秒)
      upload: 120000, // 上传超时 (2分钟)
      download: 60000, // 下载超时 (1分钟)
      generate: 300000 // PDF生成超时 (5分钟)
    },

    // 重试配置
    retry: {
      maxAttempts: 3, // 最大重试次数
      delay: 1000, // 重试延迟 (1秒)
      backoff: 2 // 退避倍数
    }
  },

  // PDF配置
  pdf: {
    // 页面设置
    pageSize: 'A4', // A4, A3, Letter等
    orientation: 'portrait', // portrait, landscape
    margin: {
      top: 20,
      right: 20,
      bottom: 20,
      left: 20
    },
    
    // 图片设置
    imageSettings: {
      fit: 'contain', // contain, cover, fill
      quality: 0.9,
      dpi: 150
    },

    // 水印设置
    watermark: {
      enabled: false,
      text: '照片转PDF助手',
      opacity: 0.1,
      fontSize: 12,
      color: '#cccccc'
    }
  },

  // 存储配置
  storage: {
    keys: {
      userInfo: 'userInfo',
      settings: 'appSettings',
      history: 'conversionHistory',
      cache: 'imageCache'
    },
    
    // 缓存配置
    cache: {
      maxSize: 100 * 1024 * 1024, // 最大缓存大小 (100MB)
      maxAge: 7 * 24 * 60 * 60 * 1000, // 缓存有效期 (7天)
      cleanupInterval: 24 * 60 * 60 * 1000 // 清理间隔 (1天)
    }
  },

  // 分享配置
  share: {
    title: '照片转PDF助手 - 轻松制作PDF文档',
    desc: '我刚用照片转PDF助手制作了一个PDF文件，快来试试吧！',
    imageUrl: '/images/share-cover.png',
    
    // 分享链接有效期
    linkExpiry: 30 * 24 * 60 * 60 * 1000 // 30天
  },

  // 统计配置
  analytics: {
    enabled: true,
    events: {
      appLaunch: 'app_launch',
      imageSelect: 'image_select',
      pdfGenerate: 'pdf_generate',
      pdfDownload: 'pdf_download',
      pdfShare: 'pdf_share',
      error: 'error'
    }
  },

  // 错误配置
  error: {
    // 错误码映射
    codes: {
      1001: '网络连接失败',
      1002: '服务器错误',
      1003: '参数错误',
      1004: '文件格式不支持',
      1005: '文件大小超限',
      1006: '图片数量超限',
      1007: 'PDF生成失败',
      1008: '下载失败',
      1009: '权限不足',
      1010: '登录已过期'
    },
    
    // 自动重试的错误码
    retryableCodes: [1001, 1002],
    
    // 需要用户处理的错误码
    userActionCodes: [1004, 1005, 1006, 1009, 1010]
  }
}

// 获取当前环境配置
const getCurrentConfig = () => {
  const env = config.env
  return {
    ...config,
    serverUrl: config.server[env].baseUrl,
    apiUrl: config.server[env].apiUrl,
    uploadUrl: config.server[env].uploadUrl
  }
}

// 更新配置
const updateConfig = (newConfig) => {
  Object.assign(config, newConfig)
}

module.exports = {
  config,
  getCurrentConfig,
  updateConfig
}
