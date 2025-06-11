// pages/processing/processing.js
const util = require('../../utils/util.js')
const {
    api,
    safeApiCall
} = require('../../utils/api.js')
const app = getApp()

Page({
    data: {
        images: [], // 要处理的图片列表
        progressPercent: 0, // 进度百分比
        statusText: '准备中...', // 状态文本
        currentStage: '初始化', // 当前阶段
        statusDetail: '', // 状态详情

        // 进度环相关
        circumference: 565.48, // 2 * π * 90
        dashOffset: 565.48,

        // 步骤状态
        uploadStage: -1, // -1: 未开始, 0: 进行中, 1: 完成
        generateStage: -1,
        downloadStage: -1,

        // 显示控制
        showUploadStep: false,
        showGenerateStep: false,
        showDownloadStep: false,

        // 上传相关
        currentUploadIndex: 0,
        totalImages: 0,
        uploadedCount: 0,

        // 控制状态
        canGoBack: false,
        canCancel: true,
        hasError: false,
        errorMessage: '',

        // 处理结果
        pdfUrl: '',
        taskId: ''
    },

    onLoad(options) {
        console.log('处理页面加载')
        this.initializeData()
        this.startProcessing()
    },

    onUnload() {
        // 页面卸载时清理定时器
        if (this.pollTimer) {
            clearInterval(this.pollTimer)
        }
    },

    // 初始化数据
    initializeData() {
        const images = app.globalData.uploadedImages || []
        if (images.length === 0) {
            wx.showModal({
                title: '提示',
                content: '没有找到要处理的图片，请重新选择',
                showCancel: false,
                success: () => {
                    wx.navigateBack()
                }
            })
            return
        }

        // 为每张图片添加状态
        const processImages = images.map(img => ({
            ...img,
            status: 'waiting' // waiting, uploading, success, error
        }))

        this.setData({
            images: processImages,
            totalImages: images.length,
            showUploadStep: true
        })
    },

    // 开始处理流程
    async startProcessing() {
        try {
            console.log('开始处理流程...')

            console.log('步骤1: 上传图片')
            await this.uploadImages()
            console.log('步骤1完成: 图片上传成功')

            console.log('步骤2: 生成PDF')
            await this.generatePDF()
            console.log('步骤2完成: PDF生成成功')

            console.log('步骤3: 准备PDF文件')
            await this.preparePDF()
            console.log('步骤3完成: PDF准备成功')

            console.log('所有步骤完成，调用onProcessComplete')
            this.onProcessComplete()
        } catch (error) {
            console.error('处理失败:', error)
            console.error('错误详情:', error.stack)
            this.onProcessError(error.message || '处理过程中发生错误')
        }
    },

    // 上传图片
    async uploadImages() {
        this.setData({
            uploadStage: 0,
            currentStage: '上传图片',
            statusText: '上传中...'
        })

        const images = this.data.images
        const uploadResults = []

        // 记录开始上传统计
        try {
            await api.stats.recordUsage('upload_start', {
                imageCount: images.length,
                timestamp: new Date().getTime()
            })
        } catch (err) {
            console.log('记录上传统计失败:', err)
        }

        for (let i = 0; i < images.length; i++) {
            const image = images[i]

            this.setData({
                currentUploadIndex: i + 1,
                statusDetail: `正在上传第 ${i + 1} 张图片...`,
                [`images[${i}].status`]: 'uploading'
            })

            this.updateProgress((i / images.length) * 30) // 上传占30%进度

            try {
                const uploadResult = await api.file.uploadImage(
                    image.path, {
                        index: i,
                        total: images.length,
                        originalName: `image_${i + 1}.jpg`
                    }
                )

                // 保存服务器返回的文件信息
                uploadResults.push({
                    ...uploadResult.data,
                    localIndex: i
                })

                // 更新本地图片信息，保存服务器返回的文件ID
                this.setData({
                    [`images[${i}].status`]: 'success',
                    [`images[${i}].serverId`]: uploadResult.data.id,
                    [`images[${i}].serverFilename`]: uploadResult.data.filename,
                    uploadedCount: i + 1
                })

            } catch (error) {
                console.error(`上传第${i + 1}张图片失败:`, error)
                this.setData({
                    [`images[${i}].status`]: 'error'
                })
                throw new Error(`第${i + 1}张图片上传失败: ${error.message}`)
            }
        }

        this.setData({
            uploadStage: 1,
            showGenerateStep: true
        })

        return uploadResults
    },

    // 生成PDF
    async generatePDF() {
        this.setData({
            generateStage: 0,
            currentStage: '生成PDF',
            statusText: '处理中...',
            statusDetail: '正在将图片合并为PDF文件...'
        })

        this.updateProgress(40) // 生成开始时40%

        try {
            // 记录PDF生成开始统计
            await api.stats.recordUsage('pdf_generate_start', {
                imageCount: this.data.totalImages,
                timestamp: new Date().getTime()
            }).catch(err => console.log('记录PDF生成统计失败:', err))

            // 准备图片数据，使用服务器返回的文件ID
            const imageData = this.data.images.map((img, index) => ({
                id: img.serverId || img.serverFilename || img.id || `image_${index}`,
                filename: img.serverFilename,
                index: index
            }))

            console.log('准备发送的图片数据:', imageData)

            // 发送生成PDF请求
            const generateResult = await api.pdf.generatePDF(imageData)

            if (generateResult.success && generateResult.data.taskId) {
                this.setData({
                    taskId: generateResult.data.taskId
                })

                // 开始轮询状态
                await this.pollGenerateStatus()
            } else {
                throw new Error(generateResult.message || 'PDF生成请求失败')
            }

        } catch (error) {
            throw new Error(`PDF生成失败: ${error.message}`)
        }
    },

    // 轮询生成状态
    async pollGenerateStatus() {
        return new Promise((resolve, reject) => {
            let attempts = 0
            const maxAttempts = 60 // 最多轮询60次（5分钟）

            this.pollTimer = setInterval(async () => {
                attempts++

                try {
                    const statusResult = await api.pdf.getGenerateStatus(this.data.taskId)

                    if (statusResult.success && statusResult.data) {
                        const status = statusResult.data

                        if (status.status === 'completed') {
                            console.log('PDF生成完成，开始获取下载链接')
                            clearInterval(this.pollTimer)

                            // 获取下载链接
                            const downloadResult = await api.pdf.getDownloadUrl(this.data.taskId)
                            console.log('下载链接获取结果:', downloadResult)

                            if (downloadResult.success && downloadResult.data) {
                                this.setData({
                                    pdfUrl: downloadResult.data.downloadUrl,
                                    generateStage: 1,
                                    showDownloadStep: true
                                })
                                console.log('PDF URL已设置:', downloadResult.data.downloadUrl)
                                resolve(downloadResult.data)
                            } else {
                                console.error('获取下载链接失败:', downloadResult)
                                reject(new Error('获取下载链接失败'))
                            }
                        } else if (status.status === 'failed') {
                            console.error('PDF生成失败:', status.error)
                            clearInterval(this.pollTimer)
                            reject(new Error(status.error || 'PDF生成失败'))
                        } else {
                            // 更新进度
                            const progress = Math.min(40 + (status.progress || 0) * 0.4, 80)
                            this.updateProgress(progress)

                            console.log(`PDF生成进度: ${status.progress || 0}%, 已处理: ${status.processedImages || 0}/${status.totalImages || 0}`)

                            this.setData({
                                statusDetail: `正在处理第 ${status.processedImages || 0} / ${status.totalImages || 0} 张图片...`
                            })
                        }
                    } else {
                        throw new Error(statusResult.message || '查询状态失败')
                    }

                    if (attempts >= maxAttempts) {
                        clearInterval(this.pollTimer)
                        reject(new Error('处理超时，请重试'))
                    }

                } catch (error) {
                    clearInterval(this.pollTimer)
                    reject(error)
                }
            }, 3000) // 每3秒轮询一次
        })
    },



    // 准备PDF文件
    async preparePDF() {
        this.setData({
            downloadStage: 0,
            currentStage: '准备文件',
            statusText: '准备中...',
            statusDetail: '正在准备PDF文件供下载...'
        })

        this.updateProgress(90)

        // 模拟准备时间
        await new Promise(resolve => setTimeout(resolve, 1000))

        this.setData({
            downloadStage: 1
        })

        this.updateProgress(100)
    },

    // 处理完成
    onProcessComplete() {
        console.log('onProcessComplete被调用')

        this.setData({
            currentStage: '处理完成',
            statusText: '完成',
            statusDetail: 'PDF文件已生成完成！',
            canGoBack: true,
            canCancel: false
        })

        // 记录PDF生成完成统计
        api.stats.recordUsage('pdf_generate_complete', {
            taskId: this.data.taskId,
            imageCount: this.data.totalImages,
            timestamp: new Date().getTime()
        }).catch(err => console.log('记录PDF完成统计失败:', err))

        // 保存PDF信息到全局数据
        const pdfInfo = {
            url: this.data.pdfUrl,
            taskId: this.data.taskId,
            imageCount: this.data.totalImages,
            createTime: new Date().getTime()
        }

        app.globalData.pdfInfo = pdfInfo
        // 设置标记，表示需要清空首页数据
        app.globalData.shouldClearIndexImages = true
        console.log('PDF信息已保存到全局数据:', pdfInfo)

        // 延迟跳转到结果页面
        console.log('准备跳转到结果页面，2秒后执行...')
        setTimeout(() => {
            console.log('开始跳转到结果页面')

            wx.redirectTo({
                url: '/pages/result/result',
                success: () => {
                    console.log('跳转成功')
                },
                fail: (error) => {
                    console.error('跳转失败:', error)
                }
            })
        }, 2000)
    },

    // 处理错误
    onProcessError(message) {
        console.log('onProcessError被调用，错误信息:', message)

        this.setData({
            hasError: true,
            errorMessage: message,
            canGoBack: true,
            canCancel: false,
            currentStage: '处理失败',
            statusText: '失败'
        })

        // 显示错误提示
        wx.showToast({
            title: '处理失败',
            icon: 'error',
            duration: 3000
        })
    },

    // 更新进度
    updateProgress(percent) {
        const dashOffset = this.data.circumference - (percent / 100) * this.data.circumference
        this.setData({
            progressPercent: Math.round(percent),
            dashOffset: dashOffset
        })
    },

    // 返回上一页
    goBack() {
        wx.navigateBack()
    },

    // 取消处理
    cancelProcess() {
        wx.showModal({
            title: '确认取消',
            content: '确定要取消当前处理吗？',
            success: (res) => {
                if (res.confirm) {
                    if (this.pollTimer) {
                        clearInterval(this.pollTimer)
                    }
                    wx.navigateBack()
                }
            }
        })
    },

    // 重试处理
    retryProcess() {
        this.setData({
            hasError: false,
            errorMessage: '',
            progressPercent: 0,
            dashOffset: this.data.circumference,
            uploadStage: -1,
            generateStage: -1,
            downloadStage: -1,
            showGenerateStep: false,
            showDownloadStep: false,
            currentUploadIndex: 0,
            uploadedCount: 0,
            canGoBack: false,
            canCancel: true
        })

        // 重置图片状态
        const images = this.data.images.map(img => ({
            ...img,
            status: 'waiting'
        }))

        this.setData({
            images: images
        })

        this.startProcessing()
    },

    // 调试函数：手动跳转到结果页面
    debugGoToResult() {
        console.log('手动跳转到结果页面')
        console.log('当前PDF URL:', this.data.pdfUrl)
        console.log('当前任务ID:', this.data.taskId)

        if (!this.data.pdfUrl || !this.data.taskId) {
            wx.showToast({
                title: 'PDF信息不完整',
                icon: 'error'
            })
            return
        }

        // 保存PDF信息到全局数据
        const pdfInfo = {
            url: this.data.pdfUrl,
            taskId: this.data.taskId,
            imageCount: this.data.totalImages,
            createTime: new Date().getTime()
        }

        app.globalData.pdfInfo = pdfInfo
        console.log('手动保存PDF信息到全局数据:', pdfInfo)

        // 立即跳转
        wx.redirectTo({
            url: '/pages/result/result',
            success: () => {
                console.log('手动跳转成功')
            },
            fail: (error) => {
                console.error('手动跳转失败:', error)
                wx.showToast({
                    title: '跳转失败',
                    icon: 'error'
                })
            }
        })
    }
})
