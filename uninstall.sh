#!/bin/bash

# ==============================================================================
# MafBoard — Uninstall Script
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

CONFIG_FILE="/etc/mafboard/config.env"

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Run with sudo: sudo bash uninstall.sh${NC}"
    exit 1
fi

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}       MafBoard — Uninstall                                 ${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# Try to load config
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
    echo -e "  Found config for domain: ${GREEN}$DOMAIN${NC}"
    echo ""
fi

# Ask for domain if not loaded from config
if [ -z "$DOMAIN" ]; then
    read -p "Enter domain name (e.g. mafboard.example.com): " DOMAIN
    if [ -z "$DOMAIN" ]; then
        echo -e "${RED}Error: Domain cannot be empty.${NC}"
        exit 1
    fi
fi

PROJECT_DEST_DIR="/var/www/$DOMAIN"
PHP_VERSION="8.2"

echo ""
read -p "Delete MySQL database? (y/n) [n]: " DELETE_DB
read -p "Delete PHP and MySQL packages? (y/n) [n]: " DELETE_PACKAGES

echo ""
echo -e "${RED}WARNING: The following will be removed:${NC}"
echo -e "  - Project files:     ${YELLOW}$PROJECT_DEST_DIR${NC}"
echo -e "  - Nginx config:      ${YELLOW}$DOMAIN${NC}"
echo -e "  - SSL certificate:   ${YELLOW}$DOMAIN${NC}"
echo -e "  - PM2 services:      ${YELLOW}mafboard-socketio, mafboard-auth-bot${NC}"
echo -e "  - Config:            ${YELLOW}$CONFIG_FILE${NC}"
if [ "$DELETE_DB" = "y" ] || [ "$DELETE_DB" = "Y" ]; then
    echo -e "  - MySQL database:    ${YELLOW}YES${NC}"
fi
echo ""
read -p "Continue with uninstall? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Uninstall cancelled."
    exit 0
fi

# 1. Stop PM2 services
echo ""
echo -e "${YELLOW}--- Stopping PM2 services ---${NC}"
export NVM_DIR="/root/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then . "$NVM_DIR/nvm.sh"; fi
if command -v pm2 &> /dev/null; then
    pm2 delete "mafboard-socketio" 2>/dev/null || echo "  Socket.IO service not found"
    pm2 delete "mafboard-websocket" 2>/dev/null || true
    pm2 delete "mafboard-auth-bot" 2>/dev/null || echo "  Bot service not found"
    pm2 save --force
    pm2 unstartup 2>/dev/null || true
fi

# 2. Remove SSL certificate
echo -e "${YELLOW}--- Removing SSL certificate ---${NC}"
certbot delete --cert-name "$DOMAIN" --non-interactive 2>/dev/null || echo "  Certificate not found"

# 3. Remove Nginx config
echo -e "${YELLOW}--- Removing Nginx configuration ---${NC}"
rm -f "/etc/nginx/sites-enabled/$DOMAIN"
rm -f "/etc/nginx/sites-available/$DOMAIN"
systemctl reload nginx 2>/dev/null || true

# 4. Remove database
if [ "$DELETE_DB" = "y" ] || [ "$DELETE_DB" = "Y" ]; then
    echo -e "${YELLOW}--- Removing database ---${NC}"
    DB_NAME=${DB_NAME:-mafboard_db}
    DB_USER=${DB_USER:-mafboard_user}
    read -p "Database name to delete [$DB_NAME]: " INPUT_DB
    DB_NAME=${INPUT_DB:-$DB_NAME}
    read -p "MySQL user to delete [$DB_USER]: " INPUT_USER
    DB_USER=${INPUT_USER:-$DB_USER}

    mysql -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`;" 2>/dev/null || echo "  Database not found"
    mysql -e "DROP USER IF EXISTS '${DB_USER}'@'localhost';" 2>/dev/null || echo "  User not found"
    mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true
    echo -e "${GREEN}  Database '${DB_NAME}' and user '${DB_USER}' removed${NC}"
fi

# 5. Remove project files
echo -e "${YELLOW}--- Removing project files ---${NC}"
rm -rf "$PROJECT_DEST_DIR"

# 6. Remove config
rm -f "$CONFIG_FILE"
rmdir /etc/mafboard 2>/dev/null || true

# 7. Remove packages (optional)
if [ "$DELETE_PACKAGES" = "y" ] || [ "$DELETE_PACKAGES" = "Y" ]; then
    echo -e "${YELLOW}--- Removing PHP and MySQL packages ---${NC}"
    apt-get purge -y "php${PHP_VERSION}-fpm" "php${PHP_VERSION}-mysql" "php${PHP_VERSION}-curl" \
        "php${PHP_VERSION}-mbstring" "php${PHP_VERSION}-xml" mysql-server 2>/dev/null || true
    add-apt-repository --remove -y ppa:ondrej/php 2>/dev/null || true
    apt-get autoremove -y
fi

echo ""
echo -e "${CYAN}================================================================${NC}"
echo -e "${GREEN}UNINSTALL COMPLETE.${NC}"
echo -e "${CYAN}================================================================${NC}"
