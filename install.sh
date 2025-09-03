#!/bin/bash

# Установочный скрипт для Maf-Roles-Panel
# Прекращает выполнение при любой ошибке
set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# --- Конфигурация ---
echo -e "${YELLOW}Добро пожаловать в установщик Maf Roles Panel!${NC}"
read -p "Пожалуйста, введите ваше доменное имя (например, minahor.ru): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "Доменное имя не может быть пустым. Выход."
    exit 1
fi

# Пути к директориям проекта
WEB_ROOT="/var/www/$DOMAIN"
WS_ROOT="/var/www/ws-$DOMAIN"
WS_SERVICE_NAME="maf-bridge-$DOMAIN"

# --- Начало установки ---

# 1. Проверка прав суперпользователя
if [ "$EUID" -ne 0 ]; then
  echo "Пожалуйста, запустите этот скрипт с правами суперпользователя (sudo bash install.sh)"
  exit 1
fi

echo -e "${GREEN}Шаг 1: Обновление системы и установка базовых зависимостей...${NC}"
apt update && apt upgrade -y
apt install -y nginx php-fpm php-curl certbot python3-certbot-nginx curl

# --- УСТАНОВКА NODE.JS ЧЕРЕЗ NVM (НОВЫЙ ПОДХОД) ---
echo -e "${GREEN}Шаг 2: Установка Node.js v20 через NVM (Node Version Manager)...${NC}"

# Устанавливаем NVM для текущего пользователя (root, так как скрипт под sudo)
# Используем -o- для вывода в stdout и | bash для выполнения
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Загружаем NVM в текущую сессию скрипта
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Проверяем, загрузился ли NVM
if ! command -v nvm &> /dev/null
then
    echo "NVM не смог установиться или загрузиться. Выход."
    exit 1
fi

# Устанавливаем последнюю LTS-версию Node.js (v20 на данный момент) и делаем ее версией по умолчанию
nvm install 20
nvm use 20
nvm alias default 20

echo "Установлена версия Node.js:"
node -v
echo "Установлена версия npm:"
npm -v

# --- КОНЕЦ БЛОКА NVM ---

echo -e "${GREEN}Шаг 3: Настройка брандмауэра (UFW)...${NC}"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo -e "${GREEN}Шаг 4: Создание структуры папок и копирование файлов...${NC}"
mkdir -p $WEB_ROOT
mkdir -p $WS_ROOT

cp -r webapp/* $WEB_ROOT/
cp -r websocket/* $WS_ROOT/

chown -R www-data:www-data $WEB_ROOT
chown -R www-data:www-data $WS_ROOT

echo -e "${GREEN}Шаг 5: Настройка Nginx...${NC}"
mkdir -p /etc/nginx/snippets/
cat <<EOF > /etc/nginx/snippets/websocket-proxy.conf
location /bridge {
    proxy_pass http://localhost:8081;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
}
EOF

cat <<EOF > /etc/nginx/sites-available/$DOMAIN
server {
    root $WEB_ROOT;
    index index.php panel.html index.html;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location ~ \.php\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
    }

    include snippets/websocket-proxy.conf;
}
EOF

ln -s -f /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

echo "Проверка конфигурации Nginx и перезапуск..."
nginx -t
systemctl restart nginx

echo -e "${GREEN}Шаг 6: Настройка и запуск WebSocket сервера с помощью PM2...${NC}"
cd $WS_ROOT
# Устанавливаем зависимости проекта
npm install

# Устанавливаем PM2 глобально для нашей версии Node.js
npm install -g pm2

# Запускаем приложение через PM2, явно указывая путь к интерпретатору Node.js
# Это гарантирует, что systemd-сервис, созданный pm2, будет использовать правильную версию
pm2 start ws.js --name "$WS_SERVICE_NAME" --interpreter="$NVM_DIR/versions/node/$(nvm current)/bin/node"

# Сохраняем список процессов и создаем стартап-скрипт
pm2 save
# Команда startup покажет, что нужно выполнить для автозапуска от имени root
pm2 startup

echo -e "${GREEN}Шаг 7: Получение SSL-сертификата от Let's Encrypt...${NC}"
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m "admin@$DOMAIN" --redirect

echo -e "${GREEN}Установка завершена!${NC}"
echo "Ваше веб-приложение доступно по адресу: https://$DOMAIN"
echo "WebSocket сервер запущен и работает в фоновом режиме."
