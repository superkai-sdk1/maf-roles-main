#!/bin/bash

# --- Переменные ---
SERVICE_NAME="maf-roles-websocket"

# --- Загрузка nvm, чтобы найти правильный pm2 ---
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# --- Проверка, существует ли pm2 ---
if ! command -v pm2 &> /dev/null
then
    echo "pm2 не найден."
else
    echo "Остановка и удаление сервиса $SERVICE_NAME из pm2..."
    pm2 stop "$SERVICE_NAME" || echo "Сервис не был запущен."
    pm2 delete "$SERVICE_NAME" || echo "Сервис не найден в pm2."

    echo "Удаление конфигурации автозапуска pm2..."
    pm2 unstartup || echo "Конфигурация автозапуска не найдена."
    pm2 save --force
fi

echo "Удаление завершено."