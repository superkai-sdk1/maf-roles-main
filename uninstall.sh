#!/bin/bash

# --- Останавливаем скрипт при любой ошибке ---
set -e

# --- Проверяем, что скрипт запущен с правами sudo ---
if [ "$EUID" -ne 0 ]; then
  echo "Пожалуйста, запустите этот скрипт с правами sudo: sudo bash uninstall.sh"
  exit 1
fi

# --- Переменные ---
BACKEND_SERVICE_NAME="maf-roles-websocket"
read -p "Введите домен, который вы использовали при установке (для удаления конфига Nginx): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo "Домен не может быть пустым. Прерывание."
    exit 1
fi

# --- Загрузка nvm, чтобы найти правильный pm2 ---
USER_TO_RUN_NVM=$(logname)
export NVM_DIR="/home/$USER_TO_RUN_NVM/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# --- 1. Остановка и удаление сервиса PM2 ---
echo "--- Удаление сервиса из PM2 ---"
if command -v pm2 &> /dev/null; then
    pm2 stop "$BACKEND_SERVICE_NAME" || echo "Сервис не был запущен."
    pm2 delete "$BACKEND_SERVICE_NAME" || echo "Сервис не найден в pm2."
    pm2 unstartup || echo "Конфигурация автозапуска не найдена."
    pm2 save --force
else
    echo "PM2 не найден. Пропускаем."
fi

# --- 2. Удаление конфигурации Nginx ---
echo "--- Удаление конфигурации Nginx ---"
NGINX_CONFIG_SYMLINK="/etc/nginx/sites-enabled/$DOMAIN"
NGINX_CONFIG_AVAILABLE="/etc/nginx/sites-available/$DOMAIN"

if [ -f "$NGINX_CONFIG_SYMLINK" ]; then
    rm "$NGINX_CONFIG_SYMLINK"
fi
if [ -f "$NGINX_CONFIG_AVAILABLE" ]; then
    rm "$NGINX_CONFIG_AVAILABLE"
fi

echo "--- Перезапуск Nginx ---"
nginx -t
systemctl reload nginx

echo "----------------------------------------------------------------"
echo "УДАЛЕНИЕ ЗАВЕРШЕНО."
echo "Сервис PM2 и конфигурация Nginx для домена $DOMAIN удалены."
echo "Файлы проекта, Nginx, Node.js и nvm не были удалены."
echo "----------------------------------------------------------------"