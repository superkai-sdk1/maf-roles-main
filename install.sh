#!/bin/bash

# ==============================================================================
# MafBoard v2 — Production Installation Script for Ubuntu
# v2.0: webapp-v2 (React/Vite) + PHP API + WebSocket + Telegram Bot + SSL
#
# Components:
#   - Nginx (reverse proxy + static files)
#   - PHP 8.2-FPM + MySQL 8 (API backend)
#   - Node.js 20 (WebSocket server + Telegram auth bot)
#   - PM2 (process manager)
#   - Certbot (Let's Encrypt SSL)
#   - Vite build (React SPA)
#
# Usage:
#   sudo bash install.sh              — full installation
#   sudo bash install.sh --update     — update from Git
# ==============================================================================

set -e

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()    { echo -e "\n${CYAN}${BOLD}--- $1 ---${NC}"; }

# --- Constants ---
PROJECT_SOURCE_DIR=$(cd "$(dirname "$0")" && pwd)
NODE_VERSION="20"
PHP_VERSION="8.2"
BACKEND_PORT="8081"
BACKEND_SERVICE_NAME="mafboard-websocket"
BOT_SERVICE_NAME="mafboard-auth-bot"
CONFIG_FILE="/etc/mafboard/config.env"

# ==============================================================================
# UPDATE MODE
# ==============================================================================
if [ "$1" = "--update" ]; then
    echo -e "${CYAN}============================================================${NC}"
    echo -e "${CYAN}       MafBoard — Update from Git                           ${NC}"
    echo -e "${CYAN}============================================================${NC}"
    echo ""

    if [ "$EUID" -ne 0 ]; then
        log_error "Run with sudo: sudo bash install.sh --update"
        exit 1
    fi

    if [ ! -f "$CONFIG_FILE" ]; then
        log_error "Config not found at $CONFIG_FILE"
        log_error "Run a full installation first: sudo bash install.sh"
        exit 1
    fi

    source "$CONFIG_FILE"

    if [ -z "$DOMAIN" ] || [ -z "$PROJECT_DEST_DIR" ]; then
        log_error "Invalid config. DOMAIN or PROJECT_DEST_DIR is empty."
        exit 1
    fi

    log_info "Updating MafBoard for domain: ${GREEN}$DOMAIN${NC}"
    log_info "Project directory: ${GREEN}$PROJECT_DEST_DIR${NC}"

    # Load NVM
    export NVM_DIR="/root/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

    # Pull latest code
    log_step "Step 1/5: Pulling latest code from Git"
    if [ -d "$PROJECT_DEST_DIR/.git" ]; then
        cd "$PROJECT_DEST_DIR"
        git fetch origin
        git reset --hard origin/main 2>/dev/null || git reset --hard origin/master
        log_info "Git pull complete"
    else
        log_warn "Not a git repo, syncing from source directory..."
        rsync -av --exclude='.git' --exclude='node_modules' --exclude='dist' \
              --exclude='webapp-v2/node_modules' --exclude='webapp-v2/dist' \
              "$PROJECT_SOURCE_DIR/" "$PROJECT_DEST_DIR/"
    fi

    # Install Node.js dependencies
    log_step "Step 2/5: Updating Node.js dependencies"
    cd "$PROJECT_DEST_DIR/websocket"
    npm install --production
    cd "$PROJECT_DEST_DIR/webapp-v2/login"
    npm install --production

    # Rebuild webapp-v2
    log_step "Step 3/5: Building webapp-v2"
    cd "$PROJECT_DEST_DIR/webapp-v2"
    npm install
    npm run build
    log_info "Build complete: $PROJECT_DEST_DIR/webapp-v2/dist/"

    # Fix permissions
    log_step "Step 4/5: Fixing permissions"
    chown -R www-data:www-data "$PROJECT_DEST_DIR"
    chmod -R 755 "$PROJECT_DEST_DIR"
    chmod -R 775 "$PROJECT_DEST_DIR/websocket"

    # Restart services
    log_step "Step 5/5: Restarting services"
    . "$NVM_DIR/nvm.sh"
    pm2 restart "$BACKEND_SERVICE_NAME" 2>/dev/null || log_warn "WebSocket service not found"
    pm2 restart "$BOT_SERVICE_NAME" 2>/dev/null || log_warn "Bot service not found"
    systemctl reload nginx

    echo ""
    echo -e "${CYAN}============================================================${NC}"
    echo -e "${GREEN}       UPDATE COMPLETE!${NC}"
    echo -e "${CYAN}============================================================${NC}"
    echo -e "  Site: ${GREEN}https://$DOMAIN${NC}"
    echo ""
    pm2 status
    exit 0
