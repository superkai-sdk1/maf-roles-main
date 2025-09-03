#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Variables ---
APP_NAME="maf-roles-main"
# Get the directory of the script
APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# --- Prompt for Domain ---
echo "Пожалуйста, введите ваш домен (например, example.com):"
read DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "Ошибка: Домен не может быть пустым."
    exit 1
fi

echo "DOMAIN=$DOMAIN" > "$APP_DIR/.env"
echo "Домен '$DOMAIN' сохранен в .env файл."

# --- Install NVM (Node Version Manager) ---
echo "Установка nvm..."
# Use -s for silent, -o /dev/null to discard the script itself after running
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# --- Source NVM ---
# This makes nvm available in the current script session
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

echo "nvm успешно установлен."

# --- Install Node.js and Set as Default ---
NODE_VERSION="20"
echo "Установка Node.js v$NODE_VERSION через nvm..."
nvm install $NODE_VERSION
nvm use $NODE_VERSION
nvm alias default $NODE_VERSION

echo "Node.js v$(node -v) и npm v$(npm -v) установлены."

# --- Install Project Dependencies ---
echo "Установка зависимостей проекта через npm..."
cd "$APP_DIR"
npm install

echo "Зависимости установлены."

# --- Install and Configure PM2 ---
echo "Установка/обновление pm2..."
npm install -g pm2

echo "Запуск приложения '$APP_NAME' через pm2..."
# Delete any old process with the same name to ensure a clean start
pm2 delete "$APP_NAME" || true
# Start the new process
pm2 start "$APP_DIR/dist/main.js" --name "$APP_NAME"

echo "Настройка автозапуска pm2..."
# This command generates and displays the command to run.
# We need to execute that command.
pm2 startup | tail -n 1 | bash

# Save the current pm2 process list to be resurrected on reboot
pm2 save

echo "Установка завершена! Приложение '$APP_NAME' запущено и настроено на автозапуск."
