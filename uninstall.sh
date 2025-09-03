#!/bin/bash

# Скрипт удаления Maf Roles Panel
# Прекращает выполнение при любой ошибке
set -e

# Цвета для вывода
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

# --- Удаление сервиса PM2 ---
echo "Остановка и удаление WebSocket сервиса..."

# Загружаем NVM, чтобы получить доступ к правильной версии pm2
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    \. "$NVM_DIR/nvm.sh"
else
    echo "NVM не найден. Пропускаем шаги, связанные с Node.js/PM2."
    # Пропускаем следующие команды, если nvm не найден
    set +e # выключаем прерывание по ошибке
fi

if command -v pm2 &> /dev/null; then
    pm2 stop "maf-bridge-$DOMAIN" || echo "Сервис уже остановлен."
    pm2 delete "maf-bridge-$DOMAIN" || echo "Сервис уже удален."
    
    # Удаляем конфигурацию автозапуска
    pm2 unstartup || echo "Не удалось удалить сервис автозагрузки."
    pm2 save --force
    echo "Сервис PM2 и автозагрузка удалены."
else
    echo "Команда pm2 не найдена. Пропускаем."
fi

set -e # Включаем прерывание по ошибке обратно

# --- Удаление остального ---
echo "Удаление конфигурации Nginx..."
rm -f /etc/nginx/sites-available/$DOMAIN
rm -f /etc/nginx/sites-enabled/$DOMAIN
# Проверяем синтаксис перед перезапуском, чтобы не сломать рабочий Nginx
if nginx -t; then
    systemctl restart nginx
else
    echo "Конфигурация Nginx содержит ошибки. Перезапуск отменен."
fi

echo "Удаление SSL сертификата..."
certbot delete --cert-name $DOMAIN --non-interactive || echo "Сертификат не найден или не удалось удалить."

echo "Удаление файлов проекта..."
rm -rf "/var/www/$DOMAIN"
rm -rf "/var/www/ws-$DOMAIN"

echo -e "${GREEN}Проект для домена $DOMAIN был успешно удален.${NC}"
