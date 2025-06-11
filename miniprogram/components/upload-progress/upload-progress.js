// components/upload-progress/upload-progress.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: '上传进度'
    },
    percent: {
      type: Number,
      value: 0
    },
    statusText: {
      type: String,
      value: '准备中...'
    },
    detail: {
      type: String,
      value: ''
    },
    showCancel: {
      type: Boolean,
      value: true
    },
    showRetry: {
      type: Boolean,
      value: false
    },
    showActions: {
      type: Boolean,
      value: true
    }
  },

  data: {
    // 组件内部数据
  },

  methods: {
    // 取消操作
    onCancel() {
      this.triggerEvent('cancel')
    },

    // 重试操作
    onRetry() {
      this.triggerEvent('retry')
    }
  }
})
