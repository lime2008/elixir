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


export * from './types';

const updateModule: types.UpdateModule = {
  checkAndExecuteLatestJs: updateAndExecuteLatestJs,
  checkForUpdates: async () => {
    await checkWasm();
    return checkAndDownloadUpdate(true);
  },
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
  downloadLatestJsUpdate
};


export default updateModule;
