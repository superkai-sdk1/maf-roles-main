#!/bin/bash

# ==============================================================================
# СКРИПТ УСТАНОВКИ MafBoard (v12)
# Включает: Nginx, PHP + MySQL, Node.js (через NVM), PM2, Certbot (SSL),
#            Telegram-бот авторизации, база данных, автоматическая миграция
# ==============================================================================

set -e

# --- Цвета ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# --- Переменные по умолчанию ---
PROJECT_SOURCE_DIR=$(pwd)
FRONTEND_DIR_NAME="webapp"
BACKEND_DIR_NAME="websocket"
BOT_DIR_NAME="webapp/login"
BACKEND_SCRIPT_NAME="ws.js"
BACKEND_PORT="8081"
BACKEND_SERVICE_NAME="mafboard-websocket"
BOT_SERVICE_NAME="mafboard-auth-bot"
NODE_VERSION="20"
PHP_VERSION="8.2"

# --- Проверяем, что скрипт запущен с правами sudo ---
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Ошибка: Пожалуйста, запустите этот скрипт с правами sudo: sudo bash install.sh${NC}"
    exit 1
fi

# ==============================================================================
# ИНТЕРАКТИВНЫЙ ВВОД ПАРАМЕТРОВ
# ==============================================================================
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}       MafBoard — Установка                                ${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# Домен
read -p "Введите доменное имя (например: titanmafia.pro): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Ошибка: Домен не может быть пустым.${NC}"
    exit 1
fi

# MySQL
echo ""
echo -e "${YELLOW}--- Настройка MySQL ---${NC}"
read -p "Имя базы данных [webrarium_mafia]: " DB_NAME
DB_NAME=${DB_NAME:-webrarium_mafia}

read -p "Имя пользователя MySQL [maf_user]: " DB_USER
DB_USER=${DB_USER:-maf_user}

read -s -p "Пароль пользователя MySQL: " DB_PASS
echo ""
if [ -z "$DB_PASS" ]; then
    DB_PASS=$(openssl rand -base64 16)
    echo -e "${YELLOW}Сгенерирован случайный пароль: ${DB_PASS}${NC}"
fi

read -p "Порт MySQL [3306]: " DB_PORT
DB_PORT=${DB_PORT:-3306}

# Telegram бот
echo ""
echo -e "${YELLOW}--- Настройка Telegram бота ---${NC}"
read -p "Токен Telegram бота (от @BotFather): " BOT_TOKEN
if [ -z "$BOT_TOKEN" ]; then
    echo -e "${RED}Ошибка: Токен бота обязателен.${NC}"
    exit 1
fi

read -p "Username бота без @ (например: maf_roles_auth_bot): " BOT_USERNAME
if [ -z "$BOT_USERNAME" ]; then
    echo -e "${RED}Ошибка: Username бота обязателен.${NC}"
    exit 1
fi

# Итог
PROJECT_DEST_DIR="/var/www/$DOMAIN"
LETSENCRYPT_EMAIL="admin@$DOMAIN"

echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "Домен:           ${GREEN}$DOMAIN${NC}"
echo -e "Путь установки:  ${GREEN}$PROJECT_DEST_DIR${NC}"
echo -e "БД:              ${GREEN}$DB_NAME${NC} (пользователь: ${GREEN}$DB_USER${NC})"
echo -e "Telegram бот:    ${GREEN}@$BOT_USERNAME${NC}"
echo -e "${CYAN}============================================================${NC}"
read -p "Всё верно? Начать установку? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Установка отменена."
    exit 0
fi

# ==============================================================================
# ШАГ 1: Установка системных зависимостей
# ==============================================================================
echo ""
echo -e "${GREEN}--- Шаг 1/8: Установка системных зависимостей ---${NC}"
apt-get update
apt-get install -y curl software-properties-common
add-apt-repository -y ppa:ondrej/php
apt-get update
apt-get install -y \
    nginx \
    python3-certbot-nginx \
    "php${PHP_VERSION}-fpm" \
    "php${PHP_VERSION}-mysql" \
    "php${PHP_VERSION}-curl" \
    mysql-server

# Убедимся что MySQL запущен
systemctl enable mysql
systemctl start mysql

# Убедимся что PHP-FPM запущен
systemctl enable "php${PHP_VERSION}-fpm"
systemctl start "php${PHP_VERSION}-fpm"

# ==============================================================================
# ШАГ 2: Настройка MySQL — БД, пользователь, таблицы
# ==============================================================================
echo ""
echo -e "${GREEN}--- Шаг 2/8: Настройка MySQL ---${NC}"

# Создаём базу данных и пользователя
mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"
echo -e "${GREEN}База данных '${DB_NAME}' и пользователь '${DB_USER}' созданы.${NC}"

# Создаём таблицы
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
echo -e "${GREEN}Таблицы БД созданы.${NC}"

# ==============================================================================
# ШАГ 3: Копирование файлов проекта
# ==============================================================================
echo ""
echo -e "${GREEN}--- Шаг 3/8: Копирование файлов проекта ---${NC}"
mkdir -p "$PROJECT_DEST_DIR"
rsync -av --exclude='.git' --exclude='node_modules' "$PROJECT_SOURCE_DIR/" "$PROJECT_DEST_DIR/"

# ==============================================================================
# ШАГ 4: Настройка конфигурационных файлов
# ==============================================================================
echo ""
echo -e "${GREEN}--- Шаг 4/8: Настройка конфигурации ---${NC}"

# --- db.php ---
cat > "$PROJECT_DEST_DIR/$FRONTEND_DIR_NAME/api/db.php" <<PHPEOF
<?php

require  'medoo.php';
use Medoo\Medoo;

\$database = new Medoo(array(
	'database_type' => 'mysql',
	'database_name' => '${DB_NAME}',
	'server' => 'localhost',
	'username' => '${DB_USER}',
	'password' => '${DB_PASS}',
	'charset' => 'utf8',
	'port' => ${DB_PORT},
	'prefix' => '',
	'error' => PDO::ERRMODE_EXCEPTION,
));

\$TABLE_PLAYERS = 'players';
PHPEOF

# --- auth-config.php ---
cat > "$PROJECT_DEST_DIR/$FRONTEND_DIR_NAME/login/auth-config.php" <<AUTHEOF
<?php
// =====================================================
// Auth Configuration
// =====================================================

define('BOT_TOKEN', '${BOT_TOKEN}');
define('BOT_USERNAME', '${BOT_USERNAME}');
define('SESSION_TTL_DAYS', 30);
define('CODE_TTL_SECONDS', 300);
define('CODE_POLL_INTERVAL_MS', 2500);
AUTHEOF

# --- bot.js: подставляем URL и токен ---
sed -i "s|const BOT_TOKEN = process.env.BOT_TOKEN || '.*';|const BOT_TOKEN = process.env.BOT_TOKEN || '${BOT_TOKEN}';|g" \
    "$PROJECT_DEST_DIR/$FRONTEND_DIR_NAME/login/bot.js"
sed -i "s|const CONFIRM_API_URL = process.env.CONFIRM_API_URL || '.*';|const CONFIRM_API_URL = process.env.CONFIRM_API_URL || 'https://${DOMAIN}/login/code-confirm.php';|g" \
    "$PROJECT_DEST_DIR/$FRONTEND_DIR_NAME/login/bot.js"

echo -e "${GREEN}Конфигурация настроена.${NC}"

# --- Права на файлы ---
chown -R www-data:www-data "$PROJECT_DEST_DIR"
chmod -R 755 "$PROJECT_DEST_DIR"

# ==============================================================================
# ШАГ 5: Установка Node.js
# ==============================================================================
echo ""
echo -e "${GREEN}--- Шаг 5/8: Установка Node.js v$NODE_VERSION ---${NC}"
export NVM_DIR="/root/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    mkdir -p "$NVM_DIR"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
. "$NVM_DIR/nvm.sh"
nvm install $NODE_VERSION
nvm use $NODE_VERSION
NODE_PATH=$(which node)
echo "Node.js: $NODE_PATH"

# Установка зависимостей WebSocket сервера
cd "$PROJECT_DEST_DIR/$BACKEND_DIR_NAME"
npm install

# Установка зависимостей Telegram бота
cd "$PROJECT_DEST_DIR/$BOT_DIR_NAME"
npm install

cd "$PROJECT_DEST_DIR"

# ==============================================================================
# ШАГ 6: Настройка Nginx и SSL
# ==============================================================================
echo ""
echo -e "${GREEN}--- Шаг 6/8: Настройка Nginx и SSL ---${NC}"

# Временная конфигурация для получения SSL
cat <<EOF > "/etc/nginx/sites-available/$DOMAIN"
server {
    listen 80;
    server_name $DOMAIN;
    root $PROJECT_DEST_DIR/$FRONTEND_DIR_NAME;
    location /.well-known/acme-challenge/ { allow all; }
    location / { return 301 https://\$host\$request_uri; }
}
EOF
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/"
rm -f /etc/nginx/sites-enabled/default
systemctl reload nginx

# Получение SSL-сертификата
certbot --nginx --agree-tos --redirect --non-interactive -m "$LETSENCRYPT_EMAIL" -d "$DOMAIN"

# Финальная конфигурация Nginx
cat <<EOF > "/etc/nginx/sites-available/$DOMAIN"
server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root $PROJECT_DEST_DIR/$FRONTEND_DIR_NAME;
    index index.html index.htm;

    # MPA — ищет файл, потом папку, потом .html, иначе 404
    location / {
        try_files \$uri \$uri/ \$uri.html =404;
    }

    # PHP (API + авторизация)
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php${PHP_VERSION}-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
    }

    # WebSocket (Node.js)
    location /bridge {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}

server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}
EOF
systemctl reload nginx

