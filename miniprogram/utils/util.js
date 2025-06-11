// utils/util.js
const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

// 图片压缩工具
const compressImage = (src, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: src,
      quality: quality,
      success: resolve,
      fail: reject
    })
  })
}

// 获取图片信息
const getImageInfo = (src) => {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: src,
      success: resolve,
      fail: reject
    })
  })
}

// 上传文件到服务器
const uploadFile = (filePath, name = 'file', formData = {}) => {
  const app = getApp()
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${app.globalData.serverUrl}/api/file/upload`,
      filePath: filePath,
      name: name,
      formData: formData,
      header: {
        'content-type': 'multipart/form-data',
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
  })
}

// 下载文件
const downloadFile = (url, fileName) => {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url: url,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.tempFilePath)
        } else {
          reject(new Error(`下载失败，状态码：${res.statusCode}`))
        }
      },
      fail: reject
    })
  })
}

// 保存文件到本地
const saveFile = (tempFilePath, fileName) => {
  return new Promise((resolve, reject) => {
    wx.saveFile({
      tempFilePath: tempFilePath,
      success: (res) => {
        resolve(res.savedFilePath)
      },
      fail: reject
    })
  })
}

// 检查网络状态
const checkNetworkStatus = () => {
  return new Promise((resolve, reject) => {
    wx.getNetworkType({
      success: (res) => {
        if (res.networkType === 'none') {
          reject(new Error('网络连接不可用'))
        } else {
          resolve(res.networkType)
        }
      },
      fail: reject
    })
  })
}

// 请求权限
const requestPermission = (scope) => {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting[scope]) {
          resolve(true)
        } else {
          wx.authorize({
            scope: scope,
            success: () => resolve(true),
            fail: () => {
              wx.showModal({
                title: '权限申请',
                content: '需要您的授权才能正常使用此功能',
                confirmText: '去设置',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting({
                      success: (settingRes) => {
                        if (settingRes.authSetting[scope]) {
                          resolve(true)
                        } else {
                          reject(new Error('用户拒绝授权'))
                        }
                      },
                      fail: () => reject(new Error('打开设置失败'))
                    })
                  } else {
                    reject(new Error('用户拒绝授权'))
                  }
                }
              })
            }
          })
        }
      },
      fail: reject
    })
  })
}

// 防抖函数
const debounce = (func, wait) => {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// 节流函数
const throttle = (func, limit) => {
  let inThrottle
  return function() {
    const args = arguments
    const context = this
    if (!inThrottle) {
      func.apply(context, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// 生成唯一ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// 验证文件类型
const validateFileType = (filePath, allowedTypes = ['jpg', 'jpeg', 'png', 'gif']) => {
  const extension = filePath.split('.').pop().toLowerCase()
  return allowedTypes.includes(extension)
}

// 计算文件大小
const getFileSize = (filePath) => {
  return new Promise((resolve, reject) => {
    wx.getFileInfo({
      filePath: filePath,
      success: (res) => resolve(res.size),
      fail: reject
    })
  })
}

module.exports = {
  formatTime,
  compressImage,
  getImageInfo,
  uploadFile,
  downloadFile,
  saveFile,
  checkNetworkStatus,
  requestPermission,
  debounce,
  throttle,
  generateId,
  validateFileType,
  getFileSize
}
