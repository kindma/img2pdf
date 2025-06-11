// app.js
const { getCurrentConfig } = require('./config/config.js')

App({
  globalData: {
    userInfo: null,
    config: getCurrentConfig(), // 应用配置
    serverUrl: getCurrentConfig().serverUrl, // 服务器地址
    uploadedImages: [], // 存储上传的图片信息
    pdfInfo: null, // 存储生成的PDF信息
    token: null // 用户登录token
  },

  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 检查更新
    this.checkForUpdate()

    // 登录
    this.doLogin()
  },

  onShow() {
    console.log('小程序显示')
  },

  onHide() {
    console.log('小程序隐藏')
  },

  onError(error) {
    console.error('小程序错误:', error)
    wx.showToast({
      title: '程序出现错误',
      icon: 'none'
    })
  },

  // 检查小程序更新
  checkForUpdate() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager()
      
      updateManager.onCheckForUpdate(function (res) {
        console.log('检查更新结果:', res.hasUpdate)
      })

      updateManager.onUpdateReady(function () {
        wx.showModal({
          title: '更新提示',
          content: '新版本已经准备好，是否重启应用？',
          success(res) {
            if (res.confirm) {
              updateManager.applyUpdate()
            }
          }
        })
      })

      updateManager.onUpdateFailed(function () {
        console.log('新版本下载失败')
      })
    }
  },

  // 用户登录
  async doLogin() {
    try {
      // 获取微信登录code
      const loginRes = await this.wxLogin()
      console.log('微信登录成功', loginRes.code)

      // 调用后端登录接口
      const { api } = require('./utils/api.js')
      const loginResult = await api.user.login(loginRes.code)

      if (loginResult.success && loginResult.data) {
        // 保存token
        this.globalData.token = loginResult.data.token
        wx.setStorageSync('token', loginResult.data.token)

        console.log('后端登录成功', loginResult.data)

        // 记录登录统计
        api.stats.recordUsage('login', {
          timestamp: new Date().getTime()
        }).catch(err => console.log('记录登录统计失败:', err))
      }
    } catch (error) {
      console.error('登录失败:', error)
      // 登录失败不影响小程序使用，只是无法享受个性化服务
    }
  },

  // 微信登录
  wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject
      })
    })
  },

  // 全局工具方法
  utils: {
    // 格式化文件大小
    formatFileSize(bytes) {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    },

    // 显示错误提示
    showError(message, duration = 2000) {
      wx.showToast({
        title: message,
        icon: 'none',
        duration: duration
      })
    },

    // 显示成功提示
    showSuccess(message, duration = 2000) {
      wx.showToast({
        title: message,
        icon: 'success',
        duration: duration
      })
    },

    // 显示加载提示
    showLoading(title = '加载中...') {
      wx.showLoading({
        title: title,
        mask: true
      })
    },

    // 隐藏加载提示
    hideLoading() {
      wx.hideLoading()
    }
  }
})
