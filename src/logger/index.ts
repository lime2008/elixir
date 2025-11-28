// logger模块统一导出文件
import {
  log,
  info,
  warn,
  error,
  debug,
  getLogs,
  getLatestLogs,
  getLogsByTimeRange,
  clearLogs,
  setMaxLogs,
  exportLogsAsJSON,
  searchLogs,
  LogLevel,
  LogMessage
} from './consoleLogger';
import { testLogger } from './logger.test';

// 重新导出所有内容
export {
  log,
  info,
  warn,
  error,
  debug,
  getLogs,
  getLatestLogs,
  getLogsByTimeRange,
  clearLogs,
  setMaxLogs,
  exportLogsAsJSON,
  searchLogs,
  LogLevel,
  LogMessage,
  testLogger
};

// 导出一个默认对象，方便使用
export default {
  // 日志记录方法
  log,
  info,
  warn,
  error,
  debug,
  
  // 日志获取和管理方法
  getLogs,
  getLatestLogs,
  getLogsByTimeRange,
  clearLogs,
  setMaxLogs,
  exportLogsAsJSON,
  searchLogs,
  
  // 类型
  LogLevel,
  
  // 测试功能
  testLogger
};