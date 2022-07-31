import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { createConnection } from 'net';

import { CozyPlatform } from './platform';
import { CMD_QUERY, CMD_SET, TCP_CLIENT_PORT, DeviceConfig, CMD_STATUS_REPORT, AccessoryRes } from './settings';
import commands from './commands';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */

class CozyAccessory {

  protected status: Record<string, unknown>;
  protected statusInterval: NodeJS.Timeout | undefined;

  constructor(
    public readonly platform: CozyPlatform,
    public readonly accessory: PlatformAccessory,
    public readonly deviceConfig: DeviceConfig,
  ) {

    this.platform.log.info(`[${this.getDeviceLabel()}] accessory init`);
    this.platform.log.debug(`[${this.getDeviceLabel()}] info %j`, this.accessory.context.device);

    this.status = {};

    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        this.accessory.context.device.brand || 'Cozylife',
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        `${this.accessory.context.device.pid}(${this.accessory.context.device.hv})`,
      )
      .setCharacteristic(this.platform.Characteristic.Name, this.getName())
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.accessory.context.device.did,
      )
      .setCharacteristic(
        this.platform.Characteristic.FirmwareRevision,
        this.accessory.context.device.sv,
      );

  }

  start = () => {
    this.getDeviceStatus();
    if (Number(this.platform.config.checkStatusInterval)) {
      this.statusInterval = setInterval(() => {
        this.getDeviceStatus();
      }, this.platform.config.checkStatusInterval);
    }
  };

  getDeviceLabel() {
    return `${this.getName()} -- ${this.getIp()}`;
  }

  getName() {
    return this.deviceConfig?.name || this.accessory.context.device.mac;
  }


  getIp() {
    return this.accessory.context.device.ip;
  }

  getCharacteristic(key, callback) {
    const value = this[key];
    this.platform.log.debug(
      `[${this.getDeviceLabel()}] Get characteristic: ${key}, value: ${value}`,
    );
    if (value === null || value !== value) {
      callback(new Error(`Failed to get characteristic value for key: ${key}`));
    } else {
      callback(null, value);
    }
  }

  setCharacteristic(key, value: CharacteristicValue, callback) {
    this.platform.log.debug(
      `[${this.getDeviceLabel()}] Set characteristic: ${key} to value: ${value}`,
    );
    this[key] = value;
    callback(null);
  }


  async sendMessage(message): Promise<AccessoryRes> {
    return new Promise((resolve, reject) => {
      this.platform.log.debug(this.getIp(), TCP_CLIENT_PORT, message);
      const client = createConnection({
        host: this.getIp(),
        port: TCP_CLIENT_PORT,
      }, () => {
        client.write(JSON.stringify(message) + '\r\n', (err) => {
          if (err) {
            reject(err);
          }
        });
      });

      client.on('data', (data) => {
        try {
          const str = data.toString();
          this.platform.log.debug('data received', str);
          const json = JSON.parse(str);
          resolve(json);
        } catch (err) {
          reject(err);
        }
        client.end();
      });
    });
  }

  sendCommand(commands) {
    this.platform.log.debug(
      `[${this.getDeviceLabel()}] Send commands: %j`,
      commands,
    );
    const message = {
      pv: 0,
      cmd: CMD_SET,
      sn: String(Date.now()),
      msg: {
        attr: Object.keys(commands).map(n => Number(n)),
        data: commands,
      },
    };

    return this.sendMessage(message);
  }

  getDeviceStatus() {
    this.platform.log.info(`[${this.getDeviceLabel()}] getDeviceStatus`);
    const message = {
      pv: 0,
      cmd: CMD_QUERY,
      sn: String(Date.now()),
      msg: {
        attr: [0],
      },
    };

    this.sendMessage(message).then((res: AccessoryRes) => {
      this.updateStatus(res.msg.data);
    }).catch((err) => {
      this.platform.log.error('get device status error: %j', err);
    });
  }

  updateStatus(patch) {
    this.platform.log.info(
      `[${this.getDeviceLabel()}] Update Status: %j`,
      patch,
    );
    this.status = {
      ...this.status,
      ...patch,
    };
  }
}

export class CozySwitch extends CozyAccessory {
  private PowerSwitch?: Service;

  constructor(
    public readonly platform: CozyPlatform,
    public readonly accessory: PlatformAccessory,
    public readonly deviceConfig: DeviceConfig,
  ) {

    super(platform, accessory, deviceConfig);

    this.PowerSwitch = this.accessory.getService('power') ||
      this.accessory.addService(this.platform.Service.Switch, 'power');
    this.PowerSwitch.setCharacteristic(this.platform.Characteristic.Name, this.platform.messages.power);
    this.PowerSwitch.getCharacteristic(this.platform.Characteristic.On)
      .on('get',
        (callback) => this.getCharacteristic('power', callback),
      )
      .on('set',
        (value, callback) => this.setCharacteristic('power', value, callback),
      );

    this.start();
  }


  get power() {
    return this.status[commands.power.code] === commands.power.value.on;
  }

  set power(value) {
    if (value === this.power) {
      return;
    }

    const command = {
      [commands.power.code]: value
        ? commands.power.value.on
        : commands.power.value.off,
    };
    this.sendCommand(command).then((res: AccessoryRes) => {
      if (res.res !== 0) {
        this.platform.log.error('set power error response: %j', res);
      } else if (
        res.cmd === CMD_STATUS_REPORT || res.cmd === CMD_SET
      ) {
        this.updateStatus(res.msg.data);
      } else {
        this.platform.log.warn('Not handled message %j', res);
      }
    }).catch((err) => {
      this.platform.log.error('set power error: %j', err);
    });

  }

}


export class CozyLight extends CozyAccessory {

}