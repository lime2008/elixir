import { FileCallback, FileIdResult, DirCheckResult, ChildrenResult, FileReadResult, FileSystemEntry, FileWriter } from './types';
import { fidMap, rfid } from './utils';
import { log, error } from '../logger/consoleLogger';

// 修复全局函数调用 - 直接使用全局变量
let resolveLocalFileSystemUrlFn: Function | undefined;
try {
  // 尝试多种方式获取全局函数
  //@ts-ignore
  resolveLocalFileSystemUrlFn = (window as any).resolveLocalFileSystemURL || (globalThis as any).resolveLocalFileSystemURL || resolveLocalFileSystemURL;
} catch (e) {
  console.error('Error accessing resolveLocalFileSystemURL:', e);
}

// 打开文件URL
export function openFileUrl(furl: string, callback: FileCallback<FileIdResult>): void {
  // 参数有效性检查
  if (!furl || typeof furl !== 'string') {
    error('openFileUrl: Invalid URL parameter');
    callback({ s: false, err: { c: 'INVALID_PARAM', s: 'URL参数无效或为空' } });
    return;
  }
  
  // 函数可用性检查
  if (!resolveLocalFileSystemUrlFn || typeof resolveLocalFileSystemUrlFn !== 'function') {
    // 尝试再次获取全局函数
    try {
      //@ts-ignore
      resolveLocalFileSystemUrlFn = (window as any).resolveLocalFileSystemURL || (globalThis as any).resolveLocalFileSystemURL || resolveLocalFileSystemURL;
    } catch (e) {
      error('resolveLocalFileSystemURL not found or inaccessible');
      callback({ s: false, err: { c: 'NOT_SUPPORTED', s: '文件系统API不支持' } });
      return;
    }
    
    // 如果还是获取不到
    if (!resolveLocalFileSystemUrlFn || typeof resolveLocalFileSystemUrlFn !== 'function') {
      error('resolveLocalFileSystemURL is not a function');
      callback({ s: false, err: { c: 'NOT_SUPPORTED', s: '文件系统API不支持' } });
      return;
    }
  }
  
  try {
    resolveLocalFileSystemUrlFn(
      furl,
      // 成功回调
      (fe: FileSystemEntry) => {
        const fid = rfid();
        fidMap[fid] = fe;
        log('openFileUrl', true, fid, fe);
        callback({ s: true, fid: fid });
      },
      // 失败回调
      (err: any) => {
        error('openFileUrl', err);
        callback({ s: false, err: { c: err.code || 'UNKNOWN_ERROR', s: err.toString() } });
      }
    );
  } catch (e) {
    // 捕获执行过程中的任何异常
    error('Error executing resolveLocalFileSystemURL:', e);
    callback({ s: false, err: { c: 'EXECUTION_ERROR', s: '执行文件系统操作时出错' } });
  }
}

// 检查是否为目录
export function checkIsDir(fid: string, callback: FileCallback<DirCheckResult>): void {
  if (!fidMap[fid]) {
    callback({ s: false, err: 'INVALID_FID' });
    return;
  }
  callback({ s: true, isDir: fidMap[fid].isDirectory });
}

// 检查是否为文件
export function checkIsFile(fid: string, callback: FileCallback<DirCheckResult>): void {
  if (!fidMap[fid]) {
    callback({ s: false, err: 'INVALID_FID' });
    return;
  }
  callback({ s: true, isDir: fidMap[fid].isFile });
}

// 创建新文件
export function newFile(fid: string, exclusive: boolean, fileName: string, callback: FileCallback<FileIdResult>): void {
  if (!fidMap[fid]) {
    callback({ s: false, err: 'INVALID_FID' });
    return;
  }
  if (!fidMap[fid].isDirectory) {
    callback({ s: false, err: 'NOT_DIR' });
    return;
  }
  fidMap[fid].getFile?.(fileName, { create: true, exclusive: exclusive },
    (fe: FileSystemEntry) => {
      const newFid = rfid();
      fidMap[newFid] = fe;
      log('newFile', true, newFid, fe);
      callback({ s: true, fid: newFid });
    },
    (err: any) => {
      error('newFile', err);
      // FileError.PATH_EXISTS_ERR
      if (err.code === 12) {
        callback({ s: false, err: 'PATH_EXISTS' });
        return;
      }
      callback({ s: false, err: { c: err.code, s: err.toString() } });
    }
  );
}

// 创建新目录
export function newDir(fid: string, exclusive: boolean, fileName: string, callback: FileCallback<FileIdResult>): void {
  if (!fidMap[fid]) {
    callback({ s: false, err: 'INVALID_FID' });
    return;
  }
  if (!fidMap[fid].isDirectory) {
    callback({ s: false, err: 'NOT_DIR' });
    return;
  }
  fidMap[fid].getDirectory?.(fileName, { create: true, exclusive: exclusive },
    (fe: FileSystemEntry) => {
      const newFid = rfid();
      fidMap[newFid] = fe;
      log('newDir', true, newFid, fe);
      callback({ s: true, fid: newFid });
    },
    (err: any) => {
      error('newDir', err);
      // FileError.PATH_EXISTS_ERR
      if (err.code === 12) {
        callback({ s: false, err: 'PATH_EXISTS' });
        return;
      }
      callback({ s: false, err: { c: err.code, s: err.toString() } });
    }
  );
}

