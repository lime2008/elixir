// 网络状态获取模块

import { IpType, InfoType } from './types';
import { error, log } from '../logger/consoleLogger';

/**
 * 检查设备是否有网络连接
 * @returns Promise<boolean> 是否有网络连接
 */
export const checkNetworkConnection = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    // 检查navigator.onLine
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      const isOnline = navigator.onLine;
      log(`网络连接状态(navigator.onLine): ${isOnline}`);
      resolve(isOnline);
      return;
    }
    
    // 如果navigator.onLine不可用，尝试通过获取网络信息来判断
    // 这里通过尝试获取WiFi或移动网络的IP地址来判断
    getWiFiIPAddress().then(wifiIp => {
      if (wifiIp && wifiIp !== '') {
        log('网络连接状态: 已连接(通过WiFi IP判断)');
        resolve(true);
      } else {
        getCarrierIPAddress().then(carrierIp => {
          if (carrierIp && carrierIp !== '') {
            log('网络连接状态: 已连接(通过移动网络IP判断)');
            resolve(true);
          } else {
            log('网络连接状态: 未连接');
            resolve(false);
          }
        }).catch(() => {
          log('网络连接状态: 未连接(获取移动网络IP失败)');
          resolve(false);
        });
      }
    }).catch(() => {
      log('网络连接状态: 未连接(获取WiFi IP失败)');
      resolve(false);
    });
  });
};


/**
 * 获取网络信息的基础函数
 * @param ipType IP类型（WiFi或Carrier）
 * @param infoType 信息类型（ip、subnet、gateway、mac）
 * @returns Promise<string> 网络信息值
 */
export const getNetworkInfo = (ipType: IpType, infoType: InfoType): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 检查window.networkinterface是否存在
    if (!window.networkinterface) {
      error('网络接口模块不可用');
      resolve('');
      return;
    }

    try {
      // 调用对应的Cordova网络接口方法
      const methodName = `get${ipType}IPAddress`;
      const method = window.networkinterface[methodName as keyof typeof window.networkinterface];
      
      if (typeof method !== 'function') {
        error(`方法 ${methodName} 不存在`);
        resolve('');
        return;
      }
      
      method(
        (result: any) => {
          resolve(result[infoType] || '');
        },
        (err: any) => {
          error(`获取网络信息失败: ${err}`);
          resolve('');
        }
      );
    } catch (err) {
      error(`获取网络信息时发生错误: ${err}`);
      resolve('');
    }
  });
};

/**
 * 获取WiFi IP地址
 * @returns Promise<string> WiFi IP地址
 */
export const getWiFiIPAddress = async (): Promise<string> => {
  return getNetworkInfo(IpType.WiFi, InfoType.Ip);
};

/**
 * 获取WiFi子网掩码
 * @returns Promise<string> WiFi子网掩码
 */
export const getWiFiSubnet = async (): Promise<string> => {
  return getNetworkInfo(IpType.WiFi, InfoType.Subnet);
};

/**
 * 获取WiFi网关地址
 * @returns Promise<string> WiFi网关地址
 */
export const getWiFiGateway = async (): Promise<string> => {
  return getNetworkInfo(IpType.WiFi, InfoType.Gateway);
};

/**
 * 获取WiFi MAC地址
 * @returns Promise<string> WiFi MAC地址
 */
export const getWiFiMac = async (): Promise<string> => {
  return getNetworkInfo(IpType.WiFi, InfoType.Mac);
};

/**
 * 获取移动网络IP地址
 * @returns Promise<string> 移动网络IP地址
 */
export const getCarrierIPAddress = async (): Promise<string> => {
  return getNetworkInfo(IpType.Carrier, InfoType.Ip);
};

/**
 * 获取移动网络子网掩码
 * @returns Promise<string> 移动网络子网掩码
 */
export const getCarrierSubnet = async (): Promise<string> => {
  return getNetworkInfo(IpType.Carrier, InfoType.Subnet);
};

/**
 * 获取移动网络网关地址
 * @returns Promise<string> 移动网络网关地址
 */
export const getCarrierGateway = async (): Promise<string> => {
  return getNetworkInfo(IpType.Carrier, InfoType.Gateway);
};

/**
 * 获取移动网络MAC地址
 * @returns Promise<string> 移动网络MAC地址
 */
export const getCarrierMac = async (): Promise<string> => {
  return getNetworkInfo(IpType.Carrier, InfoType.Mac);
};

/**
 * 获取完整的WiFi网络信息
 * @returns Promise<{ip: string, subnet: string, gateway: string, mac: string}> WiFi网络信息对象
 */
export const getWiFiInfo = async (): Promise<{ip: string, subnet: string, gateway: string, mac: string}> => {
  const [ip, subnet, gateway, mac] = await Promise.all([
    getWiFiIPAddress(),
    getWiFiSubnet(),
    getWiFiGateway(),
    getWiFiMac()
  ]);
  return { ip, subnet, gateway, mac };
};

/**
 * 获取完整的移动网络信息
 * @returns Promise<{ip: string, subnet: string, gateway: string, mac: string}> 移动网络信息对象
 */
export const getCarrierInfo = async (): Promise<{ip: string, subnet: string, gateway: string, mac: string}> => {
  const [ip, subnet, gateway, mac] = await Promise.all([
    getCarrierIPAddress(),
    getCarrierSubnet(),
    getCarrierGateway(),
    getCarrierMac()
  ]);
  return { ip, subnet, gateway, mac };
};

/**
 * 获取所有网络信息（WiFi和移动网络）
 * @returns Promise<{wifi: object, carrier: object}> 所有网络信息
 */
export const getAllNetworkInfo = async () => {
  const [wifiInfo, carrierInfo] = await Promise.all([
    getWiFiInfo(),
    getCarrierInfo()
  ]);
  return { wifi: wifiInfo, carrier: carrierInfo };
};