fi

# ==============================================================================
# FULL INSTALLATION
# ==============================================================================

if [ "$EUID" -ne 0 ]; then
    log_error "Run with sudo: sudo bash install.sh"
    exit 1
fi

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}       MafBoard v2 — Full Installation                      ${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""
echo -e "  This script will install and configure:"
echo -e "    ${BOLD}1.${NC} Nginx + SSL (Let's Encrypt)"
echo -e "    ${BOLD}2.${NC} PHP ${PHP_VERSION}-FPM + MySQL 8"
echo -e "    ${BOLD}3.${NC} Node.js ${NODE_VERSION} (NVM) + PM2"
echo -e "    ${BOLD}4.${NC} WebSocket server"
echo -e "    ${BOLD}5.${NC} Telegram authentication bot"
echo -e "    ${BOLD}6.${NC} Build React app (Vite)"
echo ""

# ==============================================================================
# INTERACTIVE INPUT
# ==============================================================================

# --- Domain ---
echo -e "${YELLOW}${BOLD}=== Domain Configuration ===${NC}"
read -p "Enter domain name (e.g. mafboard.example.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    log_error "Domain cannot be empty."
    exit 1
fi
echo ""

# --- Git Repository ---
echo -e "${YELLOW}${BOLD}=== Git Repository ===${NC}"
read -p "Git repository URL (leave empty to copy from current dir): " GIT_REPO_URL
echo ""

# --- MySQL ---
echo -e "${YELLOW}${BOLD}=== MySQL Configuration ===${NC}"
read -p "Database name [mafboard_db]: " DB_NAME
DB_NAME=${DB_NAME:-mafboard_db}

read -p "MySQL username [mafboard_user]: " DB_USER
DB_USER=${DB_USER:-mafboard_user}

read -s -p "MySQL password (leave empty to auto-generate): " DB_PASS
echo ""
if [ -z "$DB_PASS" ]; then
    DB_PASS=$(openssl rand -base64 16 | tr -d '=/+' | head -c 20)
    log_info "Generated password: ${YELLOW}$DB_PASS${NC}"
fi

DB_PORT="3306"
echo ""

# --- Telegram Bot ---
echo -e "${YELLOW}${BOLD}=== Telegram Bot Configuration ===${NC}"
echo -e "  Get bot token from ${CYAN}@BotFather${NC} in Telegram"
echo -e "  Get your Telegram ID from ${CYAN}@userinfobot${NC}"
echo ""

read -p "Telegram Bot Token: " BOT_TOKEN
if [ -z "$BOT_TOKEN" ]; then
    log_error "Bot token is required."
    exit 1
fi

read -p "Bot username without @ (e.g. mafboard_bot): " BOT_USERNAME
if [ -z "$BOT_USERNAME" ]; then
    log_error "Bot username is required."
    exit 1
fi

read -p "Admin Telegram ID: " ADMIN_TELEGRAM_ID
ADMIN_TELEGRAM_ID=${ADMIN_TELEGRAM_ID:-0}
echo ""

# --- SSL Email ---
read -p "Email for SSL certificate [$DOMAIN admin]: " LETSENCRYPT_EMAIL
LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL:-admin@$DOMAIN}
echo ""

# --- Computed variables ---
PROJECT_DEST_DIR="/var/www/$DOMAIN"

