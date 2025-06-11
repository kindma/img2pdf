// pages/history/history.js
const { api } = require('../../utils/api.js')
const util = require('../../utils/util.js')
const app = getApp()

Page({
  data: {
    historyList: [], // 历史记录列表
    isLoading: false, // 加载状态
    hasMore: true, // 是否还有更多数据
    currentPage: 0, // 当前页码
    pageSize: 20, // 每页数量
    total: 0, // 总数量
    isEmpty: false, // 是否为空
    isRefreshing: false // 是否正在刷新
  },

  onLoad(options) {
    console.log('历史记录页面加载')
    this.loadHistoryList()
    
    // 记录页面访问统计
    api.stats.recordUsage('history_page_view', {
      timestamp: new Date().getTime()
    }).catch(err => console.log('记录页面访问统计失败:', err))
  },

  onShow: function() {
    console.log('历史页面显示')
    // 每次页面显示时强制刷新历史记录
    this.forceRefreshHistory()
  },

  onPullDownRefresh() {
    this.refreshHistoryList()
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadMoreHistory()
    }
  },

  // 加载历史记录列表
  async loadHistoryList(forceLoad = false, noCache = false) {
    if (this.data.isLoading && !forceLoad) return
    
    this.setData({ isLoading: true })

    try {
      const params = {
        limit: this.data.pageSize,
        offset: this.data.currentPage * this.data.pageSize
      }

      // 如果有用户token，添加到参数中作为userId
      const token = wx.getStorageSync('token')
      if (token) {
        params.userId = token
      }
      
      // 添加时间戳参数，避免缓存
      if (noCache) {
        params._t = new Date().getTime()
      }

      console.log('加载历史记录参数:', params, '强制加载:', forceLoad)
      const result = await api.pdf.getHistory(params)
      console.log('历史记录加载结果:', result)

      if (result.success && result.data) {
        const newList = this.data.currentPage === 0 ? 
          result.data.records : 
          [...this.data.historyList, ...result.data.records]
          
        // 处理每条记录，预先格式化文件大小和时间
        const processedList = newList.map(item => {
          // 预先格式化文件大小
          let fileSizeText = '未知大小';
          if (item.file_size) {
            try {
              const sizeNum = Number(item.file_size);
              if (!isNaN(sizeNum)) {
                fileSizeText = app.utils.formatFileSize(sizeNum);
              }
            } catch (e) {
              console.error('格式化文件大小出错:', e);
            }
          }
          
          // 预先格式化创建时间
          let createdTimeText = '未知时间';
          if (item.created_at) {
            try {
              createdTimeText = util.formatTime(new Date(item.created_at));
            } catch (e) {
              console.error('格式化时间出错:', e);
            }
          }
          
          // 返回处理后的记录，添加格式化后的字段
          return {
            ...item,
            fileSizeText: fileSizeText,
            createdTimeText: createdTimeText
          };
        });

        this.setData({
          historyList: processedList,
          total: result.data.total,
          hasMore: processedList.length < result.data.total,
          isEmpty: processedList.length === 0,
          currentPage: this.data.currentPage + 1
        })
        
        // 打印一下第一条记录的数据结构，帮助调试
        if (processedList.length > 0) {
          console.log('历史记录第一条数据:', processedList[0]);
        }
      } else {
        throw new Error(result.message || '获取历史记录失败')
      }
    } catch (error) {
      console.error('加载历史记录失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    } finally {
      this.setData({ 
        isLoading: false,
        isRefreshing: false
      })
      wx.stopPullDownRefresh()
    }
  },

  // 强制刷新历史记录（onShow专用）
  async forceRefreshHistory() {
    console.log('强制刷新历史记录数据')

    try {
      // 显示加载状态
      this.setData({
        isLoading: true,
        isRefreshing: true,
        currentPage: 0,
        hasMore: true,
        historyList: [] // 清空当前列表，强制重新加载
      })

      // 添加时间戳参数，避免缓存
      await this.loadHistoryList(true, true)

      console.log('强制刷新完成，当前记录数:', this.data.historyList.length)
    } catch (error) {
      console.error('强制刷新历史记录失败:', error)
    } finally {
      this.setData({
        isLoading: false,
        isRefreshing: false
      })
    }
  },

  // 刷新历史记录
  async refreshHistoryList() {
    this.setData({
      currentPage: 0,
      hasMore: true,
      isRefreshing: true
    })
    await this.loadHistoryList()
  },

  // 加载更多历史记录
  async loadMoreHistory() {
    await this.loadHistoryList()
  },

  // 查看PDF详情
  viewPDFDetail(e) {
    const { taskid } = e.currentTarget.dataset
    console.log(taskid)
    const record = this.data.historyList.find(item => item.task_id === taskid)
    
    if (!record) {
      wx.showToast({
        title: '记录不存在',
        icon: 'error'
      })
      return
    }

    // 记录查看详情统计
    api.stats.recordUsage('history_view_detail', {
      taskId: taskid,
      timestamp: new Date().getTime()
    }).catch(err => console.log('记录查看详情统计失败:', err))

    // 设置全局PDF信息并跳转到结果页面
    // 智能处理downloadUrl，避免重复拼接域名
    console.log(record)
    let pdfUrl = record.download_url;
    if (pdfUrl && !pdfUrl.startsWith('http')) {
      // 如果是相对路径，拼接服务器地址
      pdfUrl = `${app.globalData.serverUrl}${pdfUrl}`;
    }

    console.log('历史记录PDF信息:', {
      originalUrl: record.download_url,
      finalUrl: pdfUrl,
      taskId: record.task_id
    });

    // 如果没有文件大小，可以在这里设置一个标记，让结果页面尝试获取
    const needFetchFileSize = !record.file_size;

    app.globalData.pdfInfo = {
      url: pdfUrl,
      taskId: record.task_id,
      imageCount: record.image_count,
      createTime: new Date(record.created_at).getTime(),
      fileSize: record.file_size,
      needFetchFileSize: needFetchFileSize
    }
 
    wx.navigateTo({
      url: '/pages/result/result'
    })
  },

  // 删除历史记录
  deleteHistory(e) {
    const { taskid } = e.currentTarget.dataset
    const record = this.data.historyList.find(item => item.taskId === taskid)
    
    if (!record) return

    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${record.filename}"吗？删除后无法恢复。`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' })
            
            const result = await api.pdf.deleteHistory(taskid)
            
            if (result.success) {
              // 记录删除统计
              api.stats.recordUsage('history_delete', {
                taskId: taskid,
                timestamp: new Date().getTime()
              }).catch(err => console.log('记录删除统计失败:', err))

              // 从列表中移除
              const newList = this.data.historyList.filter(item => item.taskId !== taskid)
              this.setData({
                historyList: newList,
                isEmpty: newList.length === 0,
                total: this.data.total - 1
              })

              wx.showToast({
                title: '删除成功',
                icon: 'success'
              })
            } else {
              throw new Error(result.message || '删除失败')
            }
          } catch (error) {
            console.error('删除历史记录失败:', error)
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            })
          } finally {
            wx.hideLoading()
          }
        }
      }
    })
  },

  // 清空所有历史记录
  clearAllHistory() {
    if (this.data.historyList.length === 0) {
      wx.showToast({
        title: '暂无记录',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有历史记录吗？此操作无法恢复。',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '清空中...' })
            
            const token = wx.getStorageSync('token')
            const result = await api.pdf.clearHistory(token)
            
            if (result.success) {
              // 记录清空统计
              api.stats.recordUsage('history_clear_all', {
                count: this.data.historyList.length,
                timestamp: new Date().getTime()
              }).catch(err => console.log('记录清空统计失败:', err))

              this.setData({
                historyList: [],
                isEmpty: true,
                total: 0,
                currentPage: 0,
                hasMore: true
              })

              wx.showToast({
                title: '清空成功',
                icon: 'success'
              })
            } else {
              throw new Error(result.message || '清空失败')
            }
          } catch (error) {
            console.error('清空历史记录失败:', error)
            wx.showToast({
              title: '清空失败',
              icon: 'error'
            })
          } finally {
            wx.hideLoading()
          }
        }
      }
    })
  }, 

  // 返回首页
  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  }
})







