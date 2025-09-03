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
WS_ROOT="/var/www/ws-$DOMAIN" # Отдельная папка для вебсокета для безопасности
WS_SERVICE_NAME="maf-bridge-$DOMAIN"

# --- Начало установки ---

# 1. Проверка прав суперпользователя
if [ "$EUID" -ne 0 ]; then
  echo "Пожалуйста, запустите этот скрипт с правами суперпользователя (sudo bash install.sh)"
  exit 1
fi

echo -e "${GREEN}Шаг 1: Обновление системы и установка базовых зависимостей...${NC}"
apt update && apt upgrade -y
# Устанавливаем curl и другие нужные пакеты. Node.js установим отдельно.
apt install -y nginx php-fpm php-curl certbot python3-certbot-nginx curl

echo -e "${GREEN}Шаг 1.1: Очистка старых версий Node.js...${NC}"
# Принудительно удаляем старые и конфликтующие пакеты перед установкой.
# Игнорируем ошибки, если пакеты не установлены.
apt-get remove -y nodejs libnode-dev npm || true
apt-get autoremove -y || true

echo -e "${GREEN}Шаг 1.2: Установка Node.js v16...${NC}"
# Используем официальный скрипт NodeSource для установки Node.js 16.x
# Это гарантирует, что pm2 будет использовать современную версию
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
# Используем --force-overwrite для решения конфликтов dpkg
apt-get install -y -o Dpkg::Options::="--force-overwrite" nodejs


echo -e "${GREEN}Шаг 2: Настройка брандмауэра (UFW)...${NC}"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo -e "${GREEN}Шаг 3: Создание структуры папок и копирование файлов...${NC}"
mkdir -p $WEB_ROOT
mkdir -p $WS_ROOT

# Копируем файлы из папок проекта (скрипт должен запускаться из корня репозитория)
cp -r webapp/* $WEB_ROOT/
cp -r websocket/* $WS_ROOT/

# Установка прав
chown -R www-data:www-data $WEB_ROOT
chown -R www-data:www-data $WS_ROOT

echo -e "${GREEN}Шаг 4: Настройка Nginx...${NC}"

# Создаем отдельный файл для проксирования WebSocket
# Это более надежный способ, т.к. certbot корректно обработает include
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

# Создаем основной конфигурационный файл Nginx
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
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock; # Для Ubuntu 22.04, может отличаться
    }

    # Подключаем конфигурацию для WebSocket
    include snippets/websocket-proxy.conf;
}
EOF

# Активация конфига
ln -s -f /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
# Удаляем конфиг по умолчанию, если он есть
rm -f /etc/nginx/sites-enabled/default

echo "Проверка конфигурации Nginx и перезапуск..."
nginx -t
systemctl restart nginx

echo -e "${GREEN}Шаг 5: Настройка и запуск WebSocket сервера...${NC}"
cd $WS_ROOT
# Устанавливаем зависимости из package.json
npm install

# Устанавливаем и запускаем через PM2
npm install -g pm2
pm2 start ws.js --name "$WS_SERVICE_NAME"
pm2 save
pm2 startup

echo -e "${GREEN}Шаг 6: Получение SSL-сертификата от Let's Encrypt...${NC}"
# --non-interactive - для автоматического запуска
# --agree-tos - согласие с условиями
# -m - email для уведомлений
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m "admin@$DOMAIN" --redirect

echo -e "${GREEN}Установка завершена!${NC}"
echo "Ваше веб-приложение доступно по адресу: https://$DOMAIN"
echo "WebSocket сервер запущен и работает в фоновом режиме."
