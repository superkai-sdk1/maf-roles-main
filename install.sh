#!/bin/bash

# ==============================================================================
# СКРИПТ УСТАНОВКИ С PHP И PPA (v10 - Финальная версия)
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

# --- 1. Установка зависимостей (включая PHP из PPA) ---
echo "--- Шаг 1/5: Добавление репозитория PHP и установка зависимостей ---"
apt-get update
# Устанавливаем утилиту для добавления репозиториев и добавляем PPA для PHP
apt-get install -y software-properties-common
add-apt-repository ppa:ondrej/php -y
# Обновляем список пакетов еще раз
apt-get update
# Теперь устанавливаем все зависимости
apt-get install -y nginx curl python3-certbot-nginx "php${PHP_VERSION}-fpm"

# --- 2. Копирование файлов и установка прав ---
echo "--- Шаг 2/5: Копирование файлов проекта в $PROJECT_DEST_DIR ---"
mkdir -p "$PROJECT_DEST_DIR"
rsync -av --exclude='.git' "$PROJECT_SOURCE_DIR/" "$PROJECT_DEST_DIR/"
chown -R www-data:www-data "$PROJECT_DEST_DIR"
chmod -R 755 "$PROJECT_DEST_DIR"

# --- 3. Установка Node.js и зависимостей бекенда ---
echo "--- Шаг 3/5: Установка Node.js v$NODE_VERSION и зависимостей сервера ---"
export NVM_DIR="/root/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    mkdir -p "$NVM_DIR"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
. "$NVM_DIR/nvm.sh"
nvm install $NODE_VERSION
nvm use $NODE_VERSION
NODE_PATH=$(which node)
echo "Будет использован Node.js по пути: $NODE_PATH"

# Устанавливаем зависимости
cd "$PROJECT_DEST_DIR/$BACKEND_DIR_NAME"
npm install
cd "$PROJECT_DEST_DIR"

# --- 4. Настройка Nginx с PHP и SSL ---
echo "--- Шаг 4/5: Настройка Nginx с PHP и получение SSL-сертификата ---"
# Создаем временный конфиг для получения сертификата
cat <<EOF > "/etc/nginx/sites-available/$DOMAIN"
server {
    listen 80;
    server_name $DOMAIN;
    root $PROJECT_DEST_DIR/$FRONTEND_DIR_NAME;
    index index.html;
    location / { try_files $uri /index.html; }
}
EOF
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/"
rm -f /etc/nginx/sites-enabled/default
systemctl reload nginx

# Получаем/обновляем сертификат
certbot --nginx --agree-tos --redirect --non-interactive -m "$LETSENCRYPT_EMAIL" -d "$DOMAIN"

# Создаем финальную конфигурацию Nginx с PHP
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

    root $PROJECT_DEST_DIR;
    index index.html index.htm index.php;

    location / {
        root $PROJECT_DEST_DIR/$FRONTEND_DIR_NAME;
        try_files \$uri /index.html;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php${PHP_VERSION}-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
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
