#!/bin/bash

# --- Variables ---
APP_NAME="maf-roles-main"

echo "Начало удаления приложения '$APP_NAME'..."

# --- Source NVM to make sure we can find pm2 ---
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    \. "$NVM_DIR/nvm.sh"
    echo "NVM загружен."
else
    echo "Предупреждение: NVM не найден. Попытка продолжить с системным pm2..."
fi

# --- Stop and Delete Application from PM2 ---
echo "Остановка и удаление процесса '$APP_NAME' из pm2..."
# The `|| true` prevents the script from exiting if the process doesn't exist
pm2 stop "$APP_NAME" || true
pm2 delete "$APP_NAME" || true
echo "Процесс удален."

# --- Remove from Startup ---
# First, save the current (now empty) process list
echo "Сохранение пустого списка процессов pm2..."
pm2 save --force

# Then, unregister pm2 from startup
# This command can sometimes fail if it's already unregistered, so we add `|| true`
echo "Удаление pm2 из автозагрузки..."
pm2 unstartup || true

echo "Удаление завершено."
