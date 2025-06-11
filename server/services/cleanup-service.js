// services/cleanup-service.js
// 数据清理服务

const fs = require('fs');
const path = require('path');
const PDFHistoryDB = require('../database/pdf-history-db-simple');

class CleanupService {
  constructor() {
    this.historyDB = new PDFHistoryDB();
    this.isRunning = false;
    this.cleanupInterval = null;
    
    // 配置参数
    this.config = {
      // 保留时间（毫秒）- 只保留当天数据
      retentionTime: 24 * 60 * 60 * 1000, // 24小时
      // 清理间隔（毫秒）- 每小时执行一次清理
      cleanupInterval: 60 * 60 * 1000, // 1小时
      // 是否启用自动清理
      autoCleanup: true
    };
  }

  // 启动定时清理服务
  start() {
    if (this.isRunning) {
      console.log('清理服务已在运行中');
      return;
    }

    console.log('启动数据清理服务...');
    console.log(`清理间隔: ${this.config.cleanupInterval / 1000 / 60} 分钟`);
    console.log(`数据保留时间: ${this.config.retentionTime / 1000 / 60 / 60} 小时`);

    // 立即执行一次清理
    this.performCleanup();

    // 设置定时清理
    if (this.config.autoCleanup) {
      this.cleanupInterval = setInterval(() => {
        this.performCleanup();
      }, this.config.cleanupInterval);
    }

    this.isRunning = true;
    console.log('数据清理服务已启动');
  }

