// 更新管理器 - 处理应用更新和资源下载
import { compute_md5, initSync } from '../wasm/elixir';
import elixirInit from '../wasm/elixir';
import { openFileUrl, readFile, openChildrenFile, newFile, writeFile } from '../file/fileOperations';
import { downloadResourceToDirectory } from '../file/download';
import { log, error } from '../logger/consoleLogger';
import { checkNetworkConnection } from '../network';
import * as fileModule from '../file';
import * as networkModule from '../network';
import * as types from './types';

// 定义常量
//@ts-ignore
const ANDROID_FILE_PATH = 'file:///storage/emulated/0/Android/data/'+(window.PKG) as string+'/files/';
const LATEST_JS_FILE = 'latest.js';
const LATEST_PROCESSED_FILE = 'latest_processed.js';
const LOCK_FILE = 'lock.lock';
const UPDATE_SERVER_URL = 'https://open.lihouse.xyz/apk/elixir/query/';

// 资源分类存储目录
const RESOURCE_DIRS = {
  JS: 'js/',
  CSS: 'css/',
  IMAGES: {
    JPG: 'jpg/',
    PNG: 'png/'
  }
};

// 资源URL匹配正则表达式
const RESOURCE_URL_REGEX = /https:\/\/(?:[a-zA-Z0-9\-_]+\.)*(?:codemao\.cn|bcmcdn\.com)\/[a-zA-Z0-9\-_\.\/]+(?:\.jsx?|\.css|\.png|\.jpg|\.jpeg|\.gif|\.svg|\.webp)(?:\?[a-zA-Z0-9\-_=&]*)?/gi;
// WASM初始化状态
let wasmInitialized = false;

// 更新进度状态
let currentUpdateProgress: types.UpdateProgress = {
  isUpdating: false,
  currentStep: types.UpdateStep.IDLE,
  progressPercentage: 0,
  stepDescription: '空闲状态'
};

// 资源处理进度跟踪
let resourceProcessingProgress = {
  totalResources: 0,
  downloadedResources: 0,
  currentResourceUrl: ''
};

/**
 * 检查WASM模块是否初始化
 */
export const checkWasm = async (): Promise<boolean> => {
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
};

/**
 * 下载更新文件
 */
export async function downloadLatestJsUpdate(url: string): Promise<types.DownloadResult> {
  return new Promise(async (resolve) => {
    log(`开始下载更新文件: ${url}`);
    
    // 更新进度状态
    updateProgress(types.UpdateStep.DOWNLOADING_JS, 0, '开始下载远程JS文件');
    
    // 使用downloadResourceToDirectory函数下载文件到指定目录
    downloadResourceToDirectory(url, ANDROID_FILE_PATH, async (result) => {
      if (!result.s) {
        error(`下载更新文件失败: ${JSON.stringify(result.err)}`);
        updateProgress(types.UpdateStep.FAILED, 0, '下载远程JS文件失败', `下载失败: ${JSON.stringify(result.err)}`);
        resolve({ success: false, error: `下载失败: ${JSON.stringify(result.err)}` });
        return;
      }
      
      log('更新文件下载成功');
      updateProgress(types.UpdateStep.DOWNLOADING_JS, 50, '远程JS文件下载完成，开始处理资源');
      
      // 尝试删除旧的处理文件和锁文件
      try {
        await deleteFileIfExists(LATEST_PROCESSED_FILE);
        await deleteFileIfExists(LOCK_FILE);
        log('已清理旧的处理文件和锁文件');
      } catch (err) {
        log(`清理旧处理文件时出错: ${err}`);
      }
      
      // 下载成功后，重新读取文件内容
      openFileUrl(ANDROID_FILE_PATH, (dirResult) => {
        if (!dirResult.s) {
          resolve({ success: false, error: `无法打开目录: ${JSON.stringify(dirResult.err)}` });
          return;
        }
        
        const dirFid = dirResult.fid;
        if (!dirFid) {
          resolve({ success: false, error: '获取目录ID失败' });
          return;
        }
        
        openChildrenFile(dirFid, LATEST_JS_FILE, (fileResult) => {
          if (!fileResult.s) {
            resolve({ success: false, error: `无法打开文件: ${JSON.stringify(fileResult.err)}` });
            return;
          }
          
          const fileFid = fileResult.fid;
          if (!fileFid) {
            resolve({ success: false, error: '获取文件ID失败' });
            return;
          }
          
          readFile(fileFid, 'Text', async (readResult) => {
            if (!readResult.s) {
              resolve({ success: false, error: `无法读取文件内容: ${JSON.stringify(readResult.err)}` });
              return;
            }
            
            const content = readResult.data as string;
            
            // 如果有内容，处理资源文件
            if (content) {
              log('开始处理资源文件');
              updateProgress(types.UpdateStep.PROCESSING_RESOURCES, 60, '开始处理资源文件');
              const processResult = await processLatestJsWithResources(content);
              if (processResult.success) {
                log('资源文件处理成功');
                updateProgress(types.UpdateStep.PROCESSING_RESOURCES, 100, '资源文件处理完成');
              } else {
                log(`资源文件处理失败: ${processResult.error}`);
                // 处理失败不影响更新，只是不会生成processed文件
                updateProgress(types.UpdateStep.PROCESSING_RESOURCES, 100, '资源文件处理完成（部分失败）');
              }
            }
            
            updateProgress(types.UpdateStep.COMPLETED, 100, '更新流程完成');
            resolve({ success: true, content });
          });
        });
      });
    }, LATEST_JS_FILE);
  });
}

/**
 * 获取远程版本信息
 */
