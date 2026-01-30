#!/bin/sh
#
# TorrServer installation script for OpenWrt
# Target: GL-iNet MT6000 (ARM Cortex-A53 / aarch64)
#

set -e

INSTALL_DIR="/opt/torrserver"
BINARY_NAME="TorrServer-linux-arm64"
REPO="YouROK/TorrServer"
LUCI_REPO="trvsrc/torrserver-openwrt"
SERVICE_NAME="torrserver"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

check_dependencies() {
    log_info "Checking dependencies..."

    for cmd in curl wget; do
        if command -v "$cmd" >/dev/null 2>&1; then
            DOWNLOADER="$cmd"
            break
        fi
    done

    if [ -z "$DOWNLOADER" ]; then
        log_error "curl or wget is required. Install with: opkg install curl"
        exit 1
    fi

    log_info "Using $DOWNLOADER for downloads"
}

download_file() {
    local url="$1"
    local dest="$2"

    if [ "$DOWNLOADER" = "curl" ]; then
        curl -fsSL -o "$dest" "$url"
    else
        wget -q -O "$dest" "$url"
    fi
}

get_latest_version() {
    log_info "Fetching latest version..."

    LATEST_URL="https://github.com/${REPO}/releases/latest"

    if [ "$DOWNLOADER" = "curl" ]; then
        VERSION=$(curl -sI "$LATEST_URL" | grep -i "^location:" | sed 's/.*tag\///' | tr -d '\r\n')
    else
        VERSION=$(wget --spider -S "$LATEST_URL" 2>&1 | grep -i "^  Location:" | sed 's/.*tag\///' | tr -d '\r\n')
    fi

    if [ -z "$VERSION" ]; then
        log_error "Failed to fetch latest version"
        exit 1
    fi

    log_info "Latest version: $VERSION"
}

download_binary() {
    log_info "Downloading TorrServer ${VERSION}..."

    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY_NAME}"

    mkdir -p "$INSTALL_DIR"
    download_file "$DOWNLOAD_URL" "${INSTALL_DIR}/torrserver"
    chmod +x "${INSTALL_DIR}/torrserver"
    log_info "Binary installed to ${INSTALL_DIR}/torrserver"
}

install_uci_config() {
    log_info "Installing UCI configuration..."

    if [ ! -f /etc/config/torrserver ]; then
        cat > /etc/config/torrserver << 'EOF'
config torrserver 'main'
	option enabled '1'
	option port '8090'
	option data_dir '/opt/torrserver/data'
EOF
    fi
    log_info "UCI config installed to /etc/config/torrserver"
}

install_init_script() {
    log_info "Installing init.d service script..."

    cat > /etc/init.d/torrserver << 'INITEOF'
#!/bin/sh /etc/rc.common
#
# TorrServer init script for OpenWrt (procd + UCI)
#

START=99
STOP=10
USE_PROCD=1

PROG="/opt/torrserver/torrserver"
NAME="torrserver"

start_service() {
    config_load "$NAME"

    local enabled port data_dir
    config_get enabled main enabled "1"
    config_get port main port "8090"
    config_get data_dir main data_dir "/opt/torrserver/data"

    [ "$enabled" = "0" ] && return 0

    [ ! -f "$PROG" ] && {
        logger -t "$NAME" "Binary not found: $PROG"
        return 1
    }

    mkdir -p "$data_dir"

    procd_open_instance
    procd_set_param command "$PROG"
    procd_append_param command -p "$port"
    procd_append_param command -d "$data_dir"
    procd_set_param respawn ${respawn_threshold:-3600} ${respawn_timeout:-5} ${respawn_retry:-5}
    procd_set_param stdout 1
    procd_set_param stderr 1
    procd_set_param pidfile /var/run/torrserver.pid
    procd_close_instance
}

stop_service() {
    killall torrserver 2>/dev/null || true
}

service_triggers() {
    procd_add_reload_trigger "$NAME"
}

reload_service() {
    stop
    start
}
INITEOF

    chmod +x /etc/init.d/torrserver
    log_info "Init script installed to /etc/init.d/torrserver"
}

