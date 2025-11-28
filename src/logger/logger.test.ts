// logger模块测试文件
import { log, error, warn, info, debug, getLogs, LogLevel, clearLogs } from './consoleLogger';

export function testLogger() {
  console.log('开始测试日志模块...');
  
  // 清空之前的日志
  clearLogs();
  
  // 测试不同级别的日志记录
  log('这是一条普通日志');
  info('这是一条信息日志');
  warn('这是一条警告日志');
  error('这是一条错误日志');
  debug('这是一条调试日志');
  
  // 测试获取所有日志
  const allLogs = getLogs();
  console.log(`所有日志数量: ${allLogs.length}`);
  allLogs.forEach(log => {
    console.log(`[${log.level}] ${log.message.join(', ')} - ${log.timestamp.toISOString()}`);
  });
  
  // 测试按级别获取日志
  const errorLogs = getLogs(LogLevel.ERROR);
  console.log(`错误日志数量: ${errorLogs.length}`);
  
  // 验证日志内容是否正确
  if (allLogs.length >= 5) {
    console.log('✓ 日志记录测试通过');
  } else {
    console.error('✗ 日志记录测试失败：日志数量不足');
  }
  
  if (errorLogs.length >= 1 && errorLogs[0].level === LogLevel.ERROR) {
    console.log('✓ 按级别获取日志测试通过');
  } else {
    console.error('✗ 按级别获取日志测试失败');
  }
  
  console.log('日志模块测试完成');
  return {
    success: allLogs.length >= 5 && errorLogs.length >= 1,
    allLogsCount: allLogs.length,
    errorLogsCount: errorLogs.length
  };
}

// 导出一个简单的测试函数供外部调用
export const loggerTest = testLogger;