#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Скрипт удаления Maf Roles Panel${NC}"
read -p "Введите доменное имя удаляемого проекта: " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "Доменное имя не может быть пустым. Выход."
    exit 1
fi

if [ "$EUID" -ne 0 ]; then
  echo "Пожалуйста, запустите этот скрипт с правами суперпользователя (sudo bash uninstall.sh)"
  exit 1
fi

echo "Остановка и удаление WebSocket сервиса..."
pm2 stop "maf-bridge-$DOMAIN" || echo "Сервис уже остановлен."
pm2 delete "maf-bridge-$DOMAIN" || echo "Сервис уже удален."
pm2 save

echo "Удаление конфигурации Nginx..."
rm -f /etc/nginx/sites-available/$DOMAIN
rm -f /etc/nginx/sites-enabled/$DOMAIN
nginx -t
systemctl restart nginx

echo "Удаление SSL сертификата..."
certbot delete --cert-name $DOMAIN --non-interactive || echo "Сертификат не найден."

echo "Удаление файлов проекта..."
rm -rf "/var/www/$DOMAIN"
rm -rf "/var/www/ws-$DOMAIN"

echo -e "${GREEN}Проект для домена $DOMAIN был успешно удален.${NC}"
