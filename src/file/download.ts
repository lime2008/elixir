import { FileCallback, FileIdResult } from './types';
import { newFile, writeFile, openFileUrl } from './fileOperations';
import { log, error } from '../logger/consoleLogger';

/**
 * 下载JavaScript代码并返回内容
 * @param url 要下载的JavaScript文件URL
 * @param callback 回调函数，返回下载结果
 */
export function downloadJsCode(url: string, callback: FileCallback<{ code?: string }>): void {
  const xhr = new XMLHttpRequest();
  
  xhr.open('GET', url, true);
  xhr.responseType = 'text';
  
  xhr.onload = function() {
    if (xhr.status === 200) {
      log(`成功下载JS代码: ${url}`);
      callback({ s: true, code: xhr.responseText });
    } else {
      error(`下载JS代码失败，状态码: ${xhr.status}`);
      callback({ s: false, err: { c: xhr.status, s: `下载失败，状态码: ${xhr.status}` } });
    }
  };
  
  xhr.onerror = function() {
    error(`下载JS代码网络错误: ${url}`);
    callback({ s: false, err: { c: 'NETWORK_ERROR', s: '网络连接错误' } });
  };
  
  xhr.timeout = 30000; // 30秒超时
  xhr.ontimeout = function() {
    error(`下载JS代码超时: ${url}`);
    callback({ s: false, err: { c: 'TIMEOUT', s: '下载超时' } });
  };
  
  xhr.send();
}

/**
 * 下载JavaScript代码并保存到文件
 * @param url 要下载的JavaScript文件URL
 * @param parentFid 父文件夹ID
 * @param fileName 保存的文件名
 * @param callback 回调函数，返回操作结果
 */
export function downloadJsCodeToFile(
  url: string, 
  parentFid: string, 
  fileName: string, 
  callback: FileCallback<FileIdResult>
): void {
  // 先下载代码
  downloadJsCode(url, (downloadResult) => {
    if (!downloadResult.s) {
      callback({ s: false, err: downloadResult.err });
      return;
    }
    
    const code = downloadResult.code || '';
    
    // 创建新文件
    newFile(parentFid, false, fileName, (fileResult) => {
      if (!fileResult.s) {
        callback({ s: false, err: fileResult.err });
        return;
      }
      
      const fileFid = fileResult.fid;
      if (!fileFid) {
        callback({ s: false, err: 'FILE_CREATION_FAILED' });
        return;
      }
      
      // 将代码写入文件
      const blob = new Blob([code], { type: 'application/javascript' });
      writeFile(fileFid, blob, false, (writeResult) => {
        if (writeResult.s) {
          log(`JS代码已保存到文件: ${fileName}`);
          callback({ s: true, fid: fileFid });
        } else {
          error(`保存JS代码到文件失败: ${fileName}`);
          callback({ s: false, err: writeResult.err });
        }
      });
    });
  });
}

/**
 * 执行下载的JavaScript代码
 * @param code 要执行的JavaScript代码字符串
 * @param context 执行上下文对象
 * @param callback 回调函数，返回执行结果
 */
