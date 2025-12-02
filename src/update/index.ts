// 更新模块入口文件
import * as types from './types';
import {
  checkWasm,
  downloadLatestJsUpdate,
  getRemoteVersionInfo,
  updateAndExecuteLatestJs,
  executeProcessedOrLatestJs,
  processLatestJsWithResources,
  createResourceDirectories,
  deleteFileIfExists,
  downloadResourceToLocal,
  writeFileToPath,
  escapeRegExp,
  executeJavaScriptCode,
  checkAndDownloadUpdate,
  checkFileExists,
  readLocalFileAndComputeMD5,
  readLocalLatestJsAndComputeMD5
} from './updateManager';

// 导出类型
export * from './types';

// 导出主要的公共函数
export {
  checkWasm,
  updateAndExecuteLatestJs,
  checkAndDownloadUpdate,
  executeJavaScriptCode,
  executeProcessedOrLatestJs,
  readLocalLatestJsAndComputeMD5
};

// 定义别名，确保兼容性
const checkAndExecuteLatestJs = updateAndExecuteLatestJs;
export { checkAndExecuteLatestJs };

// 创建更新模块对象，符合UpdateModule接口
const updateModule: types.UpdateModule = {
  // 主更新触发函数
  checkAndExecuteLatestJs: updateAndExecuteLatestJs,
  
  // 检查更新但不执行
  checkForUpdates: async () => {
    await checkWasm();
    return checkAndDownloadUpdate();
  },
  
  // 执行已下载的代码
  executeLatestJs: async () => {
    const localFileResult = await readLocalLatestJsAndComputeMD5();
    if (localFileResult.success && localFileResult.content) {
      return executeJavaScriptCode(localFileResult.content);
    }
    return { success: false, error: '无法读取本地文件' };
  },
  
  // 额外导出这些函数以支持直接调用
  getRemoteVersionInfo,
  downloadLatestJsUpdate
};

// 导出更新模块对象
export default updateModule;
