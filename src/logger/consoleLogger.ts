// 控制台消息类型
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  LOG = 'log'
}

// 日志消息接口
export interface LogMessage {
  id: string;
  level: LogLevel;
  message: any[];
  timestamp: Date;
  stack?: string;
}

class ConsoleLogger {
  private logs: Map<LogLevel, LogMessage[]> = new Map();
  private maxLogs: number = 1000; // 每个级别的最大日志数量
  private isInitialized: boolean = false;
  
  constructor() {
    try {
      // 确保Map和Array可用
      this.logs = new Map([
        [LogLevel.DEBUG, []],
        [LogLevel.INFO, []],
        [LogLevel.WARN, []],
        [LogLevel.ERROR, []],
        [LogLevel.LOG, []]
      ]);
      this.isInitialized = true;
    } catch (e) {
      // 如果初始化失败，使用降级方案
      this.isInitialized = false;
      // 至少尝试使用原始console输出错误
      if (typeof console.error === 'function') {
        console.error('Logger initialization failed:', e);
      }
    }
  }
  
  private generateId(): string {
    try {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    } catch (e) {
      return 'id_' + Math.floor(Math.random() * 1000000);
    }
  }
  
  private addLog(level: LogLevel, ...args: any[]): void {
    try {
      // 记录原始的console行为 - 这是最关键的，确保即使内部逻辑失败也能输出日志
      const originalConsoleMethod = console[level as keyof Console];
      if (typeof originalConsoleMethod === 'function') {
        const timestamp = new Date();
        const formattedTime = timestamp.toISOString().replace('T', ' ').replace(/\..+/, '') + 
            '.' + timestamp.getMilliseconds().toString().padStart(3, '0');
        const timestampedArgs = [`[${formattedTime}]`, ...args];
        try {
          Function.prototype.apply.call(originalConsoleMethod, console, timestampedArgs);
        } catch (e) {
          // 直接使用console.log作为后备方案
          if (typeof console.log === 'function') {
            console.log(...args);
          }
        }
      }
      
      // 如果初始化失败，就不进行日志存储
      if (!this.isInitialized) {
        return;
      }
      
      // 创建日志对象
      const log: LogMessage = {
        id: this.generateId(),
        level,
        message: args,
        timestamp: new Date()
      };
      
      // 如果是错误，尝试捕获堆栈
      if (level === LogLevel.ERROR) {
        try {
          throw new Error('Stack capture');
        } catch (e) {
          if (e instanceof Error) {
            log.stack = e.stack?.split('\n').slice(2).join('\n') || undefined;
          }
        }
      }
      
      // 添加到对应级别的日志列表
      const logs = this.logs.get(level) || [];
      logs.push(log);
      
      // 限制日志数量
      if (logs.length > this.maxLogs) {
        logs.shift(); // 移除最旧的日志
      }
      
      this.logs.set(level, logs);
    } catch (e) {
      // 确保即使addLog内部出错也不会影响程序运行
      if (typeof console.error === 'function') {
        console.error('Error in logger.addLog:', e);
      }
    }
  }
  
  // 各种日志方法
  debug(...args: any[]): void {
    try {
      this.addLog(LogLevel.DEBUG, ...args);
    } catch (e) {
      if (typeof console.debug === 'function') {
        console.debug(...args);
      } else if (typeof console.log === 'function') {
        console.log(...args);
      }
    }
  }
  
  info(...args: any[]): void {
    try {
      this.addLog(LogLevel.INFO, ...args);
    } catch (e) {
      if (typeof console.info === 'function') {
        console.info(...args);
      } else if (typeof console.log === 'function') {
        console.log(...args);
      }
    }
  }
  
  warn(...args: any[]): void {
    try {
      this.addLog(LogLevel.WARN, ...args);
    } catch (e) {
      if (typeof console.warn === 'function') {
        console.warn(...args);
      } else if (typeof console.log === 'function') {
        console.log(...args);
      }
    }
  }
  
  error(...args: any[]): void {
    try {
      this.addLog(LogLevel.ERROR, ...args);
    } catch (e) {
      if (typeof console.error === 'function') {
        console.error(...args);
      } else if (typeof console.log === 'function') {
        console.log(...args);
      }
    }
  }
  