export function executeJsCode(
  code: string, 
  context: Record<string, any> = {}, 
  callback: FileCallback<{ result?: any }>
): void {
  try {
      // 创建一个安全的执行环境
      const sandbox = {
        console,
        window: { ...window },
        document: { ...document },
        ...context
      };
      
      // 使用Function构造器来执行代码，这样可以控制作用域
      const execFunction = new Function(...Object.keys(sandbox), code);
      const result = execFunction(...Object.values(sandbox));
      
      log('JS代码执行成功');
      callback({ s: true, result: result });
    } catch (err) {
      error('JS代码执行失败:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      callback({ s: false, err: { c: 'EXECUTION_ERROR', s: errorMessage } });
    }
}

/**
 * 下载并执行JavaScript代码
 * @param url 要下载的JavaScript文件URL
 * @param context 执行上下文对象
 * @param callback 回调函数，返回执行结果
 */
export function downloadAndExecuteJsCode(
  url: string, 
  context: Record<string, any> = {}, 
  callback: FileCallback<{ result?: any }>
): void {
  downloadJsCode(url, (downloadResult) => {
    if (!downloadResult.s) {
      callback({ s: false, err: downloadResult.err });
      return;
    }
    
    const code = downloadResult.code || '';
    executeJsCode(code, context, callback);
  });
}

/**
 * 通用网络资源下载函数
 * @param url 要下载的资源URL
 * @param responseType 响应类型：'text' | 'blob' | 'arraybuffer' | 'document' | 'json'
 * @param callback 回调函数，返回下载结果
 */
export function downloadResource(
  url: string, 
  responseType: XMLHttpRequestResponseType = 'blob',
  callback: FileCallback<{ data?: any; headers?: Record<string, string> }>
): void {
  const xhr = new XMLHttpRequest();
  
  xhr.open('GET', url, true);
  xhr.responseType = responseType;
  
  xhr.onload = function() {
    if (xhr.status === 200) {
      log(`成功下载资源: ${url}`);
      
      // 提取响应头
      const headers: Record<string, string> = {};
      const headerString = xhr.getAllResponseHeaders();
      const headerPairs = headerString.split('\r\n');
      for (const pair of headerPairs) {
        const [key, value] = pair.split(': ');
        if (key && value) {
          headers[key] = value;
        }
      }
      
      callback({ s: true, data: xhr.response, headers });
    } else {
      error(`下载资源失败，状态码: ${xhr.status}`);
      callback({ s: false, err: { c: xhr.status, s: `下载失败，状态码: ${xhr.status}` } });
    }
  };
  
  xhr.onerror = function() {
    error(`下载资源网络错误: ${url}`);
    callback({ s: false, err: { c: 'NETWORK_ERROR', s: '网络连接错误' } });
  };
  
  xhr.timeout = 60000; // 60秒超时
  xhr.ontimeout = function() {
    error(`下载资源超时: ${url}`);
    callback({ s: false, err: { c: 'TIMEOUT', s: '下载超时' } });
  };
  
  xhr.send();
}

/**
 * 下载网络资源并保存到指定目录
 * @param url 要下载的资源URL
 * @param directoryPath 保存目录路径
 * @param fileName 保存的文件名，如果不提供则从URL推断
 * @param callback 回调函数，返回操作结果
 */
export function downloadResourceToDirectory(
  url: string,
  directoryPath: string,
  callback: FileCallback<FileIdResult>,
  fileName?: string,
): void {
  // 如果未提供文件名，从URL推断
  const targetFileName = fileName || url.split('/').pop() || `download_${Date.now()}`;
  
  // 打开目标目录
  openFileUrl(directoryPath, (dirResult) => {
    if (!dirResult.s) {
      error(`无法打开目录: ${directoryPath}`, dirResult.err);
      callback({ s: false, err: dirResult.err });
      return;
    }
    
    const dirFid = dirResult.fid;
    if (!dirFid) {
      callback({ s: false, err: 'DIRECTORY_OPEN_FAILED' });
      return;
    }
    
    // 下载资源
    downloadResource(url, 'blob', (downloadResult) => {
      if (!downloadResult.s) {
        callback({ s: false, err: downloadResult.err });
        return;
      }
      
      const blob = downloadResult.data as Blob;
      if (!blob) {
        callback({ s: false, err: 'INVALID_DOWNLOAD_DATA' });
        return;
      }
      
      // 创建新文件
      newFile(dirFid, false, targetFileName, (fileResult) => {
        if (!fileResult.s) {
          callback({ s: false, err: fileResult.err });
          return;
        }
        
        const fileFid = fileResult.fid;
        if (!fileFid) {
          callback({ s: false, err: 'FILE_CREATION_FAILED' });
          return;
        }
        
        // 将资源写入文件
        writeFile(fileFid, blob, false, (writeResult) => {
          if (writeResult.s) {
            log(`资源已保存到文件: ${targetFileName}，目录: ${directoryPath}`);
            callback({ s: true, fid: fileFid });
          } else {
            error(`保存资源到文件失败: ${targetFileName}`);
            callback({ s: false, err: writeResult.err });
          }
        });
      });
    });
  });
}
