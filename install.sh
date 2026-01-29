#!/bin/sh
#
# TorrServer installation script for OpenWrt
# Target: GL-iNet MT6000 (ARM Cortex-A53 / aarch64)
#

set -e

INSTALL_DIR="/opt/torrserver"
BINARY_NAME="TorrServer-linux-arm64"
REPO="YouROK/TorrServer"
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

    if [ "$DOWNLOADER" = "curl" ]; then
        curl -L -o "${INSTALL_DIR}/torrserver" "$DOWNLOAD_URL"
    else
        wget -O "${INSTALL_DIR}/torrserver" "$DOWNLOAD_URL"
    fi

    chmod +x "${INSTALL_DIR}/torrserver"
    log_info "Binary installed to ${INSTALL_DIR}/torrserver"
}

install_init_script() {
    log_info "Installing init.d service script..."

    cat > /etc/init.d/torrserver << 'INITEOF'
#!/bin/sh /etc/rc.common
#
# TorrServer init script for OpenWrt (procd)
#

START=99
STOP=10
USE_PROCD=1

PROG="/opt/torrserver/torrserver"
DATADIR="/opt/torrserver/data"
PORT="8090"

start_service() {
    mkdir -p "$DATADIR"

    procd_open_instance
    procd_set_param command "$PROG"
    procd_append_param command -p "$PORT"
    procd_append_param command -d "$DATADIR"
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
    procd_add_reload_trigger "torrserver"
}

reload_service() {
    stop
    start
}

status() {
    if pgrep -x torrserver >/dev/null; then
        echo "TorrServer is running (PID: $(pgrep -x torrserver))"
        return 0
    else
        echo "TorrServer is not running"
        return 1
    fi
}
INITEOF

    chmod +x /etc/init.d/torrserver
    log_info "Init script installed to /etc/init.d/torrserver"
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

start_service() {
    log_info "Starting TorrServer..."
    /etc/init.d/torrserver start
    log_info "TorrServer started"
}

show_status() {
    echo ""
    log_info "Installation complete!"
    echo ""
    echo "TorrServer is now running on port 8090"
    echo "Web interface: http://<router-ip>:8090"
    echo ""
    echo "Useful commands:"
    echo "  /etc/init.d/torrserver start   - Start service"
    echo "  /etc/init.d/torrserver stop    - Stop service"
    echo "  /etc/init.d/torrserver restart - Restart service"
    echo "  /etc/init.d/torrserver status  - Check status"
    echo ""
}

uninstall() {
    log_info "Uninstalling TorrServer..."

    /etc/init.d/torrserver stop 2>/dev/null || true
    /etc/init.d/torrserver disable 2>/dev/null || true

    rm -f /etc/init.d/torrserver
    rm -rf "$INSTALL_DIR"

    log_info "TorrServer uninstalled"
}

usage() {
    echo "TorrServer installation script for OpenWrt"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  install   - Install TorrServer (default)"
    echo "  update    - Update to latest version"
    echo "  uninstall - Remove TorrServer"
    echo "  help      - Show this help"
    echo ""
}

main() {
    case "${1:-install}" in
        install)
            check_root
            check_dependencies
            get_latest_version
            download_binary
            install_init_script
            create_data_dir
            enable_service
            start_service
            show_status
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
