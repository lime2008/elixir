import { compute_md5, initSync } from './wasm/elixir';
import elixirInit from './wasm/elixir';
import * as fileModule from './file';
import { log, error, info, warn, debug, getLogs, getLatestLogs, getLogsByTimeRange, clearLogs, setMaxLogs, exportLogsAsJSON, searchLogs, LogLevel } from './logger/consoleLogger';
import * as networkModule from './network';
import { checkNetworkConnection } from './network';
import updateModule from './update';

let wasmInitialized = false;
const checkWasm = async (): Promise<boolean> => {
  if(wasmInitialized) {
    return true;
  }
  try {
    log('WASM模块未初始化，正在初始化...');
    await elixirInit();
    wasmInitialized = true;
    log('WASM模块初始化成功');
    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    error('WASM模块初始化失败:', errorMessage);
    return false;
  }
}

async function initApp() {
  log('初始化Cordova应用');
  await checkWasm();
  const isOnline = await checkNetworkConnection();
  log(`网络连接状态: ${isOnline ? '在线' : '离线'}`);
  if (!isOnline) {
    document.addEventListener('deviceready', async()=>{log('无网络连接，优先尝试执行处理过的文件');
      await updateModule.executeProcessedOrLatestJs();
    }, false);
  } else {
    log('有网络连接，执行完整的检查和更新流程');
    document.addEventListener('deviceready', updateModule.checkAndExecuteLatestJs, false);
  }
  (window as any).ELIXIR = {
    showNotification: (message: string) => {
      log(`显示通知: ${message}`);
      if ((window as any).cordova?.plugins?.notification) {
        (window as any).cordova.plugins.notification.local.schedule({
          title: 'Cordova应用',
          text: message
        });
      }
    },
    
    getDeviceInfo: () => {
      if ((window as any).device) {
        const device = (window as any).device;
        return {
          model: device.model,
          platform: device.platform,
          version: device.version,
          uuid: device.uuid
        };
      }
      return { error: 'Device plugin not available' };
    },
    
    computeMD5: (text: string): string => {
      if (!wasmInitialized) {
        error('WASM模块尚未初始化，无法计算MD5');
        return '';
      }
      try {
          const md5Result = compute_md5(text);
          log(`计算MD5成功: ${text} -> ${md5Result}`);
          return md5Result;
        } catch (err) {
          error('计算MD5失败:', err);
          return '';
        }
    },
    
    // 日志功能 - 从logger模块导入
    logger: {
      // 日志记录方法
      log,
      info,
      warn,
      error,
      debug,
      
      // 日志管理方法
      getLogs,
      getLatestLogs,
      getLogsByTimeRange,
      clearLogs,
      setMaxLogs,
      exportLogsAsJSON,
      searchLogs,
      
      // 日志级别枚举
      LogLevel
    },
    
    // 文件操作功能 - 从file模块导入
    file: {
      // 文件ID管理
      rfid: fileModule.rfid,
      gcFid: fileModule.gcFid,
      fidMap: fileModule.fidMap,
      isValidFid: fileModule.isValidFid,
      
      // 文件操作函数
      openFileUrl: fileModule.openFileUrl,
      checkIsDir: fileModule.checkIsDir,
      checkIsFile: fileModule.checkIsFile,
      newFile: fileModule.newFile,
      newDir: fileModule.newDir,
      openChildrenFile: fileModule.openChildrenFile,
      openChildrenDir: fileModule.openChildrenDir,
      getChildrens: fileModule.getChildrens,
      removeFile: fileModule.removeFile,
      readFile: fileModule.readFile,
      writeFile: fileModule.writeFile
    },
    
    // 网络状态功能 - 从network模块导入
    network: {
      // WiFi网络信息
      getWiFiIPAddress: networkModule.getWiFiIPAddress,
      getWiFiSubnet: networkModule.getWiFiSubnet,
      getWiFiGateway: networkModule.getWiFiGateway,
      getWiFiMac: networkModule.getWiFiMac,
      getWiFiInfo: networkModule.getWiFiInfo,
      
      // 移动网络信息
      getCarrierIPAddress: networkModule.getCarrierIPAddress,
      getCarrierSubnet: networkModule.getCarrierSubnet,
      getCarrierGateway: networkModule.getCarrierGateway,
      getCarrierMac: networkModule.getCarrierMac,
      getCarrierInfo: networkModule.getCarrierInfo,
      
      // 获取所有网络信息
      getAllNetworkInfo: networkModule.getAllNetworkInfo,
      
      // 检查网络连接状态
      checkNetworkConnection: checkNetworkConnection
    },
    
    // 更新功能 - 从update模块导入
    update: updateModule
  };
}
initApp()