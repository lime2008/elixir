import { FileSystemEntry } from './types';

// 文件ID映射表
export const fidMap: Record<string, FileSystemEntry> = {};

// 生成随机文件ID
export function rfid(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-';
  const length = 16;
  let result = '';
  for (let i = length; i > 0; --i) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// 检查文件ID是否有效
export function isValidFid(fid: string): boolean {
  return !!fidMap[fid];
}

// 清理文件ID
export function gcFid(fid: string): void {
  delete fidMap[fid];
}
