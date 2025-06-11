// pages/result/result.js
const util = require('../../utils/util.js')
const { api, safeApiCall } = require('../../utils/api.js')
const app = getApp()

Page({
  data: {
    pdfInfo: null, // PDF信息
    isLoading: false, // 预览加载状态
    isDownloading: false, // 下载状态
    showHistoryTip: false, // 显示历史提示
    showShareModal: false, // 显示分享模态框
    showDownloadProgress: false, // 显示下载进度
    downloadProgress: 0, // 下载进度
    downloadStatusText: '准备下载...', // 下载状态文本
    pdfFilePath: '', // 本地PDF文件路径
    shareUrl: '' // 分享链接
  },

  onLoad(options) {
    console.log('结果页面加载',options)
    this.initializePDFInfo()

    // 记录结果页面访问统计
    api.stats.recordUsage('result_page_view', {
      timestamp: new Date().getTime()
    }).catch(err => console.log('记录页面访问统计失败:', err))
  },

  onShow() {
    // 页面显示时检查PDF信息
    if (!this.data.pdfInfo) {
      this.initializePDFInfo()
    }
  },

  onShareAppMessage() {
    return {
      title: `我刚制作了一个PDF文件，包含${this.data.pdfInfo?.imageCount || 0}张图片`,
      path: `/pages/result/result?shareId=${this.data.pdfInfo?.taskId || ''}`,
      imageUrl: '/images/share-pdf.png'
    }
  },

  // 初始化PDF信息
  initializePDFInfo() {
    const pdfInfo = app.globalData.pdfInfo

    console.log('初始化PDF信息:', pdfInfo)

    if (!pdfInfo) {
      console.error('未找到PDF信息，可能是从历史记录跳转时数据丢失')
      wx.showModal({
        title: '提示',
        content: '没有找到PDF文件信息，请重新制作',
        showCancel: false,
        success: () => {
          wx.reLaunch({
            url: '/pages/index/index'
          })
        }
      })
      return
    }

    // 检查PDF URL是否存在
    if (!pdfInfo.url) {
      console.error('PDF URL不存在，尝试重新获取...', {
        taskId: pdfInfo.taskId,
        pdfInfo: pdfInfo
      })
      this.tryGetPDFUrl(pdfInfo.taskId)
    } else {
      console.log('PDF URL存在:', pdfInfo.url)
      // 验证URL格式
      if (!pdfInfo.url.startsWith('http')) {
        console.warn('PDF URL格式可能有问题:', pdfInfo.url)
      }
    }

    // 格式化时间和文件大小
    const createTimeText = util.formatTime(new Date(pdfInfo.createTime))

    this.setData({
      pdfInfo: {
        ...pdfInfo,
        createTimeText: createTimeText,
        fileSizeText: pdfInfo.fileSize ? app.utils.formatFileSize(pdfInfo.fileSize) : '计算中...'
      }
    })

    // 获取文件大小信息
    this.fetchFileSize()
  },

  // 尝试获取PDF URL
  async tryGetPDFUrl(taskId) {
    try {
      console.log('尝试获取PDF下载链接，taskId:', taskId)
      const downloadResult = await api.pdf.getDownloadUrl(taskId)
      console.log('获取下载链接结果:', downloadResult)

      if (downloadResult.success && downloadResult.data && downloadResult.data.downloadUrl) {
        // 更新PDF信息
        const updatedPdfInfo = {
          ...this.data.pdfInfo,
          url: downloadResult.data.downloadUrl
        }

        this.setData({
          pdfInfo: updatedPdfInfo
        })

        // 同时更新全局数据
        app.globalData.pdfInfo.url = downloadResult.data.downloadUrl

        console.log('PDF URL已更新:', downloadResult.data.downloadUrl)
      }
    } catch (error) {
      console.error('获取PDF下载链接失败:', error)
      app.utils.showError('获取PDF下载链接失败，请重试')
    }
  },

  // 获取文件大小
  async fetchFileSize() {
    try {
      // 使用PDF下载接口获取文件信息
      const downloadResult = await api.pdf.getDownloadUrl(this.data.pdfInfo.taskId)
      if (downloadResult.success && downloadResult.data) {
        // 如果有文件大小信息，更新显示
        if (downloadResult.data.fileSize) {
          this.setData({
            'pdfInfo.fileSize': downloadResult.data.fileSize,
            'pdfInfo.fileSizeText': app.utils.formatFileSize(downloadResult.data.fileSize)
          })
        }
      }
    } catch (error) {
      console.error('获取文件信息失败:', error)
    }
  },

  // 预览PDF
  async previewPDF() {
    if (this.data.isLoading) return

    console.log('开始预览PDF，URL:', this.data.pdfInfo?.url)

    // 检查PDF URL是否存在
    if (!this.data.pdfInfo || !this.data.pdfInfo.url) {
      console.error('PDF URL不存在，PDF信息:', this.data.pdfInfo)

      // 尝试重新获取PDF URL
      if (this.data.pdfInfo && this.data.pdfInfo.taskId) {
        console.log('尝试重新获取PDF下载链接...')
        await this.tryGetPDFUrl(this.data.pdfInfo.taskId)

        // 重新检查URL
        if (this.data.pdfInfo && this.data.pdfInfo.url) {
          console.log('重新获取PDF URL成功，继续预览')
          // 递归调用预览
          return this.previewPDF()
        }
      }

      app.utils.showError('PDF文件链接不存在，请重新生成')
      return
    }

    // 验证URL格式
    if (!this.data.pdfInfo.url.startsWith('http')) {
      console.error('PDF URL格式错误:', this.data.pdfInfo.url)
      app.utils.showError('PDF文件链接格式错误')
      return
    }

    this.setData({ isLoading: true })

    try {
      // 记录预览统计
      api.stats.recordUsage('pdf_preview', {
        taskId: this.data.pdfInfo.taskId,
        timestamp: new Date().getTime()
      }).catch(err => console.log('记录预览统计失败:', err))

      // 检查是否已有本地文件
      if (this.data.pdfFilePath) {
        await this.openPDFDocument(this.data.pdfFilePath)
        return
      }

      app.utils.showLoading('下载PDF文件...')

      console.log('开始下载PDF文件，URL:', this.data.pdfInfo.url)

      // 下载PDF文件
      const filePath = await util.downloadFile(this.data.pdfInfo.url, 'preview.pdf')

      console.log('PDF文件下载完成，本地路径:', filePath)

      this.setData({ pdfFilePath: filePath })

      // 打开PDF文档
      await this.openPDFDocument(filePath)

    } catch (error) {
      console.error('预览PDF失败:', error)
      app.utils.showError('预览失败，请检查网络连接后重试')
    } finally {
      this.setData({ isLoading: false })
      app.utils.hideLoading()
    }
  },

  // 打开PDF文档
  openPDFDocument(filePath) {
    return new Promise((resolve, reject) => {
      wx.openDocument({
        filePath: filePath,
        fileType: 'pdf',
        success: resolve,
        fail: (error) => {
          console.error('打开文档失败:', error)
          if (error.errMsg && error.errMsg.includes('not support')) {
            app.utils.showError('当前微信版本不支持PDF预览')
          } else {
            app.utils.showError('打开PDF文件失败')
          }
          reject(error)
        }
      })
    })
  },

  // 下载PDF到手机
  async downloadPDF() {
    if (this.data.isDownloading) return

    try {
      // 记录下载统计
      api.stats.recordUsage('pdf_download', {
        taskId: this.data.pdfInfo.taskId,
        timestamp: new Date().getTime()
      }).catch(err => console.log('记录下载统计失败:', err))

      // 检查权限
      await util.requestPermission('scope.writePhotosAlbum')

      this.setData({
        isDownloading: true,
        showDownloadProgress: true,
        downloadProgress: 0,
        downloadStatusText: '准备下载...'
      })

      // 下载文件
      const filePath = await this.downloadWithProgress()

      // 保存文件
      await this.saveFileToLocal(filePath)

      this.setData({
        showDownloadProgress: false,
        showHistoryTip: true
      })

      app.utils.showSuccess('PDF文件已保存到手机')

      // 3秒后隐藏提示
      setTimeout(() => {
        this.setData({ showHistoryTip: false })
      }, 3000)

    } catch (error) {
      console.error('下载PDF失败:', error)
      this.setData({ showDownloadProgress: false })

      if (error.message.includes('用户拒绝授权')) {
        app.utils.showError('需要授权才能保存文件到手机')
      } else {
        app.utils.showError('下载失败，请重试')
      }
    } finally {
      this.setData({ isDownloading: false })
    }
  },

  // 带进度的下载
  downloadWithProgress() {
    return new Promise((resolve, reject) => {
      console.log('开始下载PDF文件，URL:', this.data.pdfInfo.url)

      const downloadTask = wx.downloadFile({
        url: this.data.pdfInfo.url,
        success: (res) => {
          console.log('下载完成，状态码:', res.statusCode, '文件路径:', res.tempFilePath)
          if (res.statusCode === 200) {
            resolve(res.tempFilePath)
          } else {
            reject(new Error(`下载失败，状态码：${res.statusCode}`))
          }
        },
        fail: (error) => {
          console.error('下载失败:', error)
          reject(error)
        }
      })

      // 监听下载进度
      downloadTask.onProgressUpdate((res) => {
        this.setData({
          downloadProgress: res.progress,
          downloadStatusText: `下载中... ${res.progress}%`
        })
      })
    })
  },

  // 保存文件到本地
  async saveFileToLocal(tempFilePath) {
    try {
      // 尝试使用新API保存到指定目录
      if (wx.saveFileToDisk) {
        await new Promise((resolve, reject) => {
          wx.saveFileToDisk({
            filePath: tempFilePath,
            success: resolve,
            fail: reject
          })
        })
      } else {
        // 使用旧API保存文件
        const savedFilePath = await util.saveFile(tempFilePath, 'photo-to-pdf.pdf')
        console.log('文件已保存到:', savedFilePath)
      }
    } catch (error) {
      console.error('保存文件失败:', error)
      throw error
    }
  },

  // 分享给好友
  shareToFriend() {
    this.setData({ showShareModal: true })
  },

  // 关闭分享模态框
  closeShareModal() {
    this.setData({ showShareModal: false })
  },

  // 分享到聊天
  shareToChat() {
    this.closeShareModal()
    // 触发页面的分享功能
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
    app.utils.showSuccess('请点击右上角分享按钮')
  },

  // 分享到朋友圈
  shareToMoments() {
    this.closeShareModal()
    // 微信小程序暂不支持直接分享到朋友圈
    app.utils.showError('请点击右上角菜单分享到朋友圈')
  },

  // 复制链接
  async copyLink() {
    try {
      // 创建分享链接
      const shareResult = await api.share.createShare(this.data.pdfInfo.taskId)

      if (shareResult.success && shareResult.data) {
        const shareUrl = shareResult.data.shareUrl

        await new Promise((resolve, reject) => {
          wx.setClipboardData({
            data: shareUrl,
            success: resolve,
            fail: reject
          })
        })

        // 记录分享统计
        api.stats.recordUsage('pdf_share_link', {
          taskId: this.data.pdfInfo.taskId,
          shareId: shareResult.data.shareId,
          timestamp: new Date().getTime()
        }).catch(err => console.log('记录分享统计失败:', err))

        this.closeShareModal()
        app.utils.showSuccess('分享链接已复制到剪贴板')
      } else {
        throw new Error(shareResult.message || '创建分享链接失败')
      }
    } catch (error) {
      console.error('复制链接失败:', error)
      app.utils.showError('复制失败，请重试')
    }
  },

  // 重新制作
  createNew() {
    wx.showModal({
      title: '确认操作',
      content: '确定要重新制作PDF吗？当前文件信息将被清除。',
      success: (res) => {
        if (res.confirm) {
          // 清除全局数据
          app.globalData.uploadedImages = []
          app.globalData.pdfInfo = null
          // 设置标记，确保返回首页时清空数据
          app.globalData.shouldClearIndexImages = true

          // 返回首页
          wx.reLaunch({
            url: '/pages/index/index'
          })
        }
      }
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  }
})

