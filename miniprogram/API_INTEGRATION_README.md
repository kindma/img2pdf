# 小程序端API集成说明

## 修改概述

本次修改将小程序端代码与服务端API接口进行了完整对接，确保前后端接口完全匹配。

## 主要修改内容

### 1. API接口路径修改

**文件：** `utils/api.js`

- 所有API接口路径添加了 `/api` 前缀
- 上传接口路径修改为 `/api/file/upload`
- 用户信息接口路径修改为 `/api/auth/user/info`
- 新增统计接口：获取使用统计和统计摘要

**修改前：**
```javascript
url: '/auth/login'
url: '/file/info/${fileId}'
url: '/pdf/generate'
```

**修改后：**
```javascript
url: '/api/auth/login'
url: '/api/file/info/${fileId}'
url: '/api/pdf/generate'
```

### 2. 用户登录集成

**文件：** `app.js`

- 添加了完整的用户登录流程
- 集成微信登录和后端认证
- 自动保存和管理用户token
- 添加登录统计记录

**新增功能：**
```javascript
// 用户登录
async doLogin() {
  const loginRes = await this.wxLogin()
  const loginResult = await api.user.login(loginRes.code)
  // 保存token和记录统计
}
```

### 3. 文件上传优化

**文件：** `utils/util.js`, `pages/processing/processing.js`

- 使用新的API接口进行文件上传
- 添加token认证头
- 优化错误处理和响应解析
- 保存服务器返回的文件信息

**主要改进：**
- 统一使用 `api.file.uploadImage()` 方法
- 添加上传进度统计记录
- 改进错误处理机制

### 4. PDF生成流程重构

**文件：** `pages/processing/processing.js`

- 使用服务端的任务队列模式
- 实现状态轮询机制
- 添加详细的进度反馈
- 集成下载链接获取

**核心流程：**
1. 调用 `api.pdf.generatePDF()` 创建任务
2. 使用 `api.pdf.getGenerateStatus()` 轮询状态
3. 通过 `api.pdf.getDownloadUrl()` 获取下载链接

### 5. 分享功能增强

**文件：** `pages/result/result.js`

- 集成服务端分享链接创建
- 添加分享统计记录
- 支持分享链接过期管理

**新增功能：**
```javascript
// 创建分享链接
const shareResult = await api.share.createShare(taskId)
// 记录分享统计
await api.stats.recordUsage('pdf_share_link', {...})
```

### 6. 统计系统集成

**文件：** 所有主要页面

- 添加页面访问统计
- 记录用户操作行为
- 集成完整的数据分析

**统计事件：**
- `index_page_view` - 首页访问
- `images_selected` - 图片选择
- `conversion_start` - 开始转换
- `upload_start` - 开始上传
- `pdf_generate_start` - PDF生成开始
- `pdf_generate_complete` - PDF生成完成
- `result_page_view` - 结果页访问
- `pdf_preview` - PDF预览
- `pdf_download` - PDF下载
- `pdf_share_link` - 分享链接

### 7. 配置管理优化

**文件：** `config/config.js`, `app.js`

- 更新服务器配置以匹配后端
- 添加API配置参数
- 统一配置管理

**配置更新：**
```javascript
server: {
  development: {
    baseUrl: 'http://localhost:3000',
    apiUrl: 'http://localhost:3000/api',
    uploadUrl: 'http://localhost:3000/api/file/upload'
  }
}
```

## 接口对应关系

| 功能 | 小程序端方法 | 服务端接口 | 说明 |
|------|-------------|------------|------|
| 用户登录 | `api.user.login()` | `POST /api/auth/login` | 微信登录认证 |
| 获取用户信息 | `api.user.getUserInfo()` | `GET /api/auth/user/info` | 用户基本信息 |
| 上传图片 | `api.file.uploadImage()` | `POST /api/file/upload` | 图片文件上传 |
| 获取文件信息 | `api.file.getFileInfo()` | `GET /api/file/info/:fileId` | 文件详情查询 |
| 删除文件 | `api.file.deleteFile()` | `DELETE /api/file/:fileId` | 文件删除 |
| 生成PDF | `api.pdf.generatePDF()` | `POST /api/pdf/generate` | 创建PDF生成任务 |
| 查询生成状态 | `api.pdf.getGenerateStatus()` | `GET /api/pdf/status/:taskId` | 任务状态查询 |
| 获取下载链接 | `api.pdf.getDownloadUrl()` | `GET /api/pdf/download/:taskId` | PDF下载链接 |
| 获取分享链接 | `api.pdf.getShareUrl()` | `GET /api/pdf/share/:taskId` | PDF分享链接 |
| 创建分享 | `api.share.createShare()` | `POST /api/share/create` | 创建分享记录 |
| 获取分享信息 | `api.share.getShareInfo()` | `GET /api/share/:shareId` | 分享详情查询 |
| 记录统计 | `api.stats.recordUsage()` | `POST /api/stats/usage` | 使用统计记录 |
| 获取统计 | `api.stats.getUsageStats()` | `GET /api/stats/usage` | 统计数据查询 |
| 统计摘要 | `api.stats.getStatsSummary()` | `GET /api/stats/summary` | 统计摘要信息 |

## 测试说明

**测试文件：** `utils/test-api.js`

提供了完整的API测试工具，可以验证：
- 网络连接状态
- 登录接口功能
- 统计接口功能
- 其他接口的基本连通性

**使用方法：**
```javascript
const { testConnection, testLogin } = require('./utils/test-api.js')

// 测试网络连接
await testConnection()

// 测试登录功能
await testLogin()
```

## 注意事项

1. **服务器地址配置**：需要在 `config/config.js` 中配置正确的服务器地址
2. **Token管理**：登录后的token会自动保存到本地存储
3. **错误处理**：所有API调用都包含完整的错误处理机制
4. **统计数据**：用户操作会自动记录到服务端统计系统
5. **文件管理**：上传的文件信息会保存服务器返回的完整数据

## 部署建议

1. 确保服务端API正常运行
2. 更新小程序配置中的服务器地址
3. 测试所有核心功能流程
4. 验证统计数据记录是否正常
5. 检查文件上传和PDF生成功能

通过这些修改，小程序端已经完全适配了服务端API接口，实现了完整的前后端集成。
