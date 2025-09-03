#!/bin/bash

# ==============================================================================
# СКРИПТ УСТАНОВКИ ВЕБ-ПРИЛОЖЕНИЯ И WEBSOCKET-СЕРВЕРА (v4)
# ==============================================================================

# --- Останавливаем скрипт при любой ошибке ---
set -e

# --- Имя папки с файлами фронтенда ---
FRONTEND_DIR_NAME="webapp"

# ------------------------------------------------------------------------------
# --- Переменные проекта ---
# ------------------------------------------------------------------------------
PROJECT_DIR=$(pwd)
FRONTEND_DIR="$PROJECT_DIR/$FRONTEND_DIR_NAME"
BACKEND_DIR="$PROJECT_DIR/websocket"
BACKEND_SERVICE_NAME="maf-roles-websocket"
NODE_VERSION="20"

# --- Проверяем, что скрипт запущен с правами sudo ---
if [ "$EUID" -ne 0 ]; then
  echo "Ошибка: Пожалуйста, запустите этот скрипт с правами sudo: sudo bash install.sh"
  exit 1
fi

# --- Переходим в директорию скрипта ---
cd "$(dirname "$0")" || exit

# --- Проверяем существование директорий ---
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "Ошибка: Директория фронтенда '$FRONTEND_DIR' не найдена!"
    exit 1
fi
if [ ! -d "$BACKEND_DIR" ]; then
    echo "Ошибка: Директория бекенда '$BACKEND_DIR' не найдена!"
    exit 1
fi

# --- Запрос домена ---
read -p "Введите ваш домен (например, example.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo "Домен не может быть пустым. Прерывание."
    exit 1
fi

# --- 1. Установка системных зависимостей ---
echo "--- Шаг 1/4: Установка Nginx и curl ---"
apt-get update
apt-get install -y nginx curl

# --- 2. Установка Node.js и зависимостей ---
echo "--- Шаг 2/4: Установка Node.js и зависимостей сервера ---"

# Устанавливаем и загружаем NVM в окружение скрипта
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    # Создаем директорию, если ее нет
    mkdir -p "$NVM_DIR"
    # Скачиваем nvm
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

# **КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ:** Загружаем nvm в текущую сессию
\. "$NVM_DIR/nvm.sh"

# Устанавливаем Node.js
nvm install $NODE_VERSION
nvm use $NODE_VERSION
nvm alias default $NODE_VERSION

# Устанавливаем зависимости бекенда
cd "$BACKEND_DIR"
npm install
cd "$PROJECT_DIR"

# --- 3. Установка и запуск Бекенда через PM2 ---
echo "--- Шаг 3/4: Настройка и запуск сервера через pm2 ---"
npm install pm2 -g
pm2 delete "$BACKEND_SERVICE_NAME" || true
pm2 start "$BACKEND_DIR/server.js" --name "$BACKEND_SERVICE_NAME"
pm2 save
STARTUP_COMMAND=$(pm2 startup | tail -n 1)

# --- 4. Настройка Nginx ---
echo "--- Шаг 4/4: Настройка веб-сервера Nginx ---"
NGINX_CONFIG="/etc/nginx/sites-available/$DOMAIN"

cat <<EOF > "$NGINX_CONFIG"
server {
    listen 80;
    server_name $DOMAIN;

    root $FRONTEND_DIR;
    index index.html index.htm;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# --- Активация конфигурации и перезапуск Nginx ---
ln -sf "$NGINX_CONFIG" "/etc/nginx/sites-enabled/"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# --- Финальное сообщение ---
echo "================================================================"
echo "УСТАНОВКА УСПЕШНО ЗАВЕРШЕНА!"
echo "Сайт должен быть доступен по адресу: http://$DOMAIN"
echo ""
echo "!!! ВАЖНОЕ ДЕЙСТВИЕ !!!"
echo "Для настройки автозапуска сервера после перезагрузки, выполните следующую команду:"
echo "$STARTUP_COMMAND"
echo "================================================================"