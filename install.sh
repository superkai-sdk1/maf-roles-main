#!/bin/bash

# ==============================================================================
# СКРИПТ УСТАНОВКИ ВЕБ-ПРИЛОЖЕНИЯ И WEBSOCKET-СЕРВЕРА
# ==============================================================================

# --- Останавливаем скрипт при любой ошибке для предсказуемости ---
set -e

# ---
# !!! ВАЖНО: УКАЖИТЕ ПРАВИЛЬНОЕ ИМЯ ПАПКИ С ФРОНТЕНДОМ !!!
# ---
FRONTEND_DIR_NAME="maf-roles-main-front"

# ------------------------------------------------------------------------------
# --- Переменные проекта (обычно не требуют изменений) ---
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

# --- Переходим в директорию скрипта, чтобы все пути были правильными ---
cd "$(dirname "$0")" || exit

# --- Проверяем существование директорий ---
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "Ошибка: Директория фронтенда '$FRONTEND_DIR' не найдена!"
    echo "Пожалуйста, проверьте переменную FRONTEND_DIR_NAME в начале скрипта."
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
echo "--- Шаг 1/5: Установка Nginx и других утилит ---"
apt-get update
apt-get install -y nginx curl

# --- 2. Установка NVM и Node.js ---
echo "--- Шаг 2/5: Установка Node.js через nvm ---"
USER_TO_RUN_NVM=$(logname)
sudo -u "$USER_TO_RUN_NVM" bash -c "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
sudo -u "$USER_TO_RUN_NVM" bash -c "source ~/.nvm/nvm.sh && nvm install $NODE_VERSION && nvm alias default $NODE_VERSION"

# --- Экспортируем пути nvm для текущей root-сессии, чтобы pm2 и npm работали ---
export NVM_DIR="/home/$USER_TO_RUN_NVM/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# --- 3. Сборка Фронтенда и установка Бекенда ---
echo "--- Шаг 3/5: Установка зависимостей и сборка проектов ---"
# Выполняем от имени пользователя, чтобы избежать проблем с правами
sudo -u "$USER_TO_RUN_NVM" bash -c "source ~/.nvm/nvm.sh && cd '$FRONTEND_DIR' && npm install && npm run build"
sudo -u "$USER_TO_RUN_NVM" bash -c "source ~/.nvm/nvm.sh && cd '$BACKEND_DIR' && npm install"

# --- 4. Установка и запуск Бекенда через PM2 ---
echo "--- Шаг 4/5: Настройка и запуск сервера через pm2 ---"
npm install pm2 -g
pm2 delete "$BACKEND_SERVICE_NAME" || true
pm2 start "$BACKEND_DIR/server.js" --name "$BACKEND_SERVICE_NAME"
pm2 save
STARTUP_COMMAND=$(pm2 startup | tail -n 1)

# --- 5. Настройка Nginx ---
echo "--- Шаг 5/5: Настройка веб-сервера Nginx ---"
NGINX_CONFIG="/etc/nginx/sites-available/$DOMAIN"

cat <<EOF > "$NGINX_CONFIG"
server {
    listen 80;
    server_name $DOMAIN;

    # Корень сайта - папка со собранным фронтендом
    root $FRONTEND_DIR/build;
    index index.html index.htm;

    # Правило для Single Page Application (SPA)
    location / {
        try_files \$uri /index.html;
    }

    # Правило для проксирования websocket-соединений на Node.js сервер
    location /socket.io/ {
        proxy_pass http://localhost:3000; # Убедитесь, что порт совпадает с портом бекенда
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