// 导出所有文件操作相关的功能
import * as types from './types';
import { rfid, gcFid, fidMap, isValidFid } from './utils';
import * as fileOperations from './fileOperations';
import * as downloadFunctions from './download';

// 导出工具函数
export { rfid, gcFid, fidMap, isValidFid };

// 导出文件操作函数
export const { 
  openFileUrl,
  checkIsDir,
  checkIsFile,
  newFile,
  newDir,
  openChildrenFile,
  openChildrenDir,
  getChildrens,
  removeFile,
  readFile,
  writeFile
} = fileOperations;

// 导出下载相关函数
export const { 
  downloadJsCode,
  downloadJsCodeToFile,
  executeJsCode,
  downloadAndExecuteJsCode,
  downloadResource,
  downloadResourceToDirectory
} = downloadFunctions;

// 导出类型
export type { 
  FileCallback,
  FileResult,
  FileIdResult,
  DirCheckResult,
  ChildrenResult,
  FileReadResult,
  FileSystemEntry,
  FileSystemReader,
  FileWriter
} from './types';
