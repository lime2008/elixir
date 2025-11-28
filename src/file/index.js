// 从TypeScript模块导入所有文件操作功能
const fileModule = require('./index');

// 导出所有函数和变量，保持向后兼容性
module.exports = {
  // 工具函数
  rfid: fileModule.rfid,
  gcFid: fileModule.gcFid,
  fidMap: fileModule.fidMap,
  isValidFid: fileModule.isValidFid,
  
  // 文件操作函数
  openFileUrl: fileModule.openFileUrl,
  checkIsDir: fileModule.checkIsDir,
  checkIsFile: fileModule.checkIsFile, // 修复了原代码中的函数名重复问题
  newFile: fileModule.newFile,
  newDir: fileModule.newDir,
  openChildrenFile: fileModule.openChildrenFile,
  openChildrenDir: fileModule.openChildrenDir,
  getChildrens: fileModule.getChildrens,
  removeFile: fileModule.removeFile,
  readFile: fileModule.readFile,
  writeFile: fileModule.writeFile,
  
  // 下载相关函数
  downloadJsCode: fileModule.downloadJsCode,
  downloadJsCodeToFile: fileModule.downloadJsCodeToFile,
  executeJsCode: fileModule.executeJsCode,
  downloadAndExecuteJsCode: fileModule.downloadAndExecuteJsCode,
  downloadResource: fileModule.downloadResource,
  downloadResourceToDirectory: fileModule.downloadResourceToDirectory
};

// 为了兼容性，也将函数挂载到全局作用域
Object.assign(globalThis, module.exports);
