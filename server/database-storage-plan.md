# PDF生成记录数据库存储方案

## 当前存储问题

### 内存存储的限制
- ❌ **数据丢失** - 服务器重启后历史记录全部丢失
- ❌ **内存限制** - 大量记录占用过多内存
- ❌ **无法扩展** - 多服务器实例无法共享数据
- ❌ **无法备份** - 数据无法持久化备份

### 文件存储的问题
- ❌ **磁盘占用** - PDF文件持续占用磁盘空间
- ❌ **清理困难** - 需要手动清理过期文件
- ❌ **性能影响** - 大量文件影响文件系统性能

## 推荐的数据库存储方案

### 1. SQLite方案（推荐用于小型应用）

#### 优势
- ✅ **轻量级** - 无需额外数据库服务器
- ✅ **零配置** - 开箱即用
- ✅ **持久化** - 数据永久保存
- ✅ **事务支持** - 数据一致性保证

#### 数据库表设计
```sql
-- PDF生成历史记录表
CREATE TABLE pdf_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id VARCHAR(36) UNIQUE NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    image_count INTEGER NOT NULL,
    file_size INTEGER NOT NULL,
    page_count INTEGER NOT NULL,
    pdf_path VARCHAR(500) NOT NULL,
    download_url VARCHAR(500) NOT NULL,
    status VARCHAR(20) DEFAULT 'completed',
    processing_time INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    metadata TEXT -- JSON格式存储额外信息
);

-- 原始图片信息表
CREATE TABLE pdf_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id VARCHAR(36) NOT NULL,
    image_id VARCHAR(36) NOT NULL,
    original_name VARCHAR(255),
    file_path VARCHAR(500),
    file_size INTEGER,
    image_index INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES pdf_history(task_id)
);

-- 用户统计表
CREATE TABLE user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(100) NOT NULL,
    total_pdfs INTEGER DEFAULT 0,
    total_images INTEGER DEFAULT 0,
    total_file_size INTEGER DEFAULT 0,
    last_activity DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化
CREATE INDEX idx_pdf_history_user_id ON pdf_history(user_id);
CREATE INDEX idx_pdf_history_created_at ON pdf_history(created_at);
CREATE INDEX idx_pdf_images_task_id ON pdf_images(task_id);
```

#### 实现示例
```javascript
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class PDFHistoryDB {
  constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, 'pdf_history.db'));
    this.initTables();
  }

  initTables() {
    // 创建表的SQL语句...
  }

  async addHistory(historyData) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO pdf_history 
        (task_id, user_id, filename, image_count, file_size, page_count, 
         pdf_path, download_url, processing_time, completed_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        historyData.taskId,
        historyData.userId,
        historyData.filename,
        historyData.imageCount,
        historyData.fileSize,
        historyData.pageCount,
        historyData.pdfPath,
        historyData.downloadUrl,
        historyData.processingTime,
        historyData.completedAt,
        JSON.stringify(historyData.metadata)
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  async getHistory(userId, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM pdf_history 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
      
      this.db.all(sql, [userId, limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async deleteHistory(taskId) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('DELETE FROM pdf_images WHERE task_id = ?', [taskId]);
        this.db.run('DELETE FROM pdf_history WHERE task_id = ?', [taskId], function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        });
      });
    });
  }
}
```

### 2. MongoDB方案（推荐用于大型应用）

#### 优势
- ✅ **文档存储** - 适合复杂数据结构
- ✅ **水平扩展** - 支持分片和集群
- ✅ **高性能** - 优秀的读写性能
- ✅ **灵活查询** - 强大的查询语言

#### 数据模型设计
```javascript
// PDF历史记录文档
{
  _id: ObjectId,
  taskId: "uuid",
  userId: "user123",
  filename: "document.pdf",
  originalImages: [
    {
      imageId: "uuid",
      originalName: "image1.jpg",
      filePath: "/uploads/uuid.jpg",
      fileSize: 1024000,
      index: 0
    }
  ],
  imageCount: 3,
  fileSize: 2048000,
  pageCount: 3,
  pdfPath: "/pdfs/uuid.pdf",
  downloadUrl: "/pdfs/uuid.pdf",
  status: "completed",
  processingTime: 5000,
  createdAt: ISODate,
  completedAt: ISODate,
  metadata: {
    version: "1.0",
    userAgent: "...",
    ipAddress: "..."
  }
}
```

### 3. MySQL/PostgreSQL方案（推荐用于企业应用）

#### 优势
- ✅ **ACID事务** - 强一致性保证
- ✅ **成熟稳定** - 经过大量生产环境验证
- ✅ **丰富生态** - 大量工具和扩展
- ✅ **标准SQL** - 易于维护和迁移

## 文件存储优化方案

### 1. 云存储方案
```javascript
// 使用阿里云OSS、腾讯云COS、AWS S3等
const OSS = require('ali-oss');

class CloudStorage {
  constructor() {
    this.client = new OSS({
      region: 'oss-cn-hangzhou',
      accessKeyId: 'your-access-key',
      accessKeySecret: 'your-secret-key',
      bucket: 'pdf-storage'
    });
  }

  async uploadPDF(filePath, fileName) {
    const result = await this.client.put(fileName, filePath);
    return result.url;
  }

  async deletePDF(fileName) {
    await this.client.delete(fileName);
  }
}
```

### 2. 文件清理策略
```javascript
// 定期清理过期文件
class FileCleanup {
  constructor(retentionDays = 30) {
    this.retentionDays = retentionDays;
  }

  async cleanupExpiredFiles() {
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() - this.retentionDays);

    // 查询过期记录
    const expiredRecords = await db.getExpiredRecords(expireDate);

    for (const record of expiredRecords) {
      // 删除PDF文件
      if (fs.existsSync(record.pdfPath)) {
        fs.unlinkSync(record.pdfPath);
      }

      // 删除数据库记录
      await db.deleteHistory(record.taskId);
    }
  }

  startScheduledCleanup() {
    // 每天凌晨2点执行清理
    setInterval(() => {
      this.cleanupExpiredFiles();
    }, 24 * 60 * 60 * 1000);
  }
}
```

## 实施建议

### 阶段1：SQLite迁移（立即实施）
1. 安装SQLite依赖：`npm install sqlite3`
2. 创建数据库初始化脚本
3. 修改PDF生成逻辑，保存到数据库
4. 更新历史记录查询接口

### 阶段2：文件管理优化（短期）
1. 实现文件清理策略
2. 添加文件压缩功能
3. 实现文件备份机制

### 阶段3：云存储迁移（中期）
1. 集成云存储服务
2. 实现文件上传下载
3. 优化CDN加速

### 阶段4：数据库升级（长期）
1. 根据业务规模选择合适的数据库
2. 实现数据迁移
3. 优化查询性能

## 总结

当前的内存存储方案适合开发和测试阶段，但对于生产环境建议：

1. **立即实施** - SQLite数据库存储
2. **短期优化** - 文件清理和管理策略
3. **中期规划** - 云存储集成
4. **长期考虑** - 企业级数据库方案

这样可以确保数据的持久性、可靠性和可扩展性。
