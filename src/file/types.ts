// 定义文件操作的通用回调接口
export interface FileCallback<T> {
  (result: {
    s: boolean;
    err?: string | { c: any; s: string };
    [key: string]: any;
  } & T): void;
}

// 文件操作结果接口
export interface FileResult {
  s: boolean;
  err?: string | { c: any; s: string };
}

// 文件ID结果接口
export interface FileIdResult extends FileResult {
  fid?: string;
}

// 目录检查结果接口
export interface DirCheckResult extends FileResult {
  isDir?: boolean;
}

// 子文件列表结果接口
export interface ChildrenResult extends FileResult {
  fileNameList?: string[];
}

// 文件读取结果接口
export interface FileReadResult extends FileResult {
  data?: any;
}

// 文件系统条目接口
export interface FileSystemEntry {
  isDirectory: boolean;
  isFile: boolean;
  name: string;
  file?: (successCallback: Function, errorCallback?: Function) => void;
  createWriter?: (successCallback: Function, errorCallback?: Function) => void;
  getFile?: (path: string, options: any, successCallback: Function, errorCallback?: Function) => void;
  getDirectory?: (path: string, options: any, successCallback: Function, errorCallback?: Function) => void;
  createReader?: () => FileSystemReader;
  remove?: (successCallback: Function, errorCallback?: Function) => void;
  removeRecursively?: (successCallback: Function, errorCallback?: Function) => void;
}

// 文件系统读取器接口
export interface FileSystemReader {
  readEntries: (successCallback: Function, errorCallback?: Function) => void;
}

// 文件写入器接口
export interface FileWriter {
  length: number;
  seek: (offset: number) => void;
  write: (blob: Blob) => void;
  onwriteend: Function;
  onerror: Function;
  onprogress: Function;
}

// 全局变量声明
declare var resolveLocalFileSystemURL: (url: string, successCallback: Function, errorCallback?: Function) => void;
