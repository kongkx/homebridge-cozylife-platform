/**
 * This is the name of the platform that users will use to register the plugin in the Homebridge config.json
 */
export const PLATFORM_NAME = 'CozylifePlatform';

/**
 * This must match the name of your plugin as defined the package.json
 */
export const PLUGIN_NAME = 'homebridge-cozylife-platform';

export interface LocaleMessages {
  power: string;
  mode: string;
  temperature: string;
  brightness: string;
  hue: string;
  saturation: string;
}

export interface DeviceConfig {
  name?: string;
  disabled?: boolean;
}

export const DEFAULT_PLATFORM_CONFIG = {
  name: 'Cozylife platform',
  port: 5555,
  scanCount: 10,
  language: 'zh-CN',
  scanInterval: 3000,
  checkStatusInterval: 10000,
  devices: [],
};

export const UDP_SCAN_ADDRESS = '255.255.255.255';
export const UDP_SCAN_PORT = 6095;
export const TCP_CLIENT_PORT = 5555;

export const CMD_INFO = 0;
export const CMD_QUERY = 2;
export const CMD_SET = 3;
export const CMD_STATUS_REPORT = 10;

export const TYPE_CODE_SWITCH = '00';
export const TYPE_CODE_LIGHT = '01';