  // 停止清理服务
  stop() {
    if (!this.isRunning) {
      console.log('清理服务未在运行');
      return;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.isRunning = false;
    console.log('数据清理服务已停止');
  }

  // 执行清理操作
  async performCleanup() {
    const startTime = new Date();
    console.log(`\n=== 开始数据清理 (${startTime.toLocaleString()}) ===`);

    try {
      // 计算过期时间点
      const expireTime = new Date(Date.now() - this.config.retentionTime);
      console.log(`清理 ${expireTime.toLocaleString()} 之前的数据`);

      // 1. 获取过期记录
      const expiredRecords = this.historyDB.getExpiredRecords(expireTime);
      console.log(`找到 ${expiredRecords.length} 条过期记录`);

      if (expiredRecords.length === 0) {
        console.log('没有需要清理的数据');
        console.log('=== 清理完成 ===\n');
        return;
      }

      // 2. 删除过期的PDF文件
      let deletedPdfCount = 0;
      for (const record of expiredRecords) {
        try {
          if (record.pdf_path && fs.existsSync(record.pdf_path)) {
            fs.unlinkSync(record.pdf_path);
            deletedPdfCount++;
            console.log(`已删除PDF文件: ${path.basename(record.pdf_path)}`);
          }
        } catch (error) {
          console.error(`删除PDF文件失败 ${record.pdf_path}:`, error.message);
        }
      }

      // 3. 删除数据库记录
      let deletedRecordCount = 0;
      for (const record of expiredRecords) {
        try {
          const deleteCount = this.historyDB.deleteHistory(record.task_id);
          if (deleteCount > 0) {
            deletedRecordCount++;
          }
        } catch (error) {
          console.error(`删除数据库记录失败 ${record.task_id}:`, error.message);
        }
      }

      // 4. 清理孤立的上传文件（可选）
      const deletedUploadCount = this.cleanupOrphanedUploads();

      // 5. 输出清理结果
      const endTime = new Date();
      const duration = endTime - startTime;
      
      console.log(`\n清理结果:`);
      console.log(`- 删除PDF文件: ${deletedPdfCount} 个`);
      console.log(`- 删除数据库记录: ${deletedRecordCount} 条`);
      console.log(`- 删除孤立上传文件: ${deletedUploadCount} 个`);
      console.log(`- 清理耗时: ${duration}ms`);
      console.log(`=== 清理完成 (${endTime.toLocaleString()}) ===\n`);

    } catch (error) {
      console.error('数据清理过程中发生错误:', error);
      console.log('=== 清理异常结束 ===\n');
    }
  }

  // 清理孤立的上传文件
  cleanupOrphanedUploads() {
    try {
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        return 0;
      }

      const files = fs.readdirSync(uploadsDir);
      let deletedCount = 0;
      const expireTime = new Date(Date.now() - this.config.retentionTime);

      for (const file of files) {
        try {
          const filePath = path.join(uploadsDir, file);
          const stats = fs.statSync(filePath);
          
          // 如果文件创建时间超过保留时间，则删除
          if (stats.birthtime < expireTime) {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`已删除孤立上传文件: ${file}`);
          }
        } catch (error) {
          console.error(`处理上传文件失败 ${file}:`, error.message);
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('清理孤立上传文件失败:', error);
      return 0;
    }
  }

  // 手动清理指定时间之前的数据
  manualCleanup(beforeDate) {
    console.log(`\n=== 手动清理 ${beforeDate.toLocaleString()} 之前的数据 ===`);
    
    const expiredRecords = this.historyDB.getExpiredRecords(beforeDate);
    console.log(`找到 ${expiredRecords.length} 条记录需要清理`);

    if (expiredRecords.length === 0) {
      console.log('没有需要清理的数据');
      return { deletedPdfCount: 0, deletedRecordCount: 0 };
    }

    let deletedPdfCount = 0;
    let deletedRecordCount = 0;

    // 删除PDF文件和数据库记录
    for (const record of expiredRecords) {
      try {
        // 删除PDF文件
        if (record.pdf_path && fs.existsSync(record.pdf_path)) {
          fs.unlinkSync(record.pdf_path);
          deletedPdfCount++;
        }

        // 删除数据库记录
        const deleteCount = this.historyDB.deleteHistory(record.task_id);
        if (deleteCount > 0) {
          deletedRecordCount++;
        }
      } catch (error) {
        console.error(`清理记录失败 ${record.task_id}:`, error.message);
      }
    }

    console.log(`手动清理完成: PDF文件 ${deletedPdfCount} 个, 数据库记录 ${deletedRecordCount} 条`);
    console.log('=== 手动清理结束 ===\n');

    return { deletedPdfCount, deletedRecordCount };
  }

  // 获取清理统计信息
  getCleanupStats() {
    try {
      const totalRecords = this.historyDB.getHistoryCount();
      const expireTime = new Date(Date.now() - this.config.retentionTime);
      const expiredRecords = this.historyDB.getExpiredRecords(expireTime);
      
      // 统计文件大小
      const uploadsDir = path.join(__dirname, '../uploads');
      const pdfsDir = path.join(__dirname, '../pdfs');
      
      let uploadsSize = 0;
      let pdfsSize = 0;
      
      if (fs.existsSync(uploadsDir)) {
        const uploadFiles = fs.readdirSync(uploadsDir);
        for (const file of uploadFiles) {
          try {
            const stats = fs.statSync(path.join(uploadsDir, file));
            uploadsSize += stats.size;
          } catch (e) {}
        }
      }
      
      if (fs.existsSync(pdfsDir)) {
        const pdfFiles = fs.readdirSync(pdfsDir);
        for (const file of pdfFiles) {
          try {
            const stats = fs.statSync(path.join(pdfsDir, file));
            pdfsSize += stats.size;
          } catch (e) {}
        }
      }

      return {
        totalRecords,
        expiredRecords: expiredRecords.length,
        uploadsSize: this.formatFileSize(uploadsSize),
        pdfsSize: this.formatFileSize(pdfsSize),
        totalSize: this.formatFileSize(uploadsSize + pdfsSize),
        retentionHours: this.config.retentionTime / 1000 / 60 / 60,
        isRunning: this.isRunning
      };
    } catch (error) {
      console.error('获取清理统计信息失败:', error);
      return null;
    }
  }

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 更新配置
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('清理服务配置已更新:', this.config);
    
    // 如果服务正在运行，重启以应用新配置
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

module.exports = CleanupService;