# --- Confirmation ---
echo -e "${CYAN}============================================================${NC}"
echo -e "  Domain:          ${GREEN}$DOMAIN${NC}"
echo -e "  Install path:    ${GREEN}$PROJECT_DEST_DIR${NC}"
echo -e "  Git repo:        ${GREEN}${GIT_REPO_URL:-local copy}${NC}"
echo -e "  Database:        ${GREEN}$DB_NAME${NC} (user: ${GREEN}$DB_USER${NC})"
echo -e "  Bot:             ${GREEN}@$BOT_USERNAME${NC}"
echo -e "  Admin TG ID:     ${GREEN}$ADMIN_TELEGRAM_ID${NC}"
echo -e "  SSL email:       ${GREEN}$LETSENCRYPT_EMAIL${NC}"
echo -e "${CYAN}============================================================${NC}"
read -p "Everything correct? Start installation? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Installation cancelled."
    exit 0
fi

# ==============================================================================
# STEP 1: System Dependencies
# ==============================================================================
log_step "Step 1/10: Installing system dependencies"

apt-get update -qq
apt-get install -y curl wget gnupg2 software-properties-common git rsync unzip

# PHP repository
add-apt-repository -y ppa:ondrej/php 2>/dev/null || true
apt-get update -qq

apt-get install -y \
    nginx \
    certbot python3-certbot-nginx \
    "php${PHP_VERSION}-fpm" \
    "php${PHP_VERSION}-mysql" \
    "php${PHP_VERSION}-curl" \
    "php${PHP_VERSION}-mbstring" \
    "php${PHP_VERSION}-xml" \
    mysql-server \
    ufw

systemctl enable nginx mysql "php${PHP_VERSION}-fpm"
systemctl start nginx mysql "php${PHP_VERSION}-fpm"

log_info "System dependencies installed"

# ==============================================================================
# STEP 2: MySQL Setup
# ==============================================================================
log_step "Step 2/10: Configuring MySQL"

mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

