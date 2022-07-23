import dgram from 'dgram';

import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';

import {
  PLATFORM_NAME,
  PLUGIN_NAME,
  DEFAULT_PLATFORM_CONFIG,
  UDP_SCAN_ADDRESS,
  UDP_SCAN_PORT,
  CMD_INFO,
  TYPE_CODE_SWITCH,
  TYPE_CODE_LIGHT,

  LocaleMessages,
  ProductCollection,
} from './settings';

import {
  CozySwitch,
  CozyLight,
} from './Accessory';
import { getPidList } from './utils';

function readLocaleMessages(locale) {
  try {
    return require(`./locale/${locale}`);
  } catch (err) {
    return require('./locale/en');
  }
}

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class CozyPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories;
  socket: dgram.Socket;
  devices: Record<string, PlatformAccessory>;
  initializedDevices: Record<string, boolean>;
  scanCount: number;
  timer: NodeJS.Timeout | undefined;
  messages: LocaleMessages;
  pidList: Array<ProductCollection> | undefined;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.socket = dgram.createSocket('udp4');
    this.devices = {};
    this.initializedDevices = {};
    this.config = {
      ...DEFAULT_PLATFORM_CONFIG,
      ...config,
    };
    this.log.debug('Config: %j', this.config);
    this.scanCount = 0;
    this.messages = readLocaleMessages(this.config.language).default;

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', async () => {
      log.debug('Executed didFinishLaunching callback');
      try {
        log.info('get product list');
        this.pidList = await getPidList();
      } catch (err) {
        let message;
        if (err instanceof Error) {
          message = err.message;
        } else {
          message = String(err);
        }
        log.error(message);
      }

      this.socket.on('message', this.handleMessage);
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });

    this.log.debug('Finished initializing platform:', this.config.name);
  }

  broadcastScan() {
    const message = Buffer.from(
      JSON.stringify({
        pv: 0,
        cmd: CMD_INFO,
        sn: String(Date.now()),
        msg: {},
      }),
    );
    this.socket.send(
      message,
      0,
      message.length,
      UDP_SCAN_PORT,
      UDP_SCAN_ADDRESS,
      () => {
        this.log.debug(
          `Broadcast '${message}' ${UDP_SCAN_ADDRESS}:${UDP_SCAN_PORT}`,
        );
      },
    );
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info(
      'Loading accessory from cache:',
      accessory.displayName,
      accessory.context.device,
    );

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    if (accessory.context.device?.mac) {
      this.devices[accessory.context.device.mac] = accessory;
    }
  }

  discoverDevices() {
    this.socket.bind(this.config.port, () => {
      this.log.info(`UDP server bind to ${this.config.port}`);
      this.socket.setBroadcast(true);
      this.timer = setInterval(() => {
        this.broadcastScan();
        this.scanCount += 1;
        if (this.config.scanCount && this.scanCount > this.config.scanCount && this.timer) {
          this.log.info('Scan finished.');
          clearInterval(this.timer);
          this.timer = undefined;
        }
      }, this.config.scanInterval);
    });
  }

  handleMessage = (msg, rinfo) => {
    this.log.debug('handleMessage', msg.toString());
    try {
      const message = JSON.parse(msg.toString());
      // only handle broadcast respsone
      if (message.cmd !== 0) {
        return;
      }
      this.registerDevice({
        ...message.msg,
        address: rinfo.address,
        port: rinfo.port,
      });

    } catch (err) {
      this.log.error('handleMessage Error', err);
    }
  };

  registerDevice = (deviceInfo) => {
    const deviceConfig = this.config.devices.find(
      (item) => item.mac === deviceInfo.mac,
    );
    let accessory = this.devices[deviceInfo.mac];

    if (deviceConfig?.disabled) {
      this.log.info(`accessory ${deviceInfo.mac} skipped`);
      if (accessory) {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
        delete this.devices[deviceInfo.mac];
      }
      return;
    }

    if (accessory && this.initializedDevices[accessory.UUID]) {
      return;
    }

    if (!accessory) {
      const deviceName = deviceConfig?.name ?? deviceInfo.mac;
      this.log.debug(
        `Initializing new accessory ${deviceInfo.mac} with name ${deviceName}...`,
      );
      const uuid = this.api.hap.uuid.generate(deviceInfo.mac);
      accessory = new this.api.platformAccessory(deviceInfo.mac, uuid);

      this.devices[deviceInfo.mac] = accessory;
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
        accessory,
      ]);
    }

    if (accessory) {
      // mark devices as initialized.
      accessory.context.device = deviceInfo;
      this.initializedDevices[accessory.UUID] = true;
      const deviceTypeCode = this.getDeviceTypeCode(deviceInfo);
      switch (deviceTypeCode) {
        case TYPE_CODE_SWITCH:
          return new CozySwitch(this, accessory, deviceConfig);
        case TYPE_CODE_LIGHT:
          return new CozyLight(this, accessory, deviceConfig);
      }

    }
  };

  getDeviceTypeCode(info) {
    const p = this.pidList?.find((item) => {
      return item.device_model.some((d) => d.device_product_id === info.pid);
    });
    if (p) {
      return p.device_type_code;
    }

    return TYPE_CODE_SWITCH;
  }
}
