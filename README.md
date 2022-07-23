# Homebridge Cozylife Platform

Cozylife Homebrige integration using local net.

## Supported Device Types

- Switch

## Installation

```
npm install homebridge-cozylife-platform
```

## Configuration (mininal)

```json
{
  "platforms": [
    {
      "platform": "CozylifePlatform"
    }
  ]
}
```

## Configuration (optional)

```json
{
  "platforms": [
    {
      "platform": "CozylifePlatform",
      "scanInterval": "10000",
      "checkStatusInterval": "10000",
      "devices": [
        {
          "mac": "xxxxxxxx",
          "name": "my swtich"
        }
      ]
    }
  ]
}
```

## TODO

- [ ] Light Accessory

## Development

1.  clone repository

        ```bash
        git clone https://github.com/kongkx/homebridge-cozylife-platform.git
        ```

2.  prepare homebridge config

        ```bash
        cp homebridge/config.json.example homebridge/config.json
        ```

3.  run watch command

        ```bash
        npm run watch
        ```
