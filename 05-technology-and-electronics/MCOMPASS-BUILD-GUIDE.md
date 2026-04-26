# MCompass — Real-World Minecraft Compass Build Guide

Source: https://github.com/chaosgoo/mcompass

## Things to Order

### 1. PCB (Circuit Board)
- Order from **JLCPCB** using the design files on OSHWLab
- Project link: https://oshwlab.com/vjspdhpp/a-real-world-minecraft-compass
- Specs: **1.0mm thickness, black solder mask**
- Enable **SMT Assembly** so JLCPCB solders all the tiny components for you
- How to order:
  1. Create a free account at https://jlcpcb.com
  2. Clone the OSHWLab project to your account
  3. Open in EasyEDA → Fabrication → PCB/SMT Order

### 2. Front Panel (Acrylic)
- Order from **LCSC Mall** panel service
- Specs: **1.0mm semi-transparent black acrylic, strong light shielding, no back adhesive**
- The panel file with pixel blocks is included in the OSHWLab project — ready to upload
- Panel service: https://www.lcsc.com (look for panel/acrylic ordering)
- Note: UV printing may only be available on the Chinese site (szlcsc.com). Alternative: cut plain 1mm dark semi-transparent acrylic to size yourself.

### 3. Light Diffuser Film
- **PET LGT075J**
- No back adhesive — glued on during assembly
- Source: AliExpress (search "PET LGT075J light diffuser film")

### 4. Battery
- **213455 LiPo, 3.7V 500mAh** (dimensions: 21mm × 34mm × 55mm)
- Source: AliExpress or Amazon

### 5. GPS Module (optional — only for GPS version)
- **ATGM336H 5N71** module + ceramic antenna (13.1mm × 15.7mm)
- Source: [Amazon ~$6-8 for 2-pack](https://www.amazon.com/dp/B0DXBHCYN5)
- Without GPS, the compass just points north. With GPS, it points to a set "spawn point."

### 6. Hardware
- **M2×3×3.2 knurled nuts** (heat-set inserts)
- **M2×4 hex screws**
- Source: Amazon or AliExpress

### 7. 3D Printed Case
- Download from MakerWorld: https://makerworld.com.cn/zh/models/667420
- Print top and bottom shell
- Press heat-set inserts into the case with a soldering iron

## Firmware

Pre-built — no compiling needed.

1. Go to https://github.com/chaosgoo/mcompass/actions
2. Click the latest successful **"Build Firmware Workflow"** run
3. Download one of these from the bottom of the page:

| File | Description |
|---|---|
| mcompass-GPS-WIFI-*.bin | GPS version, configure via web browser **(recommended for escape room)** |
| mcompass-GPS-BLE-*.bin | GPS version, configure via Bluetooth |
| mcompass-LITE-WIFI-*.bin | Compass only, configure via web |
| mcompass-LITE-BLE-*.bin | Compass only, configure via Bluetooth |

4. Flash **mcompass.bin** to the ESP32C3 using:
   - **Flash Download Tool** on PC (select USB mode, address 0x0, SPI SPEED: 40MHz, SPI MODE: DIO)
   - Or one-tap flash on Android: https://play.google.com/store/apps/details?id=io.serialflow.espflash

## Setup (Web Server / WiFi Mode)

1. On first boot, the compass creates a hotspot called **"The Lost Compass"**
2. Connect to it and visit http://esp32.local or http://192.168.4.1
3. Configure WiFi credentials and spawn point coordinates
4. If WiFi connection fails, the hotspot reappears

## Button Controls

- **Single press**: Switch between spawn and compass mode
- **4 quick presses**: Show current IP address
- **6 quick presses**: Sensor calibration (do a figure-8 motion)
- **8 quick presses**: Factory reset (clears all settings)
- **Long press in Spawn mode** (with GPS signal): Set current location as new spawn point
- **Long press in Compass mode**: Nether mode (needle spins randomly)

## Notes

- GPS requires open outdoor environments. Without signal, the needle spins erratically.
- QMC5883L is discontinued. QMC5883P is the replacement — firmware auto-detects both.
- The LED type is **WS2812B 0807** (1.7×2.0×0.85mm), specifically **TCWIN TX1812IWCU-F01**
- All Minecraft game assets are copyrighted by Microsoft. The project does not include in-game compass images. The panel pixel blocks have been redrawn.
- For the escape room: use the GPS-WIFI version and set the spawn point to the buried treasure location.
