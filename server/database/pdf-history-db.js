// database/pdf-history-db.js
// SQLite数据库实现示例

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
    const createHistoryTable = `
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
    `;

    const createImagesTable = `
      CREATE TABLE IF NOT EXISTS pdf_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id VARCHAR(36) NOT NULL,
        image_id VARCHAR(36) NOT NULL,
        original_name VARCHAR(255),
        file_path VARCHAR(500),
        file_size INTEGER,
        image_index INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES pdf_history(task_id)
      )
    `;

    try {
      this.db.exec(createHistoryTable);
      this.db.exec(createImagesTable);

      // 创建索引
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_pdf_history_user_id ON pdf_history(user_id)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_pdf_history_created_at ON pdf_history(created_at)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_pdf_images_task_id ON pdf_images(task_id)');

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

      const params = [
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
      ];

      const stmt = this.db.prepare(sql);
      const result = stmt.run(params);

      console.log('历史记录已添加到数据库, ID:', result.lastInsertRowid);

      // 如果有原始图片信息，也保存到数据库
      if (historyData.originalImages && historyData.originalImages.length > 0) {
        const imageSql = `
          INSERT INTO pdf_images
          (task_id, image_id, original_name, file_path, file_size, image_index)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        const imageStmt = this.db.prepare(imageSql);

        historyData.originalImages.forEach((image, index) => {
          imageStmt.run([
            historyData.taskId,
            image.id || `image_${index}`,
            image.originalName || image.filename,
            image.path || image.filePath,
            image.size || image.fileSize,
            index
          ]);
        });
      }

      return result.lastInsertRowid;
    } catch (err) {
      console.error('添加历史记录失败:', err);
      throw err;
    }
  }

  // 获取历史记录列表
  getHistory(userId = null, limit = 50, offset = 0) {
    try {
      let sql = `
        SELECT h.*,
               COUNT(i.id) as actual_image_count
        FROM pdf_history h
        LEFT JOIN pdf_images i ON h.task_id = i.task_id
      `;

      let params = [];

      if (userId) {
        sql += ' WHERE h.user_id = ?';
        params.push(userId);
      }

      sql += `
        GROUP BY h.id
        ORDER BY h.created_at DESC
        LIMIT ? OFFSET ?
      `;

      params.push(limit, offset);

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(params);

      // 解析metadata字段
      const records = rows.map(row => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : {}
      }));

      return records;
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
  async getHistoryDetail(taskId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT h.*, 
               GROUP_CONCAT(
                 json_object(
                   'id', i.image_id,
                   'originalName', i.original_name,
                   'filePath', i.file_path,
                   'fileSize', i.file_size,
                   'index', i.image_index
                 )
               ) as images_json
        FROM pdf_history h
        LEFT JOIN pdf_images i ON h.task_id = i.task_id
        WHERE h.task_id = ?
        GROUP BY h.id
      `;

      this.db.get(sql, [taskId], (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          // 解析图片信息
          let originalImages = [];
          if (row.images_json) {
            try {
              originalImages = row.images_json.split(',').map(img => JSON.parse(img));
            } catch (e) {
              console.error('解析图片信息失败:', e);
            }
          }

          resolve({
            ...row,
            metadata: row.metadata ? JSON.parse(row.metadata) : {},
            originalImages
          });
        }
      });
    });
  }

  // 删除历史记录
  async deleteHistory(taskId) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('DELETE FROM pdf_images WHERE task_id = ?', [taskId]);
        this.db.run('DELETE FROM pdf_history WHERE task_id = ?', [taskId], function(err) {
          if (err) {
            console.error('删除历史记录失败:', err);
            reject(err);
          } else {
            console.log('历史记录已删除, 影响行数:', this.changes);
            resolve(this.changes);
          }
        });
      });
    });
  }

  // 清空用户历史记录
  async clearUserHistory(userId = null) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        if (userId) {
          // 清空指定用户的历史记录
          // 先删除图片记录
          this.db.run(`
            DELETE FROM pdf_images
            WHERE task_id IN (
              SELECT task_id FROM pdf_history WHERE user_id = ?
            )
          `, [userId]);

          // 再删除历史记录
          this.db.run('DELETE FROM pdf_history WHERE user_id = ?', [userId], function(err) {
            if (err) {
              console.error('清空用户历史记录失败:', err);
              reject(err);
            } else {
              console.log('用户历史记录已清空, 影响行数:', this.changes);
              resolve(this.changes);
            }
          });
        } else {
          // 清空所有历史记录
          this.db.run('DELETE FROM pdf_images', function(err) {
            if (err) {
              console.error('清空图片记录失败:', err);
              reject(err);
              return;
            }

            this.db.run('DELETE FROM pdf_history', function(err) {
              if (err) {
                console.error('清空历史记录失败:', err);
                reject(err);
              } else {
                console.log('所有历史记录已清空, 影响行数:', this.changes);
                resolve(this.changes);
              }
            });
          });
        }
      });
    });
  }

  // 获取过期记录（用于清理）
  async getExpiredRecords(expireDate) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT task_id, pdf_path, user_id 
        FROM pdf_history 
        WHERE created_at < ?
      `;

      this.db.all(sql, [expireDate.toISOString()], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // 关闭数据库连接
  close() {
    return new Promise((resolve) => {
      this.db.close((err) => {
        if (err) {
          console.error('关闭数据库连接失败:', err);
        } else {
          console.log('数据库连接已关闭');
        }
        resolve();
      });
    });
  }
}

module.exports = PDFHistoryDB;