install_luci() {
    log_info "Installing LuCI application..."

    LUCI_BASE="https://raw.githubusercontent.com/${LUCI_REPO}/main/luci-app-torrserver"

    # Create directories
    mkdir -p /www/luci-static/resources/view
    mkdir -p /usr/share/luci/menu.d
    mkdir -p /usr/share/rpcd/acl.d

    # Download LuCI files
    log_info "Downloading LuCI view..."
    download_file "${LUCI_BASE}/htdocs/luci-static/resources/view/torrserver.js" \
        /www/luci-static/resources/view/torrserver.js

    log_info "Downloading menu configuration..."
    download_file "${LUCI_BASE}/root/usr/share/luci/menu.d/luci-app-torrserver.json" \
        /usr/share/luci/menu.d/luci-app-torrserver.json

    log_info "Downloading ACL configuration..."
    download_file "${LUCI_BASE}/root/usr/share/rpcd/acl.d/luci-app-torrserver.json" \
        /usr/share/rpcd/acl.d/luci-app-torrserver.json

    # Restart rpcd to pick up new ACL
    /etc/init.d/rpcd restart 2>/dev/null || true

    log_info "LuCI application installed"
}

create_data_dir() {
    log_info "Creating data directory..."
    mkdir -p "${INSTALL_DIR}/data"
    log_info "Data directory: ${INSTALL_DIR}/data"
}

enable_service() {
    log_info "Enabling TorrServer service..."
    /etc/init.d/torrserver enable
    log_info "Service enabled"
}

start_service_now() {
    log_info "Starting TorrServer..."
    /etc/init.d/torrserver start
    log_info "TorrServer started"
}

show_status() {
    local port=$(uci -q get torrserver.main.port || echo "8090")
    echo ""
    log_info "Installation complete!"
    echo ""
    echo "TorrServer is now running on port $port"
    echo "Web interface: http://<router-ip>:$port"
    echo "LuCI control: http://<router-ip>/cgi-bin/luci/admin/services/torrserver"
    echo ""
    echo "Useful commands:"
    echo "  /etc/init.d/torrserver start   - Start service"
    echo "  /etc/init.d/torrserver stop    - Stop service"
    echo "  /etc/init.d/torrserver restart - Restart service"
    echo ""
}

show_status_noluci() {
    local port=$(uci -q get torrserver.main.port || echo "8090")
    echo ""
    log_info "Installation complete!"
    echo ""
    echo "TorrServer is now running on port $port"
    echo "Web interface: http://<router-ip>:$port"
    echo ""
    echo "Useful commands:"
    echo "  /etc/init.d/torrserver start   - Start service"
    echo "  /etc/init.d/torrserver stop    - Stop service"
    echo "  /etc/init.d/torrserver restart - Restart service"
    echo ""
}

uninstall() {
    log_info "Uninstalling TorrServer..."

    /etc/init.d/torrserver stop 2>/dev/null || true
    /etc/init.d/torrserver disable 2>/dev/null || true

    rm -f /etc/init.d/torrserver
    rm -f /etc/config/torrserver
    rm -f /www/luci-static/resources/view/torrserver.js
    rm -f /usr/share/luci/menu.d/luci-app-torrserver.json
    rm -f /usr/share/rpcd/acl.d/luci-app-torrserver.json
    rm -rf "$INSTALL_DIR"

    # Restart rpcd to remove ACL
    /etc/init.d/rpcd restart 2>/dev/null || true

    log_info "TorrServer uninstalled"
}

show_status_luci_only() {
    local port=$(uci -q get torrserver.main.port || echo "8090")
    echo ""
    log_info "LuCI application installed!"
    echo ""
    echo "LuCI control: http://<router-ip>/cgi-bin/luci/admin/services/torrserver"
    echo ""
}

usage() {
    echo "TorrServer installation script for OpenWrt"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  install      - Install TorrServer with LuCI web interface (default)"
    echo "  install-bare - Install TorrServer without LuCI"
    echo "  install-luci - Add LuCI interface to existing installation"
    echo "  update       - Update to latest version"
    echo "  uninstall    - Remove TorrServer completely"
    echo "  help         - Show this help"
    echo ""
}

main() {
    case "${1:-install}" in
        install)
            check_root
            check_dependencies
            get_latest_version
            download_binary
            install_uci_config
            install_init_script
            create_data_dir
            install_luci
            enable_service
            start_service_now
            show_status
            ;;
        install-bare)
            check_root
            check_dependencies
            get_latest_version
            download_binary
            install_uci_config
            install_init_script
            create_data_dir
            enable_service
            start_service_now
            show_status_noluci
            ;;
        install-luci)
            check_root
            check_dependencies
            install_uci_config
            install_init_script
            install_luci
            /etc/init.d/torrserver restart 2>/dev/null || true
            show_status_luci_only
            ;;
        update)
            check_root
            check_dependencies
            /etc/init.d/torrserver stop 2>/dev/null || true
            get_latest_version
            download_binary
            /etc/init.d/torrserver start
            log_info "TorrServer updated to ${VERSION}"
            ;;
        uninstall)
            check_root
            uninstall
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            log_error "Unknown command: $1"
            usage
            exit 1
            ;;
    esac
}

main "$@"
