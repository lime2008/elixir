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
  directCheckAndDownloadUpdate,
  checkFileExists,
  readLocalFileAndComputeMD5,
  readLocalLatestJsAndComputeMD5,
  checkUpdateNeed,
  getUpdateProgress
} from './updateManager';


export * from './types';

const updateModule: types.UpdateModule = {
  checkAndExecuteLatestJs: updateAndExecuteLatestJs,
  checkForUpdates: async () => {
    await checkWasm();
    return checkAndDownloadUpdate(true);
  },
  directCheckForUpdates: async () => {
    await checkWasm();
    return directCheckAndDownloadUpdate();
  },
  checkUpdateNeed,
  executeLatestJs: async () => {
    const localFileResult = await readLocalLatestJsAndComputeMD5();
    if (localFileResult.success && localFileResult.content) {
      return executeJavaScriptCode(localFileResult.content);
    }
    return { success: false, error: '无法读取本地文件' };
  },
  executeJavaScriptCode,
  readLocalFileAndComputeMD5,
  executeProcessedOrLatestJs,
  getRemoteVersionInfo,
  downloadLatestJsUpdate,
  getUpdateProgress
};


export default updateModule;