# ==============================================================================
# ШАГ 7: Настройка брандмауэра
# ==============================================================================
echo ""
echo -e "${GREEN}--- Шаг 7/8: Настройка брандмауэра ---${NC}"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ==============================================================================
# ШАГ 8: Запуск сервисов через PM2
# ==============================================================================
echo ""
echo -e "${GREEN}--- Шаг 8/8: Запуск сервисов через PM2 ---${NC}"
. "$NVM_DIR/nvm.sh"
npm install pm2 -g

# WebSocket сервер
pm2 delete "$BACKEND_SERVICE_NAME" 2>/dev/null || true
pm2 start "$PROJECT_DEST_DIR/$BACKEND_DIR_NAME/$BACKEND_SCRIPT_NAME" \
    --interpreter "$NODE_PATH" \
    --name "$BACKEND_SERVICE_NAME"

# Telegram бот авторизации
pm2 delete "$BOT_SERVICE_NAME" 2>/dev/null || true
pm2 start "$PROJECT_DEST_DIR/$BOT_DIR_NAME/bot.js" \
    --interpreter "$NODE_PATH" \
    --name "$BOT_SERVICE_NAME"

pm2 save
pm2 startup

# ==============================================================================
# ГОТОВО
# ==============================================================================
echo ""
echo -e "${CYAN}================================================================${NC}"
echo -e "${GREEN}       УСТАНОВКА УСПЕШНО ЗАВЕРШЕНА!${NC}"
echo -e "${CYAN}================================================================${NC}"
echo ""
echo -e "  Сайт:         ${GREEN}https://$DOMAIN${NC}"
echo -e "  База данных:  ${GREEN}$DB_NAME${NC}"
echo -e "  DB юзер:      ${GREEN}$DB_USER${NC}"
echo -e "  DB пароль:    ${GREEN}$DB_PASS${NC}"
echo -e "  Telegram бот: ${GREEN}@$BOT_USERNAME${NC}"
echo ""
echo -e "  ${YELLOW}Сервисы PM2:${NC}"
echo -e "    - ${CYAN}$BACKEND_SERVICE_NAME${NC} — WebSocket сервер"
echo -e "    - ${CYAN}$BOT_SERVICE_NAME${NC} — Telegram бот авторизации"
echo ""
echo -e "  ${YELLOW}Команды управления:${NC}"
echo -e "    pm2 status              — статус сервисов"
echo -e "    pm2 logs                — логи всех сервисов"
echo -e "    pm2 restart all         — перезапуск"
echo -e "    sudo bash uninstall.sh  — удаление"
echo ""
echo -e "${CYAN}================================================================${NC}"

