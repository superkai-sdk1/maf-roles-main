#!/bin/bash

# ==============================================================================
# ФИНАЛЬНЫЙ СКРИПТ УСТАНОВКИ (v11 - MPA)
# Включает: Nginx, PHP, Node.js (через NVM), PM2, Certbot (SSL)
# ==============================================================================

set -e

# --- Переменные ---
DOMAIN="minahor.ru"
PROJECT_SOURCE_DIR=$(pwd)
PROJECT_DEST_DIR="/var/www/$DOMAIN"
FRONTEND_DIR_NAME="webapp"
BACKEND_DIR_NAME="websocket"
BACKEND_SCRIPT_NAME="ws.js"
BACKEND_PORT="8081"
BACKEND_SERVICE_NAME="maf-roles-websocket"
NODE_VERSION="20"
PHP_VERSION="8.2"
LETSENCRYPT_EMAIL="admin@$DOMAIN"

# --- Проверяем, что скрипт запущен с правами sudo ---
if [ "$EUID" -ne 0 ]; then
  echo "Ошибка: Пожалуйста, запустите этот скрипт с правами sudo: sudo bash install.sh"
  exit 1
fi

# --- 1. Установка зависимостей ---
echo "--- Шаг 1/5: Установка системных зависимостей ---"
apt-get update
apt-get install -y curl software-properties-common
add-apt-repository -y ppa:ondrej/php
apt-get update
apt-get install -y nginx python3-certbot-nginx "php${PHP_VERSION}-fpm"

# --- 2. Копирование файлов и установка прав ---
echo "--- Шаг 2/5: Копирование файлов проекта в $PROJECT_DEST_DIR ---"
mkdir -p "$PROJECT_DEST_DIR"
rsync -av --exclude='.git' "$PROJECT_SOURCE_DIR/" "$PROJECT_DEST_DIR/"
chown -R www-data:www-data "$PROJECT_DEST_DIR"
chmod -R 755 "$PROJECT_DEST_DIR"

# --- 3. Установка Node.js ---
echo "--- Шаг 3/5: Установка Node.js v$NODE_VERSION ---"
export NVM_DIR="/root/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    mkdir -p "$NVM_DIR"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
. "$NVM_DIR/nvm.sh"
nvm install $NODE_VERSION
nvm use $NODE_VERSION
NODE_PATH=$(which node)
echo "Node.js будет запущен из: $NODE_PATH"
cd "$PROJECT_DEST_DIR/$BACKEND_DIR_NAME"
npm install
cd "$PROJECT_DEST_DIR"

# --- 4. Настройка Nginx ---
echo "--- Шаг 4/5: Настройка Nginx, PHP и SSL ---"
# Создаем финальную конфигурацию Nginx
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
certbot --nginx --agree-tos --redirect --non-interactive -m "$LETSENCRYPT_EMAIL" -d "$DOMAIN"

# **КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ:** Финальная конфигурация для многостраничного приложения (MPA)
cat <<EOF > "/etc/nginx/sites-available/$DOMAIN"
server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # **ЕДИНАЯ КОРНЕВАЯ ПАПКА**
    root $PROJECT_DEST_DIR/$FRONTEND_DIR_NAME;
    index index.html index.htm;

    # **ПРАВИЛЬНАЯ ОБРАБОТКА MPA**
    # Ищет файл, потом папку, потом файл с .html, иначе 404
    location / {
        try_files \$uri \$uri/ \$uri.html =404;
    }

    # Обработка PHP-скриптов (API)
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php${PHP_VERSION}-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
    }

    # Обработка WebSocket (Node.js)
    location /bridge {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
systemctl reload nginx
# --- 5. Запуск Node.js сервера ---
echo "--- Шаг 5/5: Запуск Node.js сервера через PM2 ---"
npm install pm2 -g
pm2 delete "$BACKEND_SERVICE_NAME" || true
pm2 start "$PROJECT_DEST_DIR/$BACKEND_DIR_NAME/$BACKEND_SCRIPT_NAME" --interpreter "$NODE_PATH" --name "$BACKEND_SERVICE_NAME"
pm2 save
pm2 startup

echo "================================================================"
echo "УСТАНОВКА УСПЕШНО ЗАВЕРШЕНА!"
echo "Сайт должен быть доступен по адресу: https://$DOMAIN"
echo "================================================================"