export async function getRemoteVersionInfo(): Promise<types.RemoteVersionInfo> {
  return new Promise((resolve) => {
    // 获取packageName
    const packageName = (window as any).PKG;
    const fullUrl = `${UPDATE_SERVER_URL}${encodeURIComponent(packageName)}`;
    
    log(`开始获取远程版本信息: ${fullUrl}`);
    
    // 创建XMLHttpRequest对象
    const xhr = new XMLHttpRequest();
    xhr.open('GET', fullUrl, true);
    xhr.responseType = 'json';
    
    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          const response = xhr.response;
          if (response && response.status) {
            log(`成功获取远程版本信息，MD5: ${response.data.md5}`);
            resolve({ 
              success: true, 
              md5: response.data.md5, 
              url: response.data.url,
              isForced: response.data.ifForced || false
            });
          } else {
            error('远程版本信息格式不正确');
            resolve({ success: false, error: '远程版本信息格式不正确' });
          }
        } catch (err) {
          error(`解析远程版本信息失败: ${err}`);
          resolve({ success: false, error: `解析远程版本信息失败: ${err}` });
        }
      } else {
        error(`获取远程版本信息失败，状态码: ${xhr.status}`);
        resolve({ success: false, error: `获取远程版本信息失败，状态码: ${xhr.status}` });
      }
    };
    
    xhr.onerror = function() {
      error('获取远程版本信息网络错误');
      resolve({ success: false, error: '网络连接错误' });
    };
    
    xhr.timeout = 10000; // 10秒超时
    xhr.ontimeout = function() {
      error('获取远程版本信息超时');
      resolve({ success: false, error: '请求超时' });
    };
    
    xhr.send();
  });
}

/**
 * 主更新触发函数
 */
export async function updateAndExecuteLatestJs(): Promise<types.UpdateAndExecuteResult> {
  try {
    log('====================================');
    log('开始执行更新和代码加载流程');
    
    // 重置进度状态
    resetProgress();
    
    // 确保WASM模块已初始化（用于MD5计算）
    updateProgress(types.UpdateStep.IDLE, 5, '初始化WASM模块');
    const wasmReady = await checkWasm();
    if (!wasmReady) {
      log('WASM初始化失败，无法进行MD5计算');
      updateProgress(types.UpdateStep.FAILED, 0, 'WASM初始化失败', 'WASM模块初始化失败，无法进行MD5计算');
      // 即使WASM初始化失败，也尝试执行处理过的或最新的JS文件
      const executeResult = await executeProcessedOrLatestJs();
      if (executeResult.success) {
        log('成功执行本地JS文件');
        updateProgress(types.UpdateStep.COMPLETED, 100, '更新流程完成（使用本地文件）');
        log('====================================');
        return { 
          success: true, 
          updated: false, 
          executed: true 
        };
      }
      return { 
        success: false, 
        updated: false, 
        executed: false, 
        error: 'WASM模块初始化失败，无法进行MD5计算' 
      };
    }
    
    // 在热更新检查前，先执行本地的处理过的JS文件或latest.js
    log('热更新检查前，先执行本地JS文件');
    updateProgress(types.UpdateStep.EXECUTING_CODE, 10, '执行本地JS文件');
    const executeResult = await executeProcessedOrLatestJs();

    // 如果首次执行成功，说明已经有可用的本地文件，后续检查更新后不需要重复执行
    if (executeResult.success) {
      log('首次执行本地JS文件成功，后续检查更新后不需要重复执行');
      updateProgress(types.UpdateStep.EXECUTING_CODE, 50, '本地JS文件执行成功，检查更新');
      
      // 检查更新并下载（但不执行新内容，因为已经有可用的本地文件）
      updateProgress(types.UpdateStep.IDLE, 60, '检查远程更新');
      const updateResult = await checkAndDownloadUpdate(true);
      log(`更新检查结果: 成功=${updateResult.success}, 需要更新=${updateResult.needUpdate}, 强制更新=${updateResult.isForced}`);
      
      if (!updateResult.success) {
        log(`更新检查失败: ${updateResult.error}`);
        updateProgress(types.UpdateStep.COMPLETED, 100, '更新流程完成（检查失败但本地文件可用）');
        // 更新检查失败，但首次执行已经成功，所以整体流程成功
        log('====================================');
        return { 
          success: true, 
          updated: updateResult.needUpdate || false, 
          executed: true 
        };
      }
      
      // 更新检查成功，但不需要重复执行，因为首次执行已经成功
      updateProgress(types.UpdateStep.COMPLETED, 100, '更新流程完成');
      log('====================================');
      return { 
        success: true, 
        updated: updateResult.needUpdate, 
        executed: true 
      };
    } else {
      // 首次执行失败，说明本地文件可能不存在或有问题，需要进入更新流程
      log(`首次执行本地JS文件失败: ${executeResult.error}`);
      updateProgress(types.UpdateStep.IDLE, 20, '本地文件不可用，开始更新流程');
      
      // 检查更新并下载
      updateProgress(types.UpdateStep.IDLE, 30, '检查远程更新');
      const updateResult = await checkAndDownloadUpdate(false);
      log(`更新检查结果: 成功=${updateResult.success}, 需要更新=${updateResult.needUpdate}`);
      
      if (!updateResult.success) {
        log(`更新检查失败: ${updateResult.error}`);
        updateProgress(types.UpdateStep.FAILED, 0, '更新检查失败', `首次执行失败: ${executeResult.error}, 更新检查失败: ${updateResult.error}`);
        // 更新检查失败，且首次执行也失败，整体流程失败
        return { 
          success: false, 
          updated: updateResult.needUpdate || false, 
          executed: false, 
          error: `首次执行失败: ${executeResult.error}, 更新检查失败: ${updateResult.error}` 
        };
      }
      
      // 如果有代码内容或需要更新，处理资源并执行代码
      if (updateResult.content || updateResult.needUpdate) {
        // 先尝试执行处理过的文件
        updateProgress(types.UpdateStep.EXECUTING_CODE, 80, '执行处理过的JS文件');
        const executeResult = await executeProcessedOrLatestJs();
        if (executeResult.success) {
          log('成功执行处理过的JS文件');
          updateProgress(types.UpdateStep.COMPLETED, 100, '更新流程完成');
          log('====================================');
          return { 
            success: true, 
            updated: updateResult.needUpdate, 
            executed: true 
          };
        }
        
        // 如果处理过的文件执行失败，且有新内容，则直接执行新内容
        if (updateResult.content) {
          updateProgress(types.UpdateStep.EXECUTING_CODE, 90, '执行最新JS文件');
          const directExecuteResult = executeJavaScriptCode(updateResult.content);
          if (directExecuteResult.success) {
            log('latest.js代码执行成功');
            updateProgress(types.UpdateStep.COMPLETED, 100, '更新流程完成');
            log('====================================');
            return { 
              success: true, 
              updated: updateResult.needUpdate, 
              executed: true 
            };
          } else {
            log(`latest.js代码执行失败: ${directExecuteResult.error}`);
            updateProgress(types.UpdateStep.FAILED, 0, '代码执行失败', directExecuteResult.error);
            log('====================================');
            return { 
              success: false, 
              updated: updateResult.needUpdate, 
              executed: false, 
              error: directExecuteResult.error 
            };
          }
        }
      }
      
      log('没有可执行的代码内容');
      updateProgress(types.UpdateStep.FAILED, 0, '没有可执行的代码内容');
      log('====================================');
      return { 
        success: false, 
        updated: updateResult.needUpdate, 
        executed: false, 
        error: '没有可执行的代码内容' 
      };
    }
   } catch (err) {
     const errorMessage = err instanceof Error ? err.message : String(err);
     error(`更新和执行流程发生错误: ${errorMessage}`);
    
    // 出现错误时，尝试执行处理过的或最新的JS文件
    try {
      const executeResult = await executeProcessedOrLatestJs();
      if (executeResult.success) {
        log('成功执行本地JS文件');
        log('====================================');
        return { 
          success: true, 
          updated: false, 
          executed: true 
        };
      }
    } catch (executeError) {
      error('执行本地JS文件时也出错', executeError);
    }
    
    log('====================================');
    return { 
      success: false, 
      updated: false, 
      executed: false, 
      error: errorMessage 
    };
  }
}

