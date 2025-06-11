// pages/index/index.js
const util = require('../../utils/util.js')
const { api } = require('../../utils/api.js')
const app = getApp()

Page({
  data: {
    selectedImages: [], // 已选择的图片列表
    isConverting: false, // 是否正在转换
    showPreview: false, // 是否显示预览
    previewImageSrc: '', // 预览图片源
    maxImages: 20 // 最大图片数量
  },

  onLoad(options) {
    console.log('首页加载')
    this.checkPermissions()

    // 记录首页访问统计
    api.stats.recordUsage('index_page_view', {
      timestamp: new Date().getTime()
    }).catch(err => console.log('记录页面访问统计失败:', err))
  },

  onShow() {
    // 从其他页面返回时，清理状态
    this.setData({
      isConverting: false
    })
    
    // 检查是否需要清空已选择的图片
    if (app.globalData.shouldClearIndexImages) {
      console.log('检测到PDF生成完成标记，清空已选择的图片')
      this.setData({
        selectedImages: []
      })
      // 重置标记
      app.globalData.shouldClearIndexImages = false
    }
  },

  onShareAppMessage() {
    return {
      title: '照片转PDF助手 - 轻松制作PDF文档',
      path: '/pages/index/index',
      imageUrl: '/images/share-cover.png'
    }
  },

  // 检查权限
  async checkPermissions() {
    try {
      await util.checkNetworkStatus()
    } catch (error) {
      app.utils.showError('请检查网络连接')
    }
  },

  // 选择图片
  async chooseImages() {
    try {
      // 检查是否已达到最大数量
      if (this.data.selectedImages.length >= this.data.maxImages) {
        app.utils.showError(`最多只能选择${this.data.maxImages}张照片`)
        return
      }

      const count = this.data.maxImages - this.data.selectedImages.length
      
      const res = await this.chooseMedia(count)
      if (res.tempFiles && res.tempFiles.length > 0) {
        await this.processSelectedImages(res.tempFiles)
      }
    } catch (error) {
      console.error('选择图片失败:', error)
      if (error.errMsg && error.errMsg.includes('cancel')) {
        return // 用户取消选择
      }
      app.utils.showError('选择图片失败，请重试')
    }
  },

  // 选择媒体文件
  chooseMedia(count) {
    return new Promise((resolve, reject) => {
      wx.chooseMedia({
        count: count,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        maxDuration: 30,
        camera: 'back',
        success: resolve,
        fail: reject
      })
    })
  },

  // 处理选择的图片
  async processSelectedImages(tempFiles) {
    app.utils.showLoading('处理图片中...')
    
    try {
      const processedImages = []
      
      for (let i = 0; i < tempFiles.length; i++) {
        const file = tempFiles[i]
        
        // 验证文件类型
        if (!util.validateFileType(file.tempFilePath, ['jpg', 'jpeg', 'png', 'gif', 'bmp'])) {
          app.utils.showError(`第${i + 1}张图片格式不支持`)
          continue
        }

        // 获取图片信息
        const imageInfo = await util.getImageInfo(file.tempFilePath)
        const fileSize = await util.getFileSize(file.tempFilePath)
        
        // 压缩图片（如果需要）
        let finalPath = file.tempFilePath
        if (fileSize > 2 * 1024 * 1024) { // 大于2MB时压缩
          const compressResult = await util.compressImage(file.tempFilePath, 0.7)
          finalPath = compressResult.tempFilePath
        }

        const imageData = {
          id: util.generateId(),
          path: finalPath,
          originalPath: file.tempFilePath,
          width: imageInfo.width,
          height: imageInfo.height,
          size: fileSize,
          sizeText: app.utils.formatFileSize(fileSize),
          type: imageInfo.type
        }

        processedImages.push(imageData)
      }

      if (processedImages.length > 0) {
        const newImages = [...this.data.selectedImages, ...processedImages]
        this.setData({
          selectedImages: newImages
        })

        // 记录图片选择统计
        api.stats.recordUsage('images_selected', {
          count: processedImages.length,
          totalCount: newImages.length,
          timestamp: new Date().getTime()
        }).catch(err => console.log('记录图片选择统计失败:', err))

        app.utils.showSuccess(`成功添加${processedImages.length}张图片`)
      }
    } catch (error) {
      console.error('处理图片失败:', error)
      app.utils.showError('处理图片失败，请重试')
    } finally {
      app.utils.hideLoading()
    }
  },

  // 删除图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.selectedImages
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张图片吗？',
      success: (res) => {
        if (res.confirm) {
          images.splice(index, 1)
          this.setData({
            selectedImages: images
          })
          app.utils.showSuccess('删除成功')
        }
      }
    })
  },

  // 清空所有图片
  clearImages() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有已选择的图片吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            selectedImages: []
          })
          app.utils.showSuccess('已清空选择')
        }
      }
    })
  },

  // 预览图片
  previewImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.selectedImages.map(img => img.path)
    
    wx.previewImage({
      current: images[index],
      urls: images
    })
  },

  // 开始转换PDF
  async startConvert() {
    if (this.data.selectedImages.length === 0) {
      app.utils.showError('请先选择图片')
      return
    }

    if (this.data.isConverting) {
      return
    }

    try {
      await util.checkNetworkStatus()

      // 记录开始转换统计
      api.stats.recordUsage('conversion_start', {
        imageCount: this.data.selectedImages.length,
        timestamp: new Date().getTime()
      }).catch(err => console.log('记录转换开始统计失败:', err))

      // 保存图片信息到全局数据
      app.globalData.uploadedImages = this.data.selectedImages

      // 跳转到处理页面
      wx.navigateTo({
        url: '/pages/processing/processing'
      })
    } catch (error) {
      console.error('开始转换失败:', error)
      app.utils.showError('网络连接异常，请检查网络后重试')
    }
  },

  // 显示预览
  showImagePreview(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      showPreview: true,
      previewImageSrc: this.data.selectedImages[index].path
    })
  },

  // 关闭预览
  closePreview() {
    this.setData({
      showPreview: false,
      previewImageSrc: ''
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 跳转到历史记录页面
  goToHistory() {
    // 记录历史记录入口点击统计
    api.stats.recordUsage('history_entrance_click', {
      timestamp: new Date().getTime()
    }).catch(err => console.log('记录历史记录入口统计失败:', err))

    wx.navigateTo({
      url: '/pages/history/history'
    })
  }
})

