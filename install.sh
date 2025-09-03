#!/bin/bash

# --- Останавливаем скрипт при любой ошибке ---
set -e

# --- Проверяем, что скрипт запущен с правами sudo ---
if [ "$EUID" -ne 0 ]; then
  echo "Пожалуйста, запустите этот скрипт с правами sudo: sudo bash install.sh"
  exit 1
fi

# --- Переходим в директорию скрипта, чтобы все пути были правильными ---
cd "$(dirname "$0")" || exit

# --- Переменные проекта ---
PROJECT_DIR=$(pwd)
FRONTEND_DIR="$PROJECT_DIR/maf-roles-main-front" # Укажите правильную папку с фронтендом
BACKEND_DIR="$PROJECT_DIR/websocket"
BACKEND_SERVICE_NAME="maf-roles-websocket"
NODE_VERSION="20"

# --- Запрос домена ---
read -p "Введите ваш домен (например, example.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo "Домен не может быть пустым. Прерывание."
    exit 1
fi

# --- 1. Установка системных зависимостей (Nginx) ---
echo "--- Установка Nginx и curl ---"
apt-get update
apt-get install -y nginx curl

# --- 2. Установка NVM и Node.js ---
echo "--- Установка nvm и Node.js v$NODE_VERSION ---"
# Устанавливаем от имени обычного пользователя, если он есть, иначе от root
USER_TO_RUN_NVM=$(logname)
sudo -u "$USER_TO_RUN_NVM" bash -c "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
sudo -u "$USER_TO_RUN_NVM" bash -c "source ~/.nvm/nvm.sh && nvm install $NODE_VERSION && nvm alias default $NODE_VERSION"

# --- Экспорт путей для текущей сессии root ---
export NVM_DIR="/home/$USER_TO_RUN_NVM/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# --- 3. Сборка Фронтенда ---
echo "--- Сборка фронтенд-приложения ---"
cd "$FRONTEND_DIR" || { echo "Ошибка: не найдена директория фронтенда $FRONTEND_DIR"; exit 1; }
npm install
npm run build
cd "$PROJECT_DIR"

# --- 4. Установка зависимостей и запуск Бекенда ---
echo "--- Установка зависимостей бекенда ---"
cd "$BACKEND_DIR" || { echo "Ошибка: не найдена директория бекенда $BACKEND_DIR"; exit 1; }
npm install
cd "$PROJECT_DIR"

echo "--- Установка и настройка pm2 ---"
npm install pm2 -g
pm2 delete "$BACKEND_SERVICE_NAME" || true
# Запускаем сервер из его директории
pm2 start "$BACKEND_DIR/server.js" --name "$BACKEND_SERVICE_NAME"
pm2 save
pm2 startup

# --- 5. Настройка Nginx ---
echo "--- Настройка Nginx ---"
NGINX_CONFIG="/etc/nginx/sites-available/$DOMAIN"

cat <<EOF > "$NGINX_CONFIG"
server {
    listen 80;
    server_name $DOMAIN;

    # Корень сайта - собранный фронтенд
    root $FRONTEND_DIR/build;
    index index.html index.htm;

    # Отдаем статику
    location / {
        try_files \$uri /index.html;
    }

    # Прокси для веб-сокета
    location /socket.io/ {
        proxy_pass http://localhost:3000; # Убедитесь, что порт совпадает с портом в websocket/server.js
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# --- Активация конфигурации ---
ln -sf "$NGINX_CONFIG" "/etc/nginx/sites-enabled/"
# Удаляем дефолтный конфиг, если он есть
rm -f /etc/nginx/sites-enabled/default

# --- Проверка и перезапуск Nginx ---
nginx -t
systemctl reload nginx

echo "----------------------------------------------------------------"
echo "УСТАНОВКА УСПЕШНО ЗАВЕРШЕНА!"
echo "Ваш сайт должен быть доступен по адресу: http://$DOMAIN"
echo "Для завершения настройки автозапуска pm2, выполните команду, которую он вывел выше."
echo "----------------------------------------------------------------"