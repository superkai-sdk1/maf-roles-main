#!/bin/bash

# ==============================================================================
# СКРИПТ УДАЛЕНИЯ MafBoard (v12)
# ==============================================================================

set -e

# --- Цвета ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# --- Проверяем, что скрипт запущен с правами sudo ---
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Ошибка: Пожалуйста, запустите этот скрипт с правами sudo: sudo bash uninstall.sh${NC}"
    exit 1
fi

# --- Запрашиваем параметры ---
read -p "Введите доменное имя (например: titanmafia.pro): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Ошибка: Домен не может быть пустым.${NC}"
    exit 1
fi

PROJECT_DEST_DIR="/var/www/$DOMAIN"
PHP_VERSION="8.2"

echo ""
read -p "Удалить базу данных MySQL? (y/n) [n]: " DELETE_DB
read -p "Удалить PHP и MySQL серверы? (y/n) [n]: " DELETE_PACKAGES

echo ""
echo -e "${RED}ВНИМАНИЕ: Будут удалены:${NC}"
echo -e "  - Файлы проекта:     ${YELLOW}$PROJECT_DEST_DIR${NC}"
echo -e "  - Конфигурация Nginx: ${YELLOW}$DOMAIN${NC}"
echo -e "  - SSL-сертификат:     ${YELLOW}$DOMAIN${NC}"
    echo -e "  - Сервисы PM2:        ${YELLOW}mafboard-websocket, mafboard-auth-bot${NC}"
if [ "$DELETE_DB" = "y" ] || [ "$DELETE_DB" = "Y" ]; then
    echo -e "  - База данных MySQL:  ${YELLOW}ДА${NC}"
fi
echo ""
read -p "Продолжить удаление? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Удаление отменена."
    exit 0
fi

# --- 1. Остановка и удаление сервисов PM2 ---
echo ""
echo -e "${YELLOW}--- Удаление сервисов PM2 ---${NC}"
export NVM_DIR="/root/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then . "$NVM_DIR/nvm.sh"; fi
if command -v pm2 &> /dev/null; then
    pm2 delete "mafboard-websocket" 2>/dev/null || echo "Info: WebSocket сервис не найден."
    pm2 delete "mafboard-auth-bot" 2>/dev/null || echo "Info: Telegram бот не найден."
    pm2 save --force
    pm2 unstartup 2>/dev/null || echo "Info: Автозапуск не был настроен."
fi

# --- 2. Удаление SSL-сертификата ---
echo -e "${YELLOW}--- Удаление SSL-сертификата ---${NC}"
certbot delete --cert-name "$DOMAIN" --non-interactive 2>/dev/null || echo "Info: Сертификат не найден."

# --- 3. Удаление конфигурации Nginx ---
echo -e "${YELLOW}--- Удаление конфигурации Nginx ---${NC}"
rm -f "/etc/nginx/sites-enabled/$DOMAIN"
rm -f "/etc/nginx/sites-available/$DOMAIN"
systemctl reload nginx

# --- 4. Удаление базы данных ---
if [ "$DELETE_DB" = "y" ] || [ "$DELETE_DB" = "Y" ]; then
    echo -e "${YELLOW}--- Удаление базы данных ---${NC}"
    read -p "Имя базы данных для удаления [webrarium_mafia]: " DB_NAME
    DB_NAME=${DB_NAME:-webrarium_mafia}
    read -p "Имя пользователя MySQL для удаления [maf_user]: " DB_USER
    DB_USER=${DB_USER:-maf_user}

    mysql -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`;" 2>/dev/null || echo "Info: БД не найдена."
    mysql -e "DROP USER IF EXISTS '${DB_USER}'@'localhost';" 2>/dev/null || echo "Info: Пользователь не найден."
    mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true
    echo -e "${GREEN}БД '${DB_NAME}' и пользователь '${DB_USER}' удалены.${NC}"
fi

# --- 5. Удаление файлов проекта ---
echo -e "${YELLOW}--- Удаление файлов проекта ---${NC}"
rm -rf "$PROJECT_DEST_DIR"

# --- 6. Удаление пакетов (опционально) ---
if [ "$DELETE_PACKAGES" = "y" ] || [ "$DELETE_PACKAGES" = "Y" ]; then
    echo -e "${YELLOW}--- Удаление PHP и MySQL ---${NC}"
    apt-get purge -y "php${PHP_VERSION}-fpm" "php${PHP_VERSION}-mysql" "php${PHP_VERSION}-curl" mysql-server 2>/dev/null || true
    add-apt-repository --remove -y ppa:ondrej/php 2>/dev/null || true
    apt-get autoremove -y
fi

echo ""
echo -e "${CYAN}================================================================${NC}"
echo -e "${GREEN}УДАЛЕНИЕ ЗАВЕРШЕНО.${NC}"
echo -e "${CYAN}================================================================${NC}"
