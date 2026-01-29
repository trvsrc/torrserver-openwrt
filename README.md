# TorrServer for OpenWrt

Install [TorrServer](https://github.com/YouROK/TorrServer) on OpenWrt routers.

Tested on **GL-iNet MT6000** (MediaTek MT7986A, ARM Cortex-A53).

## Features

- Automatic download of the latest TorrServer release
- OpenWrt procd service integration
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

## Alternative Install

```bash
# Download and run manually
wget https://raw.githubusercontent.com/trvsrc/torrserver-openwrt/main/install.sh
chmod +x install.sh
./install.sh install
```

## Usage

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

# Check status
/etc/init.d/torrserver status

# Enable auto-start on boot
/etc/init.d/torrserver enable

# Disable auto-start
/etc/init.d/torrserver disable
```

### Update TorrServer

```bash
./install.sh update
```

### Uninstall

```bash
./install.sh uninstall
```

## Configuration

TorrServer files are stored in:

| Path | Description |
|------|-------------|
| `/opt/torrserver/torrserver` | Binary executable |
| `/opt/torrserver/data/` | Database and cache |
| `/etc/init.d/torrserver` | Service script |

### Changing the Port

Edit `/etc/init.d/torrserver` and change the `PORT` variable:

```bash
PORT="8090"  # Change to your preferred port
```

Then restart the service:

```bash
/etc/init.d/torrserver restart
```

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

### Port already in use

Change the port in `/etc/init.d/torrserver` and restart.

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