mysql "$DB_NAME" -e "
CREATE TABLE IF NOT EXISTS \`players\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`login\` varchar(100) NOT NULL,
  \`data\` varchar(2000) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`auth_sessions\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`token\` varchar(128) NOT NULL,
  \`telegram_id\` bigint(20) NOT NULL,
  \`telegram_username\` varchar(255) DEFAULT NULL,
  \`telegram_first_name\` varchar(255) DEFAULT NULL,
  \`telegram_last_name\` varchar(255) DEFAULT NULL,
  \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`expires_at\` datetime NOT NULL,
  \`last_active\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`token\` (\`token\`),
  KEY \`telegram_id\` (\`telegram_id\`),
  KEY \`expires_at\` (\`expires_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`auth_codes\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`code\` varchar(4) NOT NULL,
  \`telegram_id\` bigint(20) DEFAULT NULL,
  \`token\` varchar(128) DEFAULT NULL,
  \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`expires_at\` datetime NOT NULL,
  \`confirmed_at\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`code\` (\`code\`),
  KEY \`expires_at\` (\`expires_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"

log_info "Database '${DB_NAME}' and tables created"

# ==============================================================================
# STEP 3: Node.js via NVM
# ==============================================================================
log_step "Step 3/10: Installing Node.js v${NODE_VERSION}"

export NVM_DIR="/root/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    mkdir -p "$NVM_DIR"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
. "$NVM_DIR/nvm.sh"

nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"
nvm alias default "$NODE_VERSION"

NODE_PATH=$(which node)
NPM_PATH=$(which npm)
log_info "Node.js: $($NODE_PATH --version) at $NODE_PATH"

# Install PM2 globally
npm install pm2 -g
log_info "PM2 installed"

# ==============================================================================
# STEP 4: Copy Project Files
# ==============================================================================
log_step "Step 4/10: Deploying project files"

mkdir -p "$PROJECT_DEST_DIR"

if [ -n "$GIT_REPO_URL" ]; then
    if [ -d "$PROJECT_DEST_DIR/.git" ]; then
        cd "$PROJECT_DEST_DIR"
        git pull origin main 2>/dev/null || git pull origin master
    else
        rm -rf "$PROJECT_DEST_DIR"
        git clone "$GIT_REPO_URL" "$PROJECT_DEST_DIR"
    fi
else
    rsync -av --exclude='.git' --exclude='node_modules' --exclude='webapp-v2/node_modules' \
          --exclude='webapp-v2/dist' --exclude='*.log' \
          "$PROJECT_SOURCE_DIR/" "$PROJECT_DEST_DIR/"
fi

log_info "Project files deployed to $PROJECT_DEST_DIR"

# ==============================================================================
# STEP 5: Configure PHP Backend
# ==============================================================================
log_step "Step 5/10: Configuring PHP backend"

# db.php
cat > "$PROJECT_DEST_DIR/webapp-v2/api/db.php" <<'PHPEOF'
<?php

require  'medoo.php';
use Medoo\Medoo;

$database = new Medoo(array(
	'database_type' => 'mysql',
	'database_name' => 'DB_NAME_PLACEHOLDER',
	'server' => 'localhost',
	'username' => 'DB_USER_PLACEHOLDER',
	'password' => 'DB_PASS_PLACEHOLDER',
	'charset' => 'utf8',
	'port' => DB_PORT_PLACEHOLDER,
	'prefix' => '',
	'error' => PDO::ERRMODE_EXCEPTION,
));

$TABLE_PLAYERS = 'players';
PHPEOF

sed -i "s#DB_NAME_PLACEHOLDER#${DB_NAME}#g" "$PROJECT_DEST_DIR/webapp-v2/api/db.php"
sed -i "s#DB_USER_PLACEHOLDER#${DB_USER}#g" "$PROJECT_DEST_DIR/webapp-v2/api/db.php"
sed -i "s#DB_PASS_PLACEHOLDER#${DB_PASS}#g" "$PROJECT_DEST_DIR/webapp-v2/api/db.php"
sed -i "s#DB_PORT_PLACEHOLDER#${DB_PORT}#g" "$PROJECT_DEST_DIR/webapp-v2/api/db.php"

# auth-config.php
cat > "$PROJECT_DEST_DIR/webapp-v2/login/auth-config.php" <<AUTHEOF
<?php
define('BOT_TOKEN', '${BOT_TOKEN}');
define('BOT_USERNAME', '${BOT_USERNAME}');
define('SESSION_TTL_DAYS', 30);
define('CODE_TTL_SECONDS', 300);
define('CODE_POLL_INTERVAL_MS', 2500);
AUTHEOF

# admin-config.php
mkdir -p "$PROJECT_DEST_DIR/webapp-v2/admin/api"
cat > "$PROJECT_DEST_DIR/webapp-v2/admin/api/admin-config.php" <<ADMINEOF
<?php
define('ADMIN_TELEGRAM_IDS', [
    ${ADMIN_TELEGRAM_ID},
]);
define('ADMIN_PANEL_NAME', 'MafBoard Admin');
ADMINEOF

# bot.js — write config lines directly (sed can't handle || in JS)
BOT_JS="$PROJECT_DEST_DIR/webapp-v2/login/bot.js"
python3 -c "
import re, sys
with open('$BOT_JS', 'r') as f:
    content = f.read()
content = re.sub(
    r\"const BOT_TOKEN = process\\.env\\.BOT_TOKEN \\|\\| '[^']*';\",
    \"const BOT_TOKEN = process.env.BOT_TOKEN || '${BOT_TOKEN}';\",
    content
)
content = re.sub(
    r\"const CONFIRM_API_URL = process\\.env\\.CONFIRM_API_URL \\|\\| '[^']*';\",
    \"const CONFIRM_API_URL = process.env.CONFIRM_API_URL || 'https://${DOMAIN}/login/code-confirm.php';\",
    content
)
with open('$BOT_JS', 'w') as f:
    f.write(content)
"

log_info "PHP backend configured"

# ==============================================================================
# STEP 6: Install Node.js Dependencies
# ==============================================================================
log_step "Step 6/10: Installing Node.js dependencies"

# WebSocket server
cd "$PROJECT_DEST_DIR/websocket"
npm install --production
log_info "WebSocket dependencies installed"

# Telegram auth bot
cd "$PROJECT_DEST_DIR/webapp-v2/login"
npm install --production
log_info "Auth bot dependencies installed"

# webapp-v2
cd "$PROJECT_DEST_DIR/webapp-v2"
npm install
log_info "webapp-v2 dependencies installed"

# ==============================================================================
# STEP 7: Build React App
# ==============================================================================
log_step "Step 7/10: Building webapp-v2 (React/Vite)"

cd "$PROJECT_DEST_DIR/webapp-v2"
npm run build

if [ ! -f "$PROJECT_DEST_DIR/webapp-v2/dist/index.html" ]; then
    log_error "Build failed — dist/index.html not found"
    exit 1
fi

log_info "Build successful: $PROJECT_DEST_DIR/webapp-v2/dist/"

# ==============================================================================
# STEP 8: File Permissions
# ==============================================================================
log_step "Step 8/10: Setting file permissions"

chown -R www-data:www-data "$PROJECT_DEST_DIR"
chmod -R 755 "$PROJECT_DEST_DIR"
chmod -R 775 "$PROJECT_DEST_DIR/websocket"

# Create writable directories for WebSocket
mkdir -p "$PROJECT_DEST_DIR/websocket/api"
chown -R www-data:www-data "$PROJECT_DEST_DIR/websocket"

log_info "Permissions set"

# ==============================================================================
# STEP 9: Nginx + SSL
# ==============================================================================
log_step "Step 9/10: Configuring Nginx and SSL"

# Temporary HTTP config for SSL certificate
cat <<EOF > "/etc/nginx/sites-available/$DOMAIN"
server {
    listen 80;
    server_name $DOMAIN;
    root $PROJECT_DEST_DIR/webapp-v2/dist;
    location /.well-known/acme-challenge/ { allow all; }
    location / { return 301 https://\$host\$request_uri; }
}
EOF

ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/"
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Get SSL certificate
log_info "Obtaining SSL certificate for $DOMAIN..."
certbot --nginx --agree-tos --redirect --non-interactive -m "$LETSENCRYPT_EMAIL" -d "$DOMAIN"

# Final Nginx configuration
cat <<EOF > "/etc/nginx/sites-available/$DOMAIN"
# ==============================================
# MafBoard v2 — Nginx Configuration
# Domain: $DOMAIN
# Generated: $(date +%Y-%m-%d)
# ==============================================

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # --- SSL ---
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # --- Security headers ---
    add_header X-Frame-Allow "ALLOWALL";
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # --- SPA (webapp-v2 built files) ---
    root $PROJECT_DEST_DIR/webapp-v2/dist;
    index index.html;

    # SPA fallback — all non-file routes serve index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # --- PHP API ---
    location /api/ {
        alias $PROJECT_DEST_DIR/webapp-v2/api/;
        location ~ \.php\$ {
            fastcgi_pass unix:/var/run/php/php${PHP_VERSION}-fpm.sock;
            fastcgi_param SCRIPT_FILENAME \$request_filename;
            include fastcgi_params;
        }
    }

    # --- Auth / Login PHP ---
    location /login/ {
        alias $PROJECT_DEST_DIR/webapp-v2/login/;
        location ~ \.php\$ {
            fastcgi_pass unix:/var/run/php/php${PHP_VERSION}-fpm.sock;
            fastcgi_param SCRIPT_FILENAME \$request_filename;
            include fastcgi_params;
        }
    }

    # --- Admin panel ---
    location /admin/ {
        alias $PROJECT_DEST_DIR/webapp-v2/admin/;
        location ~ \.php\$ {
            fastcgi_pass unix:/var/run/php/php${PHP_VERSION}-fpm.sock;
            fastcgi_param SCRIPT_FILENAME \$request_filename;
            include fastcgi_params;
        }
    }

    # --- WebSocket proxy ---
    location /bridge {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # --- Static file caching ---
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # --- Block sensitive files ---
    location ~ /\.(?!well-known) {
        deny all;
    }
    location ~ /(node_modules|\.git|\.env) {
        deny all;
    }
}

server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}
EOF

nginx -t && systemctl reload nginx
log_info "Nginx configured with SSL"

# ==============================================================================
# STEP 10: Firewall + PM2
# ==============================================================================
log_step "Step 10/10: Firewall and PM2 services"

# Firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
log_info "Firewall configured"

# PM2 services
. "$NVM_DIR/nvm.sh"

pm2 delete "$BACKEND_SERVICE_NAME" 2>/dev/null || true
pm2 delete "$BOT_SERVICE_NAME" 2>/dev/null || true

# WebSocket server
pm2 start "$PROJECT_DEST_DIR/websocket/ws.js" \
    --interpreter "$NODE_PATH" \
    --name "$BACKEND_SERVICE_NAME" \
    --cwd "$PROJECT_DEST_DIR/websocket"

# Telegram auth bot
pm2 start "$PROJECT_DEST_DIR/webapp-v2/login/bot.js" \
    --interpreter "$NODE_PATH" \
    --name "$BOT_SERVICE_NAME" \
    --cwd "$PROJECT_DEST_DIR/webapp-v2/login"

pm2 save
pm2 startup -u root --hp /root 2>/dev/null || pm2 startup

log_info "PM2 services started"

# ==============================================================================
# Save installation config (for --update mode)
# ==============================================================================
mkdir -p /etc/mafboard
cat > "$CONFIG_FILE" <<CFGEOF
# MafBoard installation config — generated $(date +%Y-%m-%d)
DOMAIN="$DOMAIN"
PROJECT_DEST_DIR="$PROJECT_DEST_DIR"
DB_NAME="$DB_NAME"
DB_USER="$DB_USER"
DB_PASS="$DB_PASS"
DB_PORT="$DB_PORT"
BOT_TOKEN="$BOT_TOKEN"
BOT_USERNAME="$BOT_USERNAME"
ADMIN_TELEGRAM_ID="$ADMIN_TELEGRAM_ID"
LETSENCRYPT_EMAIL="$LETSENCRYPT_EMAIL"
GIT_REPO_URL="$GIT_REPO_URL"
CFGEOF
chmod 600 "$CONFIG_FILE"

# ==============================================================================
# DONE
# ==============================================================================
echo ""
echo -e "${CYAN}================================================================${NC}"
echo -e "${GREEN}${BOLD}       INSTALLATION COMPLETE!${NC}"
echo -e "${CYAN}================================================================${NC}"
echo ""
echo -e "  ${BOLD}Site:${NC}            ${GREEN}https://$DOMAIN${NC}"
echo -e "  ${BOLD}Admin panel:${NC}     ${GREEN}https://$DOMAIN/admin/${NC}"
echo ""
echo -e "  ${BOLD}Database:${NC}        ${GREEN}$DB_NAME${NC}"
echo -e "  ${BOLD}DB user:${NC}         ${GREEN}$DB_USER${NC}"
echo -e "  ${BOLD}DB password:${NC}     ${GREEN}$DB_PASS${NC}"
echo ""
echo -e "  ${BOLD}Telegram bot:${NC}    ${GREEN}@$BOT_USERNAME${NC}"
echo -e "  ${BOLD}Admin TG ID:${NC}     ${GREEN}$ADMIN_TELEGRAM_ID${NC}"
echo ""
echo -e "  ${YELLOW}PM2 Services:${NC}"
echo -e "    - ${CYAN}$BACKEND_SERVICE_NAME${NC} — WebSocket server (port $BACKEND_PORT)"
echo -e "    - ${CYAN}$BOT_SERVICE_NAME${NC} — Telegram auth bot"
echo ""
echo -e "  ${YELLOW}Useful commands:${NC}"
echo -e "    pm2 status                          — service status"
echo -e "    pm2 logs                            — all logs"
echo -e "    pm2 logs $BACKEND_SERVICE_NAME      — WebSocket logs"
echo -e "    pm2 logs $BOT_SERVICE_NAME          — Bot logs"
echo -e "    pm2 restart all                     — restart services"
echo -e "    sudo bash install.sh --update       — update from Git"
echo -e "    sudo bash uninstall.sh              — uninstall"
echo ""
echo -e "  ${YELLOW}Config saved to:${NC} $CONFIG_FILE"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo -e "    1. Set your Telegram bot's Web App URL to ${GREEN}https://$DOMAIN${NC}"
echo -e "       (BotFather → /mybots → your bot → Bot Settings → Menu Button)"
echo -e "    2. Test auth: open ${GREEN}https://$DOMAIN${NC} in Telegram"
echo -e "    3. Check logs: ${CYAN}pm2 logs${NC}"
echo ""
echo -e "${CYAN}================================================================${NC}"
