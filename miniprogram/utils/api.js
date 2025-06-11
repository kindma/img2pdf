// utils/api.js
const app = getApp()

// 基础请求方法
const request = (options) => {
  return new Promise((resolve, reject) => {
    // 获取用户token
    const token = wx.getStorageSync('token') || app.globalData.token;

    wx.request({
      url: `${app.globalData.serverUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'content-type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (res.data.success !== false) {
            resolve(res.data)
          } else {
            reject(new Error(res.data.message || '请求失败'))
          }
        } else {
          reject(new Error(`请求失败，状态码：${res.statusCode}`))
        }
      },
      fail: (error) => {
        console.error('请求失败:', error)
        reject(new Error('网络请求失败，请检查网络连接'))
      }
    })
  })
}

// 上传文件
const uploadFile = (filePath, formData = {}) => {
  return new Promise((resolve, reject) => {
    const uploadTask = wx.uploadFile({
      url: `${app.globalData.serverUrl}/api/file/upload`,
      filePath: filePath,
      name: 'file',
      formData: formData,
      header: {
        'Authorization': wx.getStorageSync('token') || ''
      },
      success: (res) => {
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(res.data)
            if (data.success !== false) {
              resolve(data)
            } else {
              reject(new Error(data.message || '上传失败'))
            }
          } catch (e) {
            reject(new Error('服务器返回数据格式错误'))
          }
        } else {
          reject(new Error(`上传失败，状态码：${res.statusCode}`))
        }
      },
      fail: reject
    })

    // 返回上传任务，可以用于监听进度
    return uploadTask
  })
}

// API接口定义
const api = {
  // 用户相关
  user: {
    // 登录
    login: (code) => request({
      url: '/api/auth/login',
      method: 'POST',
      data: { code }
    }),

    // 获取用户信息
    getUserInfo: () => request({
      url: '/api/auth/user/info'
    })
  },

  // 文件相关
  file: {
    // 上传图片
    uploadImage: (filePath, formData) => uploadFile(filePath, formData),

    // 获取文件信息
    getFileInfo: (fileId) => request({
      url: `/api/file/info/${fileId}`
    }),

    // 删除文件
    deleteFile: (fileId) => request({
      url: `/api/file/${fileId}`,
      method: 'DELETE'
    })
  },

  // PDF相关
  pdf: {
    // 生成PDF
    generatePDF: (images) => request({
      url: '/api/pdf/generate',
      method: 'POST',
      data: { images }
    }),

    // 查询生成状态
    getGenerateStatus: (taskId) => request({
      url: `/api/pdf/status/${taskId}`
    }),

    // 获取PDF下载链接
    getDownloadUrl: (taskId) => request({
      url: `/api/pdf/download/${taskId}`
    }),

    // 获取分享链接
    getShareUrl: (taskId) => request({
      url: `/api/pdf/share/${taskId}`
    }),

    // 获取历史记录
    getHistory: (params = {}) => request({
      url: '/api/pdf/history',
      method: 'GET',
      data: params
    }),

    // 获取历史记录详情
    getHistoryDetail: (taskId) => request({
      url: `/api/pdf/history/${taskId}`
    }),

    // 删除历史记录
    deleteHistory: (taskId) => request({
      url: `/api/pdf/history/${taskId}`,
      method: 'DELETE'
    }),

    // 清空历史记录
    clearHistory: (userId) => request({
      url: '/api/pdf/history',
      method: 'DELETE',
      data: userId ? { userId } : {}
    })
  },

  // 分享相关
  share: {
    // 创建分享
    createShare: (taskId, options = {}) => request({
      url: '/api/share/create',
      method: 'POST',
      data: { taskId, ...options }
    }),

    // 获取分享信息
    getShareInfo: (shareId) => request({
      url: `/api/share/${shareId}`
    })
  },

  // 统计相关
  stats: {
    // 记录使用统计
    recordUsage: (action, data = {}) => request({
      url: '/api/stats/usage',
      method: 'POST',
      data: { action, data }
    }),

    // 获取使用统计
    getUsageStats: (params = {}) => request({
      url: '/api/stats/usage',
      method: 'GET',
      data: params
    }),

    // 获取统计摘要
    getStatsSummary: () => request({
      url: '/api/stats/summary'
    })
  }
}

// 错误处理中间件
const handleApiError = (error) => {
  console.error('API错误:', error)
  
  if (error.message.includes('网络')) {
    app.utils.showError('网络连接异常，请检查网络后重试')
  } else if (error.message.includes('401')) {
    app.utils.showError('登录已过期，请重新登录')
    // 可以在这里处理重新登录逻辑
  } else if (error.message.includes('403')) {
    app.utils.showError('没有权限执行此操作')
  } else if (error.message.includes('404')) {
    app.utils.showError('请求的资源不存在')
  } else if (error.message.includes('500')) {
    app.utils.showError('服务器内部错误，请稍后重试')
  } else {
    app.utils.showError(error.message || '操作失败，请重试')
  }
}

// 带错误处理的API调用
const safeApiCall = async (apiCall, showError = true) => {
  try {
    return await apiCall()
  } catch (error) {
    if (showError) {
      handleApiError(error)
    }
    throw error
  }
}

module.exports = {
  request,
  uploadFile,
  api,
  handleApiError,
  safeApiCall
}