/**
 * 优先执行处理过的JS文件，如果不存在则执行原始文件
 */
export async function executeProcessedOrLatestJs(): Promise<types.JavaScriptExecutionResult> {
  try {
    log('尝试执行处理过的JS文件');
    
    // 首先检查处理过的文件是否存在
    const processedFileExists = await checkFileExists(LATEST_PROCESSED_FILE);
    // 检查lock.lock文件是否存在
    const lockFileExists = await checkFileExists(LOCK_FILE);
    
    // 只有当处理过的文件和锁文件都存在时，才执行处理过的文件
    if (processedFileExists && lockFileExists) {
      log('处理过的文件和锁文件都存在，尝试读取并执行');
      // 打开目录
      const dirResult = await new Promise<any>((resolve) => {
        openFileUrl(ANDROID_FILE_PATH, resolve);
      });
      
      if (!dirResult.s || !dirResult.fid) {
        throw new Error('无法打开目录');
      }
      
      // 打开处理过的文件
      const fileResult = await new Promise<any>((resolve) => {
        openChildrenFile(dirResult.fid, LATEST_PROCESSED_FILE, resolve);
      });
      
      if (!fileResult.s || !fileResult.fid) {
        throw new Error('无法打开处理过的文件');
      }
      
      // 读取文件内容
      const readResult = await new Promise<any>((resolve) => {
        readFile(fileResult.fid, 'Text', resolve);
      });
      
      if (!readResult.s) {
        throw new Error(`读取文件内容失败: ${JSON.stringify(readResult.err)}`);
      }
      
      const content = readResult.data as string;
      log('成功读取处理过的JS文件，开始执行');
      return executeJavaScriptCode(content);
    } else if (processedFileExists) {
      log('处理过的文件存在，但锁文件不存在，说明处理未完成，需要重新处理');
      // 尝试读取原始文件并重新处理
      const localFileResult = await readLocalLatestJsAndComputeMD5();
      if (localFileResult.success && localFileResult.content) {
        log('开始重新处理资源文件');
        const processResult = await processLatestJsWithResources(localFileResult.content);
        if (processResult.success && processResult.processedContent) {
          log('重新处理成功，执行处理后的内容');
          return executeJavaScriptCode(processResult.processedContent);
        }
      }
      return { success: false, error: '重新处理资源失败' };
    } else {
      log('处理过的文件不存在，尝试执行原始latest.js文件');
      // 读取并执行原始latest.js文件
      const localFileResult = await readLocalLatestJsAndComputeMD5();
      if (localFileResult.success && localFileResult.content) {
        log('成功读取原始JS文件，开始执行');
        return executeJavaScriptCode(localFileResult.content);
      }
      return { success: false, error: '原始latest.js文件不存在或读取失败' };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`执行处理过的JS文件失败: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * 处理资源文件，下载并转换URL
 */
export async function processLatestJsWithResources(content: string): Promise<types.ResourceProcessResult> {
  return new Promise(async (resolve) => {
    try {
      log('开始处理latest.js中的资源文件');
      
      // 1. 删除旧的processed文件和lock文件
      updateProgress(types.UpdateStep.PROCESSING_RESOURCES, 0, '清理旧文件');
      await deleteFileIfExists(LATEST_PROCESSED_FILE);
      await deleteFileIfExists(LOCK_FILE);
      
      // 2. 提取所有匹配的资源URL
      updateProgress(types.UpdateStep.PROCESSING_RESOURCES, 10, '分析资源URL');
      const resourceUrls = Array.from(content.matchAll(RESOURCE_URL_REGEX), match => match[0]);
      log(`发现 ${resourceUrls.length} 个需要处理的资源URL`);
      
      // 初始化资源处理进度
      resourceProcessingProgress = {
        totalResources: resourceUrls.length,
        downloadedResources: 0,
        currentResourceUrl: ''
      };
      
      if (resourceUrls.length === 0) {
          // 没有资源需要处理，直接创建processed文件
          updateProgress(types.UpdateStep.PROCESSING_RESOURCES, 50, '没有资源需要处理，创建文件');
          const writeResult = await writeFileToPath(`${ANDROID_FILE_PATH}${LATEST_PROCESSED_FILE}`, content);
          if (!writeResult.success) {
            updateProgress(types.UpdateStep.FAILED, 0, '写入processed文件失败', `写入processed文件失败: ${writeResult.error}`);
            return resolve({ success: false, error: `写入processed文件失败: ${writeResult.error}` });
          }
          
          // 创建lock文件
          updateProgress(types.UpdateStep.PROCESSING_RESOURCES, 80, '创建锁文件');
          const lockResult = await writeFileToPath(`${ANDROID_FILE_PATH}${LOCK_FILE}`, '');
          if (!lockResult.success) {
            // 如果lock文件创建失败，删除已创建的processed文件
            await deleteFileIfExists(LATEST_PROCESSED_FILE);
            updateProgress(types.UpdateStep.FAILED, 0, '创建锁文件失败', `创建lock文件失败: ${lockResult.error}`);
            return resolve({ success: false, error: `创建lock文件失败: ${lockResult.error}` });
          }
          
          updateProgress(types.UpdateStep.PROCESSING_RESOURCES, 100, '资源处理完成（无资源）');
        return resolve({ success: true, processedContent: content });
      }
      
      // 3. 创建资源目录
      updateProgress(types.UpdateStep.PROCESSING_RESOURCES, 20, '创建资源目录');
      await createResourceDirectories();
      
      // 4. 下载资源并构建URL映射
      updateProgress(types.UpdateStep.PROCESSING_RESOURCES, 30, '开始下载资源文件');
      const urlMappings: { [key: string]: string } = {};
      let allDownloaded = true;
      
      // 并行下载所有资源，提高效率
      const downloadPromises = resourceUrls.map(async (resourceUrl, index) => {
        // 更新当前下载的资源URL
        resourceProcessingProgress.currentResourceUrl = resourceUrl;
        
        const downloadResult = await downloadResourceToLocal(resourceUrl);
        if (downloadResult.success && downloadResult.localPath) {
          urlMappings[resourceUrl] = downloadResult.localPath;
          log(`成功下载并映射资源: ${resourceUrl} -> ${downloadResult.localPath}`);
          
          // 更新下载进度
          resourceProcessingProgress.downloadedResources++;
          const progress = 30 + Math.floor((resourceProcessingProgress.downloadedResources / resourceProcessingProgress.totalResources) * 50);
          updateProgress(
            types.UpdateStep.PROCESSING_RESOURCES, 
            progress, 
            `下载资源中 (${resourceProcessingProgress.downloadedResources}/${resourceProcessingProgress.totalResources})`
          );
          
          return true;
        } else {
          log(`资源下载失败: ${resourceUrl}, 错误: ${downloadResult.error}`);
          
          // 更新下载进度（即使失败也计数）
          resourceProcessingProgress.downloadedResources++;
          const progress = 30 + Math.floor((resourceProcessingProgress.downloadedResources / resourceProcessingProgress.totalResources) * 50);
          updateProgress(
            types.UpdateStep.PROCESSING_RESOURCES, 
            progress, 
            `下载资源中 (${resourceProcessingProgress.downloadedResources}/${resourceProcessingProgress.totalResources}) - 部分失败`
          );
          
          return false;
        }
      });
      
      // 等待所有下载完成
      const downloadResults = await Promise.all(downloadPromises);
      // 检查是否所有资源都下载成功
      allDownloaded = downloadResults.every(result => result);
      
      // 5. 替换内容中的URL
      updateProgress(types.UpdateStep.PROCESSING_RESOURCES, 85, '替换资源URL');
      let processedContent = content;
      for (const [originalUrl, localPath] of Object.entries(urlMappings)) {
        processedContent = processedContent.replace(new RegExp(escapeRegExp(originalUrl), 'g'), localPath);
      }
      
      // 6. 写入processed文件
      updateProgress(types.UpdateStep.PROCESSING_RESOURCES, 90, '写入处理后的文件');
      const writeResult = await writeFileToPath(`${ANDROID_FILE_PATH}${LATEST_PROCESSED_FILE}`, processedContent);
      if (!writeResult.success) {
        updateProgress(types.UpdateStep.FAILED, 0, '写入processed文件失败', `写入processed文件失败: ${writeResult.error}`);
        return resolve({ success: false, error: `写入processed文件失败: ${writeResult.error}` });
      }
      
      // 7. 创建lock文件
      updateProgress(types.UpdateStep.PROCESSING_RESOURCES, 95, '创建锁文件');
      const lockResult = await writeFileToPath(`${ANDROID_FILE_PATH}${LOCK_FILE}`, '');
      if (!lockResult.success) {
        // 如果lock文件创建失败，删除已创建的processed文件
        await deleteFileIfExists(LATEST_PROCESSED_FILE);
        updateProgress(types.UpdateStep.FAILED, 0, '创建锁文件失败', `创建lock文件失败: ${lockResult.error}`);
        return resolve({ success: false, error: `创建lock文件失败: ${lockResult.error}` });
      }
      
      log(`资源处理完成，${allDownloaded ? '所有' : '部分'}资源下载成功`);
      updateProgress(types.UpdateStep.PROCESSING_RESOURCES, 100, '资源处理完成');
      return resolve({ success: true, processedContent });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error(`处理资源时发生错误: ${errorMessage}`);
      // 清理可能创建的文件
      await deleteFileIfExists(LATEST_PROCESSED_FILE);
      await deleteFileIfExists(LOCK_FILE);
      updateProgress(types.UpdateStep.FAILED, 0, '资源处理失败', errorMessage);
      return resolve({ success: false, error: errorMessage });
    }
  });
}

/**
 * 工具函数：创建资源目录
 */
export async function createResourceDirectories(): Promise<void> {
  return new Promise((resolve) => {
    // 打开主目录
    openFileUrl(ANDROID_FILE_PATH, (dirResult) => {
      if (!dirResult.s) {
        error(`无法打开主目录: ${ANDROID_FILE_PATH}`);
        resolve();
        return;
      }
      
      const dirFid = dirResult.fid;
      if (!dirFid) {
        error('获取主目录ID失败');
        resolve();
        return;
      }
      
      // 创建所有资源目录，使用并行方式，不依赖顺序
      const directories = [
        RESOURCE_DIRS.JS,
        RESOURCE_DIRS.CSS,
        RESOURCE_DIRS.IMAGES.JPG,
        RESOURCE_DIRS.IMAGES.PNG
      ];
      
      let createdCount = 0;
      let totalDirectories = directories.length;
      
      const createDirCallback = (result: any) => {
        createdCount++;
        if (createdCount === totalDirectories) {
          resolve();
        }
      };
      
      directories.forEach(dir => {
        fileModule.newDir(dirFid, false, dir, createDirCallback);
      });
    });
  });
}

/**
 * 工具函数：删除文件（如果存在）
 */
export async function deleteFileIfExists(filename: string): Promise<void> {
  return new Promise((resolve) => {
    openFileUrl(ANDROID_FILE_PATH, (dirResult: any) => {
      if (!dirResult.s) {
        resolve();
        return;
      }
      
      const dirFid = dirResult.fid;
      if (!dirFid) {
        resolve();
        return;
      }
      
      openChildrenFile(dirFid, filename, (fileResult: any) => {
        if (fileResult.s && fileResult.fid) {
          fileModule.removeFile(fileResult.fid, () => {
            log(`已删除文件: ${filename}`);
            resolve();
          });
        } else {
          resolve();
        }
      });
    });
  });
}

/**
 * 获取更新进度信息
 */
export function getUpdateProgress(): types.UpdateProgress {
  return { ...currentUpdateProgress };
}

/**
 * 更新进度状态
 */
function updateProgress(step: types.UpdateStep, percentage: number, description: string, error?: string) {
  currentUpdateProgress = {
    isUpdating: step !== types.UpdateStep.IDLE && step !== types.UpdateStep.COMPLETED && step !== types.UpdateStep.FAILED,
    currentStep: step,
    progressPercentage: percentage,
    stepDescription: description,
    error: error
  };
  
  // 记录进度日志
  log(`更新进度: ${step} (${percentage}%) - ${description}`);
}

/**
 * 重置进度状态
 */
function resetProgress() {
  updateProgress(types.UpdateStep.IDLE, 0, '空闲状态');
  resourceProcessingProgress = {
    totalResources: 0,
    downloadedResources: 0,
    currentResourceUrl: ''
  };
}

/**
 * 工具函数：下载资源到本地
 */
export async function downloadResourceToLocal(resourceUrl: string): Promise<types.ResourceDownloadResult> {
  return new Promise((resolve) => {
    try {
      // 确定资源类型和存储路径
      let resourceType = '';
      let localDir = '';
      
      // 处理包含查询参数的URL，先去掉查询参数再匹配扩展名
      const urlWithoutParams = resourceUrl.split('?')[0];
      
      if (urlWithoutParams.match(/\.jsx?$/i)) {
        resourceType = 'JS';
        localDir = RESOURCE_DIRS.JS;
      } else if (urlWithoutParams.match(/\.css$/i)) {
        resourceType = 'CSS';
        localDir = RESOURCE_DIRS.CSS;
      } else if (urlWithoutParams.match(/\.jpg$/i) || urlWithoutParams.match(/\.jpeg$/i)) {
        resourceType = 'JPG';
        localDir = RESOURCE_DIRS.IMAGES.JPG;
      } else if (urlWithoutParams.match(/\.png$/i)) {
        resourceType = 'PNG';
        localDir = RESOURCE_DIRS.IMAGES.PNG;
      } else {
        // 记录不支持的资源类型，但不直接返回错误，而是记录日志后继续
        log(`不支持的资源类型: ${resourceUrl}`);
        resolve({ success: false, error: `不支持的资源类型: ${resourceUrl}` });
        return;
      }
      
      // 生成本地文件名（使用URL的hash作为文件名以避免冲突）
      const filename = `${compute_md5(resourceUrl).substring(0, 16)}.${resourceUrl.split('.').pop()?.split('?')[0] || resourceType.toLowerCase()}`;
      const fullLocalPath = `${ANDROID_FILE_PATH}${localDir}${filename}`;
      
      // 下载资源
      downloadResourceToDirectory(resourceUrl, `${ANDROID_FILE_PATH}${localDir}`, (result) => {
        if (!result.s) {
          resolve({ success: false, error: `下载失败: ${JSON.stringify(result.err)}` });
          return;
        }
        
        log(`资源下载成功: ${resourceUrl} -> ${fullLocalPath}`);
        resolve({ success: true, localPath: fullLocalPath });
      }, filename);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      resolve({ success: false, error: errorMessage });
    }
  });
}

/**
 * 工具函数：写入文件到指定路径
 */
export async function writeFileToPath(filePath: string, content: string): Promise<types.FileWriteResult> {
  return new Promise((resolve) => {
    try {
      // 解析路径，获取目录和文件名
      const pathParts = filePath.split('/');
      const filename = pathParts.pop() || '';
      const dirPath = pathParts.join('/') + '/';
      
      openFileUrl(dirPath, (dirResult: any) => {
        if (!dirResult.s) {
          resolve({ success: false, error: `无法打开目录: ${dirPath}` });
          return;
        }
        
        const dirFid = dirResult.fid;
        if (!dirFid) {
          resolve({ success: false, error: '获取目录ID失败' });
          return;
        }
        
        // 先尝试打开文件
        openChildrenFile(dirFid, filename, (fileResult: any) => {
          if (fileResult.s && fileResult.fid) {
            // 文件已存在，直接写入
            const blobContent = new Blob([content], { type: 'text/plain' });
            writeFile(fileResult.fid, blobContent, false, (writeResult: any) => {
              if (writeResult.s) {
                resolve({ success: true });
              } else {
                resolve({ success: false, error: `写入文件失败: ${JSON.stringify(writeResult.err)}` });
              }
            });
          } else {
            // 文件不存在，创建新文件
            newFile(dirFid, false, filename, (newFileResult: any) => {
              if (!newFileResult.s || !newFileResult.fid) {
                resolve({ success: false, error: `创建文件失败: ${JSON.stringify(newFileResult.err)}` });
                return;
              }
              

              const blobContent = new Blob([content], { type: 'text/plain' });
              writeFile(newFileResult.fid, blobContent, false, (writeResult: any) => {
                  if (writeResult.s) {
                      resolve({ success: true });
                  } else {
                      resolve({ success: false, error: `写入文件失败: ${JSON.stringify(writeResult.err)}` });
                  }
              });
            });
          }
        });
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      resolve({ success: false, error: errorMessage });
    }
  });
}

/**
 * 工具函数：转义正则表达式特殊字符
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 执行JavaScript代码
 */
export function executeJavaScriptCode(code: string): types.JavaScriptExecutionResult {
  if (!code || typeof code !== 'string') {
    return { success: false, error: '代码为空或不是字符串' };
  }
  
  try {
    log('开始执行JavaScript代码');
    
    // 创建安全的执行环境
    const context = {
      window: window,
      document: document,
      console: console,
      ELIXIR: (window as any).ELIXIR || {},
      // 可以添加其他需要在代码中访问的对象
    };
    
    // 使用Function构造器来执行代码，这样可以控制作用域
    const execFunction = new Function(...Object.keys(context), code);
    const result = execFunction(...Object.values(context));
    
    log('JavaScript代码执行成功');
    return { success: true, result };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    error(`执行JavaScript代码失败: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * 比较MD5并下载更新
 */
export async function checkAndDownloadUpdate(isInited: boolean): Promise<types.CheckAndDownloadResult> {
  try {
    log('开始检查更新流程');
    log(`是否首次下载资源: ${isInited ? '否' : '是'}`);
    
    // 检查网络连接
    const isOnline = await checkNetworkConnection();
    log(`网络连接状态: ${isOnline ? '在线' : '离线'}`);
    
    if (!isOnline) {
      log('没有网络连接，跳过更新检查');
      
      // 如果没有网络连接且不是首次下载（已有本地文件）
      if (isInited) {
        const localFileResult = await readLocalLatestJsAndComputeMD5();
        if (localFileResult.success && localFileResult.content) {
          log('在离线状态下成功读取本地文件');
          return { success: true, needUpdate: false, content: localFileResult.content };
        }
      }
      
      return { success: false, needUpdate: false, error: '没有网络连接且本地文件不存在或读取失败' };
    }
    
    // 如果不是首次下载（已有本地文件），读取本地文件并计算MD5
    let localMd5 = '';
    let localContent = '';
    if (isInited) {
      log('开始读取本地文件并计算MD5');
      const localFileResult = await readLocalLatestJsAndComputeMD5();
      
      if (localFileResult.success && localFileResult.md5) {
        log(`本地文件MD5: ${localFileResult.md5}`);
        localMd5 = localFileResult.md5;
        localContent = localFileResult.content || '';
      } else if (!localFileResult.success) {
        // 如果本地文件读取失败但错误不是文件不存在，返回错误
        if (localFileResult.error && !localFileResult.error.includes('文件不存在')) {
          log(`本地文件读取失败: ${localFileResult.error}`);
          return { success: false, needUpdate: false, error: localFileResult.error };
        }
        log('本地文件不存在，将需要下载');
      }
    } else {
      log('首次下载资源，无需检查本地文件');
    }
    
    // 获取远程版本信息
    log('开始获取远程版本信息');
    const remoteVersionResult = await getRemoteVersionInfo();
    
    if (!remoteVersionResult.success) {
      log(`获取远程版本信息失败: ${remoteVersionResult.error}`);
      // 如果有本地内容，返回本地内容
      if (isInited && localContent) {
        log('使用本地文件作为备选');
        return { success: true, needUpdate: false, content: localContent };
      }
      return { success: false, needUpdate: false, error: remoteVersionResult.error };
    }
    
    log(`成功获取远程版本信息，MD5: ${remoteVersionResult.md5}, URL: ${remoteVersionResult.url}, isForced: ${remoteVersionResult.isForced}`);
    
    const remoteMd5 = remoteVersionResult.md5 || '';
    
    // 逻辑判断
    if (isInited) {
      // 非首次下载（已有本地文件）
      if (remoteVersionResult.isForced) {
        // 强制更新逻辑
        log('检测到强制更新标志，将进行强制更新');
        
        if (!remoteVersionResult.url) {
          log('远程版本信息中没有提供下载URL');
          return { success: false, needUpdate: true, error: '远程版本信息中没有提供下载URL' };
        }
        
        log('开始强制更新下载');
        const downloadResult = await downloadLatestJsUpdate(remoteVersionResult.url);
        
        if (!downloadResult.success) {
          log(`强制更新下载失败: ${downloadResult.error}`);
          // 如果下载失败，但有本地内容，使用本地内容
          if (localContent) {
            log('使用本地文件作为备选');
            return { success: true, needUpdate: false, content: localContent };
          }
          return { success: false, needUpdate: true, error: downloadResult.error };
        }
        
        log('强制更新下载成功');
        return { 
          success: true, 
          needUpdate: true, 
          content: downloadResult.content 
        };
      } else {
        // 非强制更新，比较MD5
        log(`比较MD5: 本地=${localMd5}, 远程=${remoteMd5}`);
        if (localMd5 === remoteMd5 && localContent) {
          log('本地文件已是最新版本，无需更新');
          return { success: true, needUpdate: false, content: localContent };
        }
        
        // MD5不同，需要更新
        if (!remoteVersionResult.url) {
          log('远程版本信息中没有提供下载URL');
          return { success: false, needUpdate: true, error: '远程版本信息中没有提供下载URL' };
        }
        
        log('发现新版本，开始下载更新');
        const downloadResult = await downloadLatestJsUpdate(remoteVersionResult.url);
        
        if (!downloadResult.success) {
          log(`下载更新失败: ${downloadResult.error}`);
          // 如果下载失败，但有本地内容，使用本地内容
          if (localContent) {
            log('使用本地文件作为备选');
            return { success: true, needUpdate: false, content: localContent };
          }
          return { success: false, needUpdate: true, error: downloadResult.error };
        }
        
        log('更新下载成功');
        return { 
          success: true, 
          needUpdate: true, 
          content: downloadResult.content 
        };
      }
    } else {
      // 首次下载资源，直接下载最新版本
      log('首次下载资源，开始下载最新版本');
      
      if (!remoteVersionResult.url) {
        log('远程版本信息中没有提供下载URL');
        return { success: false, needUpdate: true, error: '远程版本信息中没有提供下载URL' };
      }
      
      const downloadResult = await downloadLatestJsUpdate(remoteVersionResult.url);
      
      if (!downloadResult.success) {
        log(`首次下载失败: ${downloadResult.error}`);
        return { success: false, needUpdate: true, error: downloadResult.error };
      }
      
      log('首次下载成功');
      return { 
        success: true, 
        needUpdate: true, 
        content: downloadResult.content 
      };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    error(`检查和下载更新时发生错误: ${errorMessage}`);
    return { success: false, needUpdate: false, error: `发生错误: ${errorMessage}` };
  }
}
/**
 * 直接检查并下载更新（不考虑isForced和isInited状态）
 * 直接进行远程版本判断和更新
 */
export async function directCheckAndDownloadUpdate(): Promise<types.CheckAndDownloadResult> {
  try {
    log('开始直接检查更新流程（忽略isForced和isInited状态）');
    
    // 检查网络连接
    const isOnline = await checkNetworkConnection();
    log(`网络连接状态: ${isOnline ? '在线' : '离线'}`);
    
    if (!isOnline) {
      log('没有网络连接，无法进行更新检查');
      return { success: false, needUpdate: false, error: '没有网络连接' };
    }
    
    // 获取远程版本信息
    log('开始获取远程版本信息');
    const remoteVersionResult = await getRemoteVersionInfo();
    
    if (!remoteVersionResult.success) {
      log(`获取远程版本信息失败: ${remoteVersionResult.error}`);
      return { success: false, needUpdate: false, error: remoteVersionResult.error };
    }
    
    log(`成功获取远程版本信息，MD5: ${remoteVersionResult.md5}, URL: ${remoteVersionResult.url}`);
    
    // 检查是否有下载URL
    if (!remoteVersionResult.url) {
      log('远程版本信息中没有提供下载URL');
      return { success: false, needUpdate: true, error: '远程版本信息中没有提供下载URL' };
    }
    
    // 直接下载最新版本
    log('开始下载最新版本');
    const downloadResult = await downloadLatestJsUpdate(remoteVersionResult.url);
    
    if (!downloadResult.success) {
      log(`下载失败: ${downloadResult.error}`);
      return { success: false, needUpdate: true, error: downloadResult.error };
    }
    
    log('直接更新下载成功');
    return { 
      success: true, 
      needUpdate: true, 
      content: downloadResult.content 
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    error(`直接检查和下载更新时发生错误: ${errorMessage}`);
    return { success: false, needUpdate: false, error: `发生错误: ${errorMessage}` };
  }
}

/**
 * 检查文件是否存在
 */
export async function checkFileExists(filename: string): Promise<boolean> {
  return new Promise((resolve) => {
    openFileUrl(ANDROID_FILE_PATH, (dirResult: any) => {
      if (!dirResult.s) {
        resolve(false);
        return;
      }
      
      const dirFid = dirResult.fid;
      if (!dirFid) {
        resolve(false);
        return;
      }
      
      openChildrenFile(dirFid, filename, (fileResult: any) => {
        resolve(fileResult.s && !!fileResult.fid);
      });
    });
  });
}

/**
 * 读取本地文件并计算MD5
 */
export async function readLocalFileAndComputeMD5(filename: string): Promise<types.LocalFileResult> {
  return new Promise((resolve) => {
    // 打开目录
    openFileUrl(ANDROID_FILE_PATH, (dirResult) => {
      if (!dirResult.s) {
        error(`无法打开目录: ${ANDROID_FILE_PATH}`, dirResult.err);
        resolve({ success: false, error: `无法打开目录: ${JSON.stringify(dirResult.err)}` });
        return;
      }

      const dirFid = dirResult.fid;
      if (!dirFid) {
        resolve({ success: false, error: '获取目录ID失败' });
        return;
      }

      // 打开文件
      openChildrenFile(dirFid, filename, (fileResult) => {
        if (!fileResult.s) {
          // 文件不存在，返回特定错误
          if (fileResult.err && typeof fileResult.err === 'object' && 
              ('c' in fileResult.err) && (fileResult.err.c === 1 || fileResult.err.c === 8)) {
            log(`文件 ${filename} 不存在`);
            resolve({ success: true, md5: '', content: '' });
          } else {
            error(`无法打开文件: ${filename}`, fileResult.err);
            resolve({ success: false, error: `无法打开文件: ${JSON.stringify(fileResult.err)}` });
          }
          return;
        }

        const fileFid = fileResult.fid;
        if (!fileFid) {
          resolve({ success: false, error: '获取文件ID失败' });
          return;
        }

        // 读取文件内容
        readFile(fileFid, 'Text', (readResult) => {
          if (!readResult.s) {
            error(`无法读取文件内容: ${filename}`, readResult.err);
            resolve({ success: false, error: `无法读取文件内容: ${JSON.stringify(readResult.err)}` });
            return;
          }

          const content = readResult.data as string;
          if (!content) {
            resolve({ success: false, error: '读取文件内容为空' });
            return;
          }

          // 计算MD5
          if (!wasmInitialized) {
            error('WASM模块未初始化，无法计算MD5');
            resolve({ success: false, error: 'WASM模块未初始化' });
            return;
          }

          try {
            const md5 = compute_md5(content);
            log(`成功计算 ${filename} 的MD5: ${md5}`);
            resolve({ success: true, md5, content });
          } catch (err) {
            error(`计算MD5失败: ${err}`);
            resolve({ success: false, error: `计算MD5失败: ${err}` });
          }
        });
      });
    });
  });
}

/**
 * 单纯的MD5比较检查，不进行下载或执行
 */
export async function checkUpdateNeed(): Promise<types.UpdateCheckResult> {
  try {
    log('开始单纯的MD5比较检查');
    
    // 检查网络连接
    const isOnline = await checkNetworkConnection();
    log(`网络连接状态: ${isOnline ? '在线' : '离线'}`);
    
    if (!isOnline) {
      log('没有网络连接，无法进行MD5比较');
      return { success: false, needUpdate: false, error: '没有网络连接' };
    }
    
    // 读取本地文件并计算MD5
    log('开始读取本地文件并计算MD5');
    const localFileResult = await readLocalLatestJsAndComputeMD5();
    
    let localMd5 = '';
    if (localFileResult.success && localFileResult.md5) {
      log(`本地文件MD5: ${localFileResult.md5}`);
      localMd5 = localFileResult.md5;
    } else {
      log('本地文件不存在或读取失败，需要下载');
      // 本地文件不存在，需要更新
      return { 
        success: true, 
        needUpdate: true, 
        localMd5: '',
        remoteMd5: '',
        error: localFileResult.error
      };
    }
    
    // 获取远程版本信息
    log('开始获取远程版本信息');
    const remoteVersionResult = await getRemoteVersionInfo();
    
    if (!remoteVersionResult.success) {
      log(`获取远程版本信息失败: ${remoteVersionResult.error}`);
      return { 
        success: false, 
        needUpdate: false, 
        localMd5,
        error: remoteVersionResult.error 
      };
    }
    
    const remoteMd5 = remoteVersionResult.md5 || '';
    log(`远程文件MD5: ${remoteMd5}, 强制更新: ${remoteVersionResult.isForced}`);
    
    // 检查强制更新
    if (remoteVersionResult.isForced) {
      log('检测到强制更新标志，需要更新');
      return { 
        success: true, 
        needUpdate: true, 
        localMd5,
        remoteMd5,
        isForced: true 
      };
    }
    
    // 比较MD5
    log(`比较MD5: 本地=${localMd5}, 远程=${remoteMd5}`);
    const needUpdate = localMd5 !== remoteMd5;
    
    if (needUpdate) {
      log('发现新版本，需要更新');
    } else {
      log('本地文件已是最新版本，无需更新');
    }
    
    return { 
      success: true, 
      needUpdate,
      localMd5,
      remoteMd5,
      isForced: remoteVersionResult.isForced 
    };
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    error(`MD5比较检查时发生错误: ${errorMessage}`);
    return { success: false, needUpdate: false, error: `发生错误: ${errorMessage}` };
  }
}

/**
 * 读取本地文件并计算MD5
 */
export async function readLocalLatestJsAndComputeMD5(): Promise<types.LocalFileResult> {
  return readLocalFileAndComputeMD5(LATEST_JS_FILE);
}
