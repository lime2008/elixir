// Cordova应用入口文件
// 立即执行的TypeScript代码
import { compute_md5, initSync } from './wasm/elixir';
import elixirInit from './wasm/elixir';
// 导入文件操作模块
import * as fileModule from './file';
import { openFileUrl, readFile, openChildrenFile, newFile, writeFile } from './file/fileOperations';
import { downloadResourceToDirectory } from './file/download';
// 导入日志模块
import { log, error, info, warn, debug, getLogs, getLatestLogs, getLogsByTimeRange, clearLogs, setMaxLogs, exportLogsAsJSON, searchLogs, LogLevel } from './logger/consoleLogger';
// 导入网络模块
import * as networkModule from './network';
import { checkNetworkConnection } from './network';

// 导入更新模块
import updateModule from './update';

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
// 更新逻辑已移至update模块

// getRemoteVersionInfo函数已移至update模块

// updateAndExecuteLatestJs函数已移至update模块

// 优先执行处理过的JS文件，如果不存在则执行原始文件
async function executeProcessedOrLatestJs(): Promise<{ success: boolean; result?: any; error?: string }> {
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



// 处理资源文件，下载并转换URL
async function processLatestJsWithResources(content: string): Promise<{ success: boolean; processedContent?: string; error?: string }> {
  return new Promise(async (resolve) => {
    try {
      log('开始处理latest.js中的资源文件');
      
      // 1. 删除旧的processed文件和lock文件
      await deleteFileIfExists(LATEST_PROCESSED_FILE);
      await deleteFileIfExists(LOCK_FILE);
      
      // 2. 提取所有匹配的资源URL
      const resourceUrls = Array.from(content.matchAll(RESOURCE_URL_REGEX), match => match[0]);
      log(`发现 ${resourceUrls.length} 个需要处理的资源URL`);
      
      if (resourceUrls.length === 0) {
          // 没有资源需要处理，直接创建processed文件
          const writeResult = await writeFileToPath(`${ANDROID_FILE_PATH}${LATEST_PROCESSED_FILE}`, content);
          if (!writeResult.success) {
            return resolve({ success: false, error: `写入processed文件失败: ${writeResult.error}` });
          }
          
          // 创建lock文件
          const lockResult = await writeFileToPath(`${ANDROID_FILE_PATH}${LOCK_FILE}`, '');
          if (!lockResult.success) {
            // 如果lock文件创建失败，删除已创建的processed文件
            await deleteFileIfExists(LATEST_PROCESSED_FILE);
            return resolve({ success: false, error: `创建lock文件失败: ${lockResult.error}` });
          }
        
        return resolve({ success: true, processedContent: content });
      }
      
      // 3. 创建资源目录
      await createResourceDirectories();
      
      // 4. 下载资源并构建URL映射
      const urlMappings: { [key: string]: string } = {};
      let allDownloaded = true;
      
      // 并行下载所有资源，提高效率
      const downloadPromises = resourceUrls.map(async (resourceUrl) => {
        const downloadResult = await downloadResourceToLocal(resourceUrl);
        if (downloadResult.success && downloadResult.localPath) {
          urlMappings[resourceUrl] = downloadResult.localPath;
          log(`成功下载并映射资源: ${resourceUrl} -> ${downloadResult.localPath}`);
          return true;
        } else {
          log(`资源下载失败: ${resourceUrl}, 错误: ${downloadResult.error}`);
          return false;
        }
      });
      
      // 等待所有下载完成
      const downloadResults = await Promise.all(downloadPromises);
      // 检查是否所有资源都下载成功
      allDownloaded = downloadResults.every(result => result);
      
      // 5. 替换内容中的URL
      let processedContent = content;
      for (const [originalUrl, localPath] of Object.entries(urlMappings)) {
        processedContent = processedContent.replace(new RegExp(escapeRegExp(originalUrl), 'g'), localPath);
      }
      
      // 6. 写入processed文件
      const writeResult = await writeFileToPath(`${ANDROID_FILE_PATH}${LATEST_PROCESSED_FILE}`, processedContent);
      if (!writeResult.success) {
        return resolve({ success: false, error: `写入processed文件失败: ${writeResult.error}` });
      }
      
      // 7. 创建lock文件
      const lockResult = await writeFileToPath(`${ANDROID_FILE_PATH}${LOCK_FILE}`, '');
      if (!lockResult.success) {
        // 如果lock文件创建失败，删除已创建的processed文件
        await deleteFileIfExists(LATEST_PROCESSED_FILE);
        return resolve({ success: false, error: `创建lock文件失败: ${lockResult.error}` });
      }
      
      log(`资源处理完成，${allDownloaded ? '所有' : '部分'}资源下载成功`);
      return resolve({ success: true, processedContent });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error(`处理资源时发生错误: ${errorMessage}`);
      // 清理可能创建的文件
      await deleteFileIfExists(LATEST_PROCESSED_FILE);
      await deleteFileIfExists(LOCK_FILE);
      return resolve({ success: false, error: errorMessage });
    }
  });
}

// 工具函数：创建资源目录
async function createResourceDirectories(): Promise<void> {
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

// 工具函数：删除文件（如果存在）
async function deleteFileIfExists(filename: string): Promise<void> {
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

// 工具函数：下载资源到本地
async function downloadResourceToLocal(resourceUrl: string): Promise<{ success: boolean; localPath?: string; error?: string }> {
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

// 工具函数：写入文件到指定路径
async function writeFileToPath(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
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

// 工具函数：转义正则表达式特殊字符
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 执行JavaScript代码
function executeJavaScriptCode(code: string): { success: boolean; result?: any; error?: string } {
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

// 比较MD5并下载更新
async function checkAndDownloadUpdate(): Promise<{ success: boolean; needUpdate: boolean; content?: string; error?: string }> {
  try {
    log('开始检查更新流程');
    // 检查网络连接
    const isOnline = await checkNetworkConnection();
    log(`网络连接状态: ${isOnline ? '在线' : '离线'}`);
    
    if (!isOnline) {
      log('没有网络连接，跳过更新检查');
      
      // 虽然没有网络，但仍然尝试读取本地文件
      const localFileResult = await readLocalLatestJsAndComputeMD5();
      if (localFileResult.success && localFileResult.content) {
        log('在离线状态下成功读取本地文件');
        return { success: true, needUpdate: false, content: localFileResult.content };
      }
      
      return { success: false, needUpdate: false, error: '没有网络连接且本地文件不存在或读取失败' };
    }
    
    // 读取本地文件并计算MD5
    log('开始读取本地文件并计算MD5');
    const localFileResult = await readLocalLatestJsAndComputeMD5();
    
    if (localFileResult.success && localFileResult.md5) {
      log(`本地文件MD5: ${localFileResult.md5}`);
    } else if (!localFileResult.success) {
      // 如果本地文件读取失败但错误不是文件不存在，返回错误
      if (localFileResult.error && !localFileResult.error.includes('文件不存在')) {
        log(`本地文件读取失败: ${localFileResult.error}`);
        return { success: false, needUpdate: false, error: localFileResult.error };
      }
      log('本地文件不存在，将需要下载');
    }
    
    // 获取远程版本信息
    log('开始获取远程版本信息');
    const remoteVersionResult = await updateModule.getRemoteVersionInfo();
    
    if (!remoteVersionResult.success) {
      log(`获取远程版本信息失败: ${remoteVersionResult.error}`);
      // 如果有本地内容，返回本地内容
      if (localFileResult.success && localFileResult.content) {
        log('使用本地文件作为备选');
        return { success: true, needUpdate: false, content: localFileResult.content };
      }
      return { success: false, needUpdate: false, error: remoteVersionResult.error };
    }
    
    log(`成功获取远程版本信息，MD5: ${remoteVersionResult.md5}, URL: ${remoteVersionResult.url}`);
    
    const localMd5 = localFileResult.md5 || '';
    const remoteMd5 = remoteVersionResult.md5 || '';
    
    // 比较MD5
    log(`比较MD5: 本地=${localMd5}, 远程=${remoteMd5}`);
    if (localMd5 === remoteMd5 && localFileResult.content) {
      log('本地文件已是最新版本，无需更新');
      return { success: true, needUpdate: false, content: localFileResult.content };
    }
    
    // 需要更新
    if (!remoteVersionResult.url) {
      log('远程版本信息中没有提供下载URL');
      return { success: false, needUpdate: true, error: '远程版本信息中没有提供下载URL' };
    }
    
    log('发现新版本，开始下载更新');
    const downloadResult = await updateModule.downloadLatestJsUpdate(remoteVersionResult.url);
    
    if (!downloadResult.success) {
      log(`下载更新失败: ${downloadResult.error}`);
      // 如果下载失败，但有本地内容，使用本地内容
      if (localFileResult.success && localFileResult.content) {
        log('使用本地文件作为备选');
        return { success: true, needUpdate: false, content: localFileResult.content };
      }
      return { success: false, needUpdate: true, error: downloadResult.error };
    }
    
    log('更新下载成功');
    return { 
      success: true, 
      needUpdate: true, 
      content: downloadResult.content 
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    error(`检查和下载更新时发生错误: ${errorMessage}`);
    return { success: false, needUpdate: false, error: `发生错误: ${errorMessage}` };
  }
}

// 检查文件是否存在
async function checkFileExists(filename: string): Promise<boolean> {
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

// 读取本地文件并计算MD5
async function readLocalFileAndComputeMD5(filename: string): Promise<{ success: boolean; md5?: string; content?: string; error?: string }> {
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

// 读取本地latest.js文件并计算MD5
async function readLocalLatestJsAndComputeMD5(): Promise<{ success: boolean; md5?: string; content?: string; error?: string }> {
  return readLocalFileAndComputeMD5(LATEST_JS_FILE);
}

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






// 应用初始化函数
async function initApp() {
  log('初始化Cordova应用');
  await checkWasm();
  
  // 首先检查网络连接状态
  const isOnline = await checkNetworkConnection();
  log(`网络连接状态: ${isOnline ? '在线' : '离线'}`);
  
  if (!isOnline) {
    // 无网络时，优先尝试执行处理过的文件，如果不存在则执行原始文件
    log('无网络连接，优先尝试执行处理过的文件');
    const executeResult = await executeProcessedOrLatestJs();
    if (executeResult.success) {
      log('成功执行本地JS文件');
    } else {
      log(`执行本地JS文件失败: ${executeResult.error || '未知错误'}`);
      // 如果执行失败，可以尝试直接读取latest.js作为备选
      const localFileResult = await readLocalLatestJsAndComputeMD5();
      if (localFileResult.success && localFileResult.content) {
        log('尝试直接执行latest.js作为备选');
        const directExecuteResult = executeJavaScriptCode(localFileResult.content);
        if (directExecuteResult.success) {
          log('备选执行成功');
        } else {
          log(`备选执行失败: ${directExecuteResult.error}`);
        }
      }
    }
  } else {
    // 有网络时，执行完整的检查和更新流程
    log('有网络连接，执行完整的检查和更新流程');
    document.addEventListener('deviceready', updateModule.checkAndExecuteLatestJs, false);

  }
  (window as any).ELIXIR = {
    // 通知功能
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