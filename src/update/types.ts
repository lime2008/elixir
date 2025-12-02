// 更新相关的类型定义

// 下载更新文件结果
export interface DownloadResult {
  success: boolean;
  content?: string;
  error?: string;
}

// 远程版本信息结果
export interface RemoteVersionInfo {
  success: boolean;
  md5?: string;
  url?: string;
  error?: string;
}

// 更新和执行结果
export interface UpdateAndExecuteResult {
  success: boolean;
  updated: boolean;
  executed: boolean;
  error?: string;
}

// JavaScript代码执行结果
export interface JavaScriptExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
}

// 处理资源文件结果
export interface ResourceProcessResult {
  success: boolean;
  processedContent?: string;
  error?: string;
}

// 本地文件读取和MD5计算结果
export interface LocalFileResult {
  success: boolean;
  md5?: string;
  content?: string;
  error?: string;
}

// 检查和下载更新结果
export interface CheckAndDownloadResult {
  success: boolean;
  needUpdate: boolean;
  content?: string;
  error?: string;
}

// 资源下载到本地结果
export interface ResourceDownloadResult {
  success: boolean;
  localPath?: string;
  error?: string;
}

// 文件写入结果
export interface FileWriteResult {
  success: boolean;
  error?: string;
}

// 更新模块接口
export interface UpdateModule {
  // 主更新触发函数
  checkAndExecuteLatestJs: () => Promise<UpdateAndExecuteResult>;
  // 检查更新但不执行
  checkForUpdates: () => Promise<CheckAndDownloadResult>;
  // 执行已下载的代码
  executeLatestJs: () => Promise<JavaScriptExecutionResult>;
  getRemoteVersionInfo: () => Promise<RemoteVersionInfo>;
  downloadLatestJsUpdate: (url: string) => Promise<DownloadResult>;
}
