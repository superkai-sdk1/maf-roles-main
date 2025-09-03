#!/bin/bash

# ==============================================================================
# СКРИПТ УСТАНОВКИ ВЕБ-ПРИЛОЖЕНИЯ И WEBSOCKET-СЕРВЕРА (v7 - Исправление прав)
# ==============================================================================

set -e

# --- Переменные, которые можно менять ---
DOMAIN="minahor.ru"
PROJECT_SOURCE_DIR="/root/maf-roles-main" # Откуда копировать проект
PROJECT_DEST_DIR="/var/www/minahor.ru"   # Куда развернуть проект
FRONTEND_DIR_NAME="webapp"
BACKEND_SCRIPT_NAME="ws.js"
NODE_VERSION="20"
WEBSOCKET_PORT=8081 # Порт из логов вашего приложения

# --- Проверяем, что скрипт запущен с правами sudo ---
if [ "$EUID" -ne 0 ]; then
  echo "Ошибка: Пожалуйста, запустите этот скрипт с правами sudo: sudo bash install.sh"
  exit 1
fi

# --- 1. Установка системных зависимостей ---
echo "--- Шаг 1/5: Установка Nginx и rsync ---"
apt-get update
apt-get install -y nginx curl rsync

# --- 2. Создание директории и копирование проекта ---
echo "--- Шаг 2/5: Копирование файлов проекта в $PROJECT_DEST_DIR ---"
mkdir -p "$PROJECT_DEST_DIR"
rsync -a --delete "$PROJECT_SOURCE_DIR/" "$PROJECT_DEST_DIR/"

# --- 3. Установка Node.js и зависимостей ---
echo "--- Шаг 3/5: Установка Node.js и зависимостей сервера ---"
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    mkdir -p "$NVM_DIR"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
. "$NVM_DIR/nvm.sh"
nvm install $NODE_VERSION
nvm use $NODE_VERSION
nvm alias default $NODE_VERSION

# Устанавливаем зависимости в новой директории
cd "$PROJECT_DEST_DIR/$FRONTEND_DIR_NAME/.." # Переходим в корень проекта
cd websocket
npm install

# --- 4. Настройка и запуск сервера через PM2 ---
echo "--- Шаг 4/5: Настройка и запуск сервера через pm2 ---"
npm install pm2 -g
pm2 delete "maf-roles-websocket" || true
# Запускаем скрипт из новой директории
pm2 start "$PROJECT_DEST_DIR/websocket/$BACKEND_SCRIPT_NAME" --name "maf-roles-websocket"
pm2 save
pm2 startup

# --- 5. Настройка Nginx и прав доступа ---
echo "--- Шаг 5/5: Настройка веб-сервера Nginx и прав доступа ---"
# Устанавливаем правильные права для Nginx
chown -R www-data:www-data "$PROJECT_DEST_DIR"
chmod -R 755 "$PROJECT_DEST_DIR"

NGINX_CONFIG="/etc/nginx/sites-available/$DOMAIN"
cat <<EOF > "$NGINX_CONFIG"
server {
    listen 80;
    server_name $DOMAIN;

    root $PROJECT_DEST_DIR/$FRONTEND_DIR_NAME;
    index index.html index.htm;

    location / {
        try_files \$uri /index.html;
    }

    location /socket.io/ {
        proxy_pass http://localhost:$WEBSOCKET_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf "$NGINX_CONFIG" "/etc/nginx/sites-enabled/"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "================================================================"
echo "УСТАНОВКА УСПЕШНО ЗАВЕРШЕНА!"
echo "Сайт должен быть доступен по адресу: http://$DOMAIN"
echo "================================================================"