  log(...args: any[]): void {
    try {
      this.addLog(LogLevel.LOG, ...args);
    } catch (e) {
      // 最后防线，确保即使addLog出错也能输出
      if (typeof console.log === 'function') {
        console.log(...args);
      }
    }
  }
  
  // 获取指定级别的日志
  getLogs(level?: LogLevel): LogMessage[] {
    try {
      if (!this.isInitialized) {
        return [];
      }
      
      if (level) {
        return [...(this.logs.get(level) || [])];
      }
      
      // 如果不指定级别，返回所有日志并按时间戳排序
      const allLogs: LogMessage[] = [];
      this.logs.forEach(logs => {
        if (Array.isArray(logs)) {
          allLogs.push(...logs);
        }
      });
      
      return allLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (e) {
      if (typeof console.error === 'function') {
        console.error('Error in logger.getLogs:', e);
      }
      return [];
    }
  }
  
  // 获取最新的N条日志
  getLatestLogs(count: number, level?: LogLevel): LogMessage[] {
    try {
      const logs = this.getLogs(level);
      return logs.slice(-count);
    } catch (e) {
      if (typeof console.error === 'function') {
        console.error('Error in logger.getLatestLogs:', e);
      }
      return [];
    }
  }
  
  // 获取指定时间范围内的日志
  getLogsByTimeRange(startTime: Date, endTime: Date, level?: LogLevel): LogMessage[] {
    try {
      return this.getLogs(level).filter(log => 
        log && log.timestamp && log.timestamp >= startTime && log.timestamp <= endTime
      );
    } catch (e) {
      if (typeof console.error === 'function') {
        console.error('Error in logger.getLogsByTimeRange:', e);
      }
      return [];
    }
  }
  
  // 清空指定级别的日志
  clearLogs(level?: LogLevel): void {
    try {
      if (!this.isInitialized) {
        return;
      }
      
      if (level) {
        this.logs.set(level, []);
      } else {
        // 清空所有日志
        this.logs.forEach((_, key) => {
          this.logs.set(key, []);
        });
      }
    } catch (e) {
      if (typeof console.error === 'function') {
        console.error('Error in logger.clearLogs:', e);
      }
    }
  }
  
  // 设置最大日志数量
  setMaxLogs(maxLogs: number): void {
    try {
      if (!this.isInitialized || maxLogs <= 0) {
        return;
      }
      
      this.maxLogs = maxLogs;
      // 立即应用新的限制
      this.logs.forEach((logs, level) => {
        if (logs && logs.length > maxLogs) {
          this.logs.set(level, logs.slice(-maxLogs));
        }
      });
    } catch (e) {
      if (typeof console.error === 'function') {
        console.error('Error in logger.setMaxLogs:', e);
      }
    }
  }
  
  // 导出日志为JSON
  exportLogsAsJSON(level?: LogLevel): string {
    try {
      const logs = this.getLogs(level);
      return JSON.stringify(logs, (key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      }, 2);
    } catch (e) {
      if (typeof console.error === 'function') {
        console.error('Error in logger.exportLogsAsJSON:', e);
      }
      return '[]';
    }
  }
  
  // 搜索日志内容
  searchLogs(query: string, level?: LogLevel): LogMessage[] {
    try {
      const logs = this.getLogs(level);
      const lowercaseQuery = query.toLowerCase();
      
      return logs.filter(log => {
        if (!log || !log.message) {
          return false;
        }
        
        // 搜索日志消息内容
        return log.message.some(arg => {
          try {
            const argStr = String(arg).toLowerCase();
            return argStr.includes(lowercaseQuery);
          } catch {
            return false;
          }
        });
      });
    } catch (e) {
      if (typeof console.error === 'function') {
        console.error('Error in logger.searchLogs:', e);
      }
      return [];
    }
  }
}

// 创建单例实例
export const consoleLogger = new ConsoleLogger();

// 导出与console同名的方法，方便替换
export const { 
  debug, 
  info, 
  warn, 
  error, 
  log,
  getLogs,
  getLatestLogs,
  getLogsByTimeRange,
  clearLogs,
  setMaxLogs,
  exportLogsAsJSON,
  searchLogs
} = consoleLogger;