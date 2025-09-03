#!/bin/bash

# ==============================================================================
# СКРИПТ УДАЛЕНИЯ ВЕБ-ПРИЛОЖЕНИЯ И WEBSOCKET-СЕРВЕРА (v4)
# ==============================================================================

set -e

# --- Проверяем, что скрипт запущен с правами sudo ---
if [ "$EUID" -ne 0 ]; then
  echo "Ошибка: Пожалуйста, запустите этот скрипт с правами sudo: sudo bash uninstall.sh"
  exit 1
fi

# --- Запрос домена для корректного удаления конфига Nginx ---
read -p "Введите домен, который вы использовали при установке: " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo "Домен не может быть пустым. Прерывание."
    exit 1
fi

# --- Загружаем nvm, чтобы найти правильный pm2 ---
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    \. "$NVM_DIR/nvm.sh"
fi

# --- 1. Остановка и удаление сервиса PM2 ---
echo "--- Шаг 1/2: Удаление сервиса из PM2 ---"
if command -v pm2 &> /dev/null; then
    pm2 delete "maf-roles-websocket" || echo "Информация: Сервис не найден в pm2."
    pm2 unstartup || echo "Информация: Конфигурация автозапуска не найдена."
    pm2 save --force
else
    echo "Информация: PM2 не найден. Пропускаем."
fi

# --- 2. Удаление конфигурации Nginx ---
echo "--- Шаг 2/2: Удаление конфигурации Nginx ---"
NGINX_CONFIG_SYMLINK="/etc/nginx/sites-enabled/$DOMAIN"
NGINX_CONFIG_AVAILABLE="/etc/nginx/sites-available/$DOMAIN"

if [ -f "$NGINX_CONFIG_SYMLINK" ]; then
    rm "$NGINX_CONFIG_SYMLINK"
    echo "Удалена символическая ссылка Nginx."
fi
if [ -f "$NGINX_CONFIG_AVAILABLE" ]; then
    rm "$NGINX_CONFIG_AVAILABLE"
    echo "Удален файл конфигурации Nginx."
fi

echo "Перезапуск Nginx для применения изменений..."
nginx -t
systemctl reload nginx

echo "================================================================"
echo "УДАЛЕНИЕ ЗАВЕРШЕНО."
echo "================================================================"