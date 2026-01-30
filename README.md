# TorrServer for OpenWrt

Install [TorrServer](https://github.com/YouROK/TorrServer) on OpenWrt routers with LuCI web interface integration.

Tested on **GL-iNet MT6000** (MediaTek MT7986A, ARM Cortex-A53).

## Features

- Automatic download of the latest TorrServer release
- **LuCI web interface** for easy control
- OpenWrt procd service integration with UCI configuration
- Auto-start on boot
- Simple install/update/uninstall commands

## Requirements

- OpenWrt 21.02 or later
- ARM64 (aarch64) architecture
- `curl` or `wget` installed
- Sufficient storage in `/opt` (recommend USB storage or microSD)

## One-Liner Install

Run this command on your OpenWrt router:

```bash
wget -O - https://raw.githubusercontent.com/trvsrc/torrserver-openwrt/main/install.sh | sh
```

Or with curl:

```bash
curl -fsSL https://raw.githubusercontent.com/trvsrc/torrserver-openwrt/main/install.sh | sh
```

### Install without LuCI

If you don't want the LuCI web interface:

```bash
wget -O - https://raw.githubusercontent.com/trvsrc/torrserver-openwrt/main/install.sh | sh -s install-bare
```

## LuCI Web Interface

After installation, access TorrServer control panel in LuCI:

```
http://<router-ip>/cgi-bin/luci/admin/services/torrserver
```

The LuCI interface provides:
- Service status (running/stopped)
- Start/Stop/Restart buttons
- Enable/Disable autostart
- Port configuration
- Data directory setting
- Direct link to TorrServer web UI

## Usage

### TorrServer Web UI

After installation, TorrServer will be available at:

```
http://<router-ip>:8090
```

### Service Commands

```bash
# Start TorrServer
/etc/init.d/torrserver start

# Stop TorrServer
/etc/init.d/torrserver stop

# Restart TorrServer
/etc/init.d/torrserver restart

# Enable auto-start on boot
/etc/init.d/torrserver enable

# Disable auto-start
/etc/init.d/torrserver disable
```

### Update TorrServer

```bash
wget -O /tmp/install.sh https://raw.githubusercontent.com/trvsrc/torrserver-openwrt/main/install.sh
sh /tmp/install.sh update
```

### Uninstall

```bash
wget -O /tmp/install.sh https://raw.githubusercontent.com/trvsrc/torrserver-openwrt/main/install.sh
sh /tmp/install.sh uninstall
```

## Configuration

### UCI Configuration

TorrServer uses OpenWrt's UCI system for configuration:

```bash
# View current config
uci show torrserver

# Change port
uci set torrserver.main.port='9090'
uci commit torrserver
/etc/init.d/torrserver restart

# Change data directory
uci set torrserver.main.data_dir='/mnt/usb/torrserver'
uci commit torrserver
/etc/init.d/torrserver restart

# Disable service
uci set torrserver.main.enabled='0'
uci commit torrserver
/etc/init.d/torrserver restart
```

### File Locations

| Path | Description |
|------|-------------|
| `/opt/torrserver/torrserver` | Binary executable |
| `/opt/torrserver/data/` | Database and cache |
| `/etc/config/torrserver` | UCI configuration |
| `/etc/init.d/torrserver` | Service script |

### LuCI App Files

| Path | Description |
|------|-------------|
| `/www/luci-static/resources/view/torrserver.js` | LuCI view |
| `/usr/share/luci/menu.d/luci-app-torrserver.json` | Menu entry |
| `/usr/share/rpcd/acl.d/luci-app-torrserver.json` | ACL permissions |

## Storage Considerations

TorrServer caches torrent data. For best performance:

1. Mount USB storage or microSD card to `/opt`
2. Ensure adequate free space for your torrents

Example fstab entry for USB storage:

```bash
# /etc/config/fstab
config mount
    option target '/opt'
    option device '/dev/sda1'
    option fstype 'ext4'
    option options 'rw,noatime'
    option enabled '1'
```

## Troubleshooting

### TorrServer won't start

Check if the binary is executable:

```bash
ls -la /opt/torrserver/torrserver
chmod +x /opt/torrserver/torrserver
```

Check logs:

```bash
logread | grep torrserver
```

### LuCI page not showing

Restart rpcd and uhttpd:

```bash
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

### Port already in use

Change the port via UCI or LuCI and restart.

### Out of memory

The MT6000 has 1GB RAM. If running low:

```bash
# Check memory
free -m

# Reduce TorrServer cache in web UI settings
```

## License

MIT

## Credits

- [TorrServer](https://github.com/YouROK/TorrServer) by YouROK
