// database/pdf-history-db-simple.js
// 简化版SQLite数据库实现

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class PDFHistoryDB {
  constructor(dbPath = null) {
    // 确保数据库目录存在
    const dbDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // 数据库文件路径
    this.dbPath = dbPath || path.join(dbDir, 'pdf_history.db');
    
    // 创建数据库连接
    try {
      this.db = new Database(this.dbPath);
      console.log('SQLite数据库连接成功:', this.dbPath);
    } catch (err) {
      console.error('数据库连接失败:', err.message);
      throw err;
    }

    // 初始化数据库表
    this.initTables();
  }

  // 初始化数据库表
  initTables() {
    try {
      // 创建历史记录表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS pdf_history (
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
          metadata TEXT
        )
      `);
      
      // 创建索引
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_pdf_history_user_id ON pdf_history(user_id)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_pdf_history_created_at ON pdf_history(created_at)');
      
      console.log('数据库表初始化完成');
    } catch (err) {
      console.error('数据库表初始化失败:', err);
      throw err;
    }
  }

  // 添加历史记录
  addHistory(historyData) {
    try {
      const sql = `
        INSERT INTO pdf_history 
        (task_id, user_id, filename, image_count, file_size, page_count, 
         pdf_path, download_url, status, processing_time, completed_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const stmt = this.db.prepare(sql);
      const result = stmt.run([
        historyData.taskId,
        historyData.userId,
        historyData.filename,
        historyData.imageCount,
        historyData.fileSize,
        historyData.pageCount,
        historyData.pdfPath,
        historyData.downloadUrl,
        historyData.status || 'completed',
        historyData.processingTime,
        historyData.completedAt ? historyData.completedAt.toISOString() : new Date().toISOString(),
        JSON.stringify(historyData.metadata || {})
      ]);
      
      console.log('历史记录已添加到数据库, ID:', result.lastInsertRowid);
      return result.lastInsertRowid;
    } catch (err) {
      console.error('添加历史记录失败:', err);
      throw err;
    }
  }

  // 获取历史记录列表
  getHistory(userId = null, limit = 50, offset = 0) {
    try {
      let sql = 'SELECT * FROM pdf_history';
      let params = [];
      
      if (userId) {
        sql += ' WHERE user_id = ?';
        params.push(userId);
      }
      
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(params);
      
      // 解析metadata字段
      return rows.map(row => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : {}
      }));
    } catch (err) {
      console.error('获取历史记录失败:', err);
      throw err;
    }
  }

  // 获取历史记录总数
  getHistoryCount(userId = null) {
    try {
      let sql = 'SELECT COUNT(*) as total FROM pdf_history';
      let params = [];
      
      if (userId) {
        sql += ' WHERE user_id = ?';
        params.push(userId);
      }

      const stmt = this.db.prepare(sql);
      const row = stmt.get(params);
      return row.total;
    } catch (err) {
      console.error('获取历史记录总数失败:', err);
      throw err;
    }
  }

  // 获取单个历史记录详情
  getHistoryDetail(taskId) {
    try {
      const sql = 'SELECT * FROM pdf_history WHERE task_id = ?';
      const stmt = this.db.prepare(sql);
      const row = stmt.get([taskId]);
      
      if (!row) {
        return null;
      }

      return {
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        originalImages: [] // 简化版本不存储原始图片信息
      };
    } catch (err) {
      console.error('获取历史记录详情失败:', err);
      throw err;
    }
  }

  // 删除历史记录
  deleteHistory(taskId) {
    try {
      const sql = 'DELETE FROM pdf_history WHERE task_id = ?';
      const stmt = this.db.prepare(sql);
      const result = stmt.run([taskId]);
      
      console.log('历史记录已删除, 影响行数:', result.changes);
      return result.changes;
    } catch (err) {
      console.error('删除历史记录失败:', err);
      throw err;
    }
  }

  // 清空用户历史记录
  clearUserHistory(userId = null) {
    try {
      let sql, params;
      
      if (userId) {
        sql = 'DELETE FROM pdf_history WHERE user_id = ?';
        params = [userId];
      } else {
        sql = 'DELETE FROM pdf_history';
        params = [];
      }
      
      const stmt = this.db.prepare(sql);
      const result = stmt.run(params);
      
      console.log('历史记录已清空, 影响行数:', result.changes);
      return result.changes;
    } catch (err) {
      console.error('清空历史记录失败:', err);
      throw err;
    }
  }

  // 获取过期记录（用于清理）
  getExpiredRecords(expireDate) {
    try {
      const sql = 'SELECT task_id, pdf_path, user_id FROM pdf_history WHERE created_at < ?';
      const stmt = this.db.prepare(sql);
      return stmt.all([expireDate.toISOString()]);
    } catch (err) {
      console.error('获取过期记录失败:', err);
      throw err;
    }
  }

  // 关闭数据库连接
  close() {
    try {
      this.db.close();
      console.log('数据库连接已关闭');
    } catch (err) {
      console.error('关闭数据库连接失败:', err);
    }
  }
}

module.exports = PDFHistoryDB;
