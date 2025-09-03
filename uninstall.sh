#!/bin/bash

# ==============================================================================
# СКРИПТ УДАЛЕНИЯ (v8 - Финальная версия)
# ==============================================================================

set -e

# --- Переменные ---
DOMAIN="minahor.ru"
PROJECT_DEST_DIR="/var/www/$DOMAIN"

# --- Проверяем, что скрипт запущен с правами sudo ---
if [ "$EUID" -ne 0 ]; then
  echo "Ошибка: Пожалуйста, запустите этот скрипт с правами sudo: sudo bash uninstall.sh"
  exit 1
fi

# --- 1. Остановка и удаление сервиса PM2 ---
echo "--- Удаление сервиса из PM2 ---"
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then . "$NVM_DIR/nvm.sh"; fi
if command -v pm2 &> /dev/null; then
    pm2 unstartup || echo "Info: Автозапуск не был настроен."
    pm2 delete "maf-roles-websocket" || echo "Info: Сервис не найден."
    pm2 save --force
fi

# --- 2. Удаление SSL-сертификата ---
echo "--- Удаление SSL-сертификата ---"
certbot delete --cert-name "$DOMAIN" --non-interactive || echo "Info: Сертификат не найден."

# --- 3. Удаление конфигурации Nginx ---
echo "--- Удаление конфигурации Nginx ---"
rm -f "/etc/nginx/sites-enabled/$DOMAIN"
rm -f "/etc/nginx/sites-available/$DOMAIN"
systemctl reload nginx

# --- 4. Удаление файлов проекта ---
echo "--- Удаление файлов проекта из $PROJECT_DEST_DIR ---"
rm -rf "$PROJECT_DEST_DIR"

echo "================================================================"
echo "УДАЛЕНИЕ ЗАВЕРШЕНО."
echo "================================================================"