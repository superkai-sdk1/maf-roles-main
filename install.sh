#!/bin/bash

# ==============================================================================
# СКРИПТ УСТАНОВКИ С SSL (HTTPS) (v7 - Финальная версия)
# ==============================================================================

set -e

# --- Переменные ---
DOMAIN="minahor.ru"
PROJECT_SOURCE_DIR=$(pwd)
PROJECT_DEST_DIR="/var/www/$DOMAIN"
FRONTEND_DIR_NAME="webapp"
BACKEND_DIR_NAME="websocket"
BACKEND_SCRIPT_NAME="ws.js"
BACKEND_PORT="8081" # Порт из ваших логов
BACKEND_SERVICE_NAME="maf-roles-websocket"
NODE_VERSION="20"
LETSENCRYPT_EMAIL="admin@$DOMAIN" # Email для уведомлений от Let's Encrypt

# --- Проверяем, что скрипт запущен с правами sudo ---
if [ "$EUID" -ne 0 ]; then
  echo "Ошибка: Пожалуйста, запустите этот скрипт с правами sudo: sudo bash install.sh"
  exit 1
fi

# --- 1. Установка зависимостей ---
echo "--- Шаг 1/5: Установка Nginx, Certbot и других утилит ---"
apt-get update
apt-get install -y nginx curl python3-certbot-nginx

# --- 2. Копирование файлов и установка прав ---
echo "--- Шаг 2/5: Копирование файлов проекта в $PROJECT_DEST_DIR ---"
mkdir -p "$PROJECT_DEST_DIR"
# Копируем все, кроме .git
rsync -av --exclude='.git' "$PROJECT_SOURCE_DIR/" "$PROJECT_DEST_DIR/"
# Устанавливаем правильные права доступа, чтобы Nginx мог читать файлы
chown -R www-data:www-data "$PROJECT_DEST_DIR"
chmod -R 755 "$PROJECT_DEST_DIR"

# --- 3. Установка Node.js и зависимостей бекенда ---
echo "--- Шаг 3/5: Установка Node.js и зависимостей сервера ---"
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    mkdir -p "$NVM_DIR"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
. "$NVM_DIR/nvm.sh"
nvm install $NODE_VERSION
nvm use $NODE_VERSION
# Устанавливаем зависимости от имени пользователя www-data для безопасности
cd "$PROJECT_DEST_DIR/$BACKEND_DIR_NAME"
npm install
cd "$PROJECT_DEST_DIR"

# --- 4. Настройка Nginx и получение SSL-сертификата ---
echo "--- Шаг 4/5: Настройка Nginx и получение SSL-сертификата ---"
# Создаем финальную конфигурацию Nginx
cat <<EOF > "/etc/nginx/sites-available/$DOMAIN"
server {
    listen 80;
    server_name $DOMAIN;
    root $PROJECT_DEST_DIR/$FRONTEND_DIR_NAME;
    index index.html;
    location / {
        try_files \$uri /index.html;
    }
}
EOF
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/"
rm -f /etc/nginx/sites-enabled/default
systemctl reload nginx

# Получаем сертификат
certbot --nginx --agree-tos --redirect --non-interactive -m "$LETSENCRYPT_EMAIL" -d "$DOMAIN"

# Перезаписываем конфиг еще раз, чтобы добавить WebSocket proxy
cat <<EOF > "/etc/nginx/sites-available/$DOMAIN"
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}
server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root $PROJECT_DEST_DIR/$FRONTEND_DIR_NAME;
    index index.html;

    location / {
        try_files \$uri /index.html;
    }

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

# --- 5. Запуск сервера через PM2 ---
echo "--- Шаг 5/5: Запуск сервера через PM2 ---"
npm install pm2 -g
pm2 delete "$BACKEND_SERVICE_NAME" || true
# Запускаем от имени www-data для безопасности
pm2 start "$PROJECT_DEST_DIR/$BACKEND_DIR_NAME/$BACKEND_SCRIPT_NAME" --name "$BACKEND_SERVICE_NAME" --user www-data
pm2 save
pm2 startup

echo "================================================================"
echo "УСТАНОВКА УСПЕШНО ЗАВЕРШЕНА!"
echo "Сайт должен быть доступен по адресу: https://$DOMAIN"
echo "================================================================"