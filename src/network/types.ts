// 网络状态相关类型定义

// 扩展Window接口，添加networkinterface属性
declare global {
  interface Window {
    networkinterface?: {
      getWiFiIPAddress: (success: (result: NetworkInfo) => void, error: (error: any) => void) => void;
      getCarrierIPAddress: (success: (result: NetworkInfo) => void, error: (error: any) => void) => void;
    };
  }
}

// 网络信息接口
export interface NetworkInfo {
  ip: string;
  subnet: string;
  gateway: string;
  mac: string;
}

// IP类型枚举
export enum IpType {
  WiFi = 'WiFi',
  Carrier = 'Carrier'
}

// 信息类型枚举
export enum InfoType {
  Ip = 'ip',
  Subnet = 'subnet',
  Gateway = 'gateway',
  Mac = 'mac'
}