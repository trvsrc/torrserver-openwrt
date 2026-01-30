include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for TorrServer
LUCI_DESCRIPTION:=LuCI web interface for TorrServer torrent streaming server
LUCI_DEPENDS:=+torrserver
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-torrserver
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=trvsrc

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildance
$(eval $(call BuildPackage,$(PKG_NAME)))