// 打开子文件
export function openChildrenFile(fid: string, fileName: string, callback: FileCallback<FileIdResult>): void {
  if (!fidMap[fid]) {
    callback({ s: false, err: 'INVALID_FID' });
    return;
  }
  if (!fidMap[fid].isDirectory) {
    callback({ s: false, err: 'NOT_DIR' });
    return;
  }
  fidMap[fid].getFile?.(fileName, { create: false },
    (fe: FileSystemEntry) => {
      const newFid = rfid();
      fidMap[newFid] = fe;
      log('getChildrenFile', true, newFid, fe);
      callback({ s: true, fid: newFid });
    },
    (err: any) => {
      error('getChildrenFile', err);
      callback({ s: false, err: { c: err.code, s: err.toString() } });
    }
  );
}

// 打开子目录 - 注意：修复了原代码中的exclusive未定义问题
export function openChildrenDir(fid: string, fileName: string, callback: FileCallback<FileIdResult>): void {
  if (!fidMap[fid]) {
    callback({ s: false, err: 'INVALID_FID' });
    return;
  }
  fidMap[fid].getDirectory?.(fileName, { create: true, exclusive: false },
    (fe: FileSystemEntry) => {
      const newFid = rfid();
      fidMap[newFid] = fe;
      log('getChildrenDir', true, newFid, fe);
      callback({ s: true, fid: newFid });
    },
    (err: any) => {
      error('getChildrenDir', err);
      callback({ s: false, err: { c: err.code, s: err.toString() } });
    }
  );
}

// 获取子文件和目录列表
export function getChildrens(fid: string, includeFile: boolean, includeDir: boolean, callback: FileCallback<ChildrenResult>): void {
  if (!fidMap[fid]) {
    callback({ s: false, err: 'INVALID_FID' });
    return;
  }
  if (!fidMap[fid].isDirectory) {
    callback({ s: false, err: 'NOT_DIR' });
    return;
  }
  const reader = fidMap[fid].createReader?.();
  if (!reader) {
    callback({ s: false, err: 'CREATE_READER_FAILED' });
    return;
  }
  reader.readEntries(
    (entries: FileSystemEntry[]) => {
      log('getChildrenDir', true, fid, entries);
      const fileNameList: string[] = [];
      entries.forEach((f) => {
        if (includeFile && f.isFile) fileNameList.push(f.name);
        else if (includeDir && f.isDirectory) fileNameList.push(f.name);
      });
      callback({ s: true, fileNameList: fileNameList });
    },
    (err: any) => {
      error('getChildrens', err);
      callback({ s: false, err: { c: err.code, s: err.toString() } });
    }
  );
}

// 删除文件或目录
export function removeFile(fid: string, callback: FileCallback<{}>): void {
  if (!fidMap[fid]) {
    callback({ s: false, err: 'INVALID_FID' });
    return;
  }
  if (fidMap[fid].isDirectory) {
    // 注意！很危险！会删除所有文件！！！！！！！！！！！
    fidMap[fid].removeRecursively?.(() => {
      callback({ s: true });
    },
    (err: any) => {
      callback({ s: false, err: { c: err.code, s: err.toString() } });
    });
  } else {
    fidMap[fid].remove?.(() => {
      callback({ s: true });
    },
    (err: any) => {
      callback({ s: false, err: { c: err.code, s: err.toString() } });
    });
  }
}

// 读取文件内容
export function readFile(fid: string, type: string, callback: FileCallback<FileReadResult>): void {
  if (!fidMap[fid]) {
    callback({ s: false, err: 'INVALID_FID' });
    return;
  }
  if (!fidMap[fid].isFile) {
    callback({ s: false, err: 'NOT_FILE' });
    return;
  }
  fidMap[fid].file?.((file: File) => {
    const reader = new FileReader();
    reader.onloadend = function() {
      callback({ s: true, data: this.result });
    };
    // 动态调用对应的读取方法
    const readMethod = `readAs${type}` as keyof FileReader;
    if (typeof reader[readMethod] === 'function') {
      (reader[readMethod] as Function)(file);
    } else {
      callback({ s: false, err: `INVALID_READ_TYPE: ${type}` });
    }
    reader.onerror = function(err) {
      callback({ s: false, err: { c: 'FILE_READ_ERROR', s: err.toString() } });
    };
  },
  (err: any) => {
    callback({ s: false, err: { c: err.code || 'UNKNOWN_ERROR', s: err.toString() } });
  });
}

// 写入文件内容
export function writeFile(fid: string, data: Blob, isAppend: boolean, callback: FileCallback<{}>): void {
  if (!fidMap[fid]) {
    callback({ s: false, err: 'INVALID_FID' });
    return;
  }
  if (!fidMap[fid].isFile) {
    callback({ s: false, err: 'NOT_FILE' });
    return;
  }
  fidMap[fid].createWriter?.((fileWriter: FileWriter) => {
    log('create writer', fileWriter);
    // 文件写入成功
    fileWriter.onwriteend = function() {
      log('written');
      callback({ s: true });
    };
    // 为了调试方便，保存到window对象
    (window as any).fw = fileWriter;
    // 文件写入失败
    fileWriter.onerror = function(e: Event) {
      error('fileWriter Error', e);
      callback({ s: false, err: { c: 'ON_FILE_WRITER', s: e.toString() } });
    };
    fileWriter.onprogress = function(e: Event) {
      log('fileWriter onprogress', e);
    };
    // 如果是追加内容，则定位到文件尾部
    if (isAppend) {
      try {
        fileWriter.seek(fileWriter.length);
      } catch (e) {
        callback({ s: false, err: 'FILE_NOT_EXIST' });
        return;
      }
    }
    fileWriter.write(data);
  },
  (err: any) => {
    callback({ s: false, err: { c: err.code, s: err.toString() } });
  });
}
