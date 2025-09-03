#!/bin/bash

# --- Переходим в директорию скрипта, чтобы все пути были правильными ---
cd "$(dirname "$0")" || exit

# --- Переменные ---
WEBSOCKET_DIR="./websocket"
ENV_FILE="$WEBSOCKET_DIR/.env"
SERVICE_NAME="maf-roles-websocket"
NODE_VERSION="20"

# --- Запрос домена ---
if [ -f "$ENV_FILE" ]; then
    # Загружаем домен из файла, если он уже существует
    source "$ENV_FILE"
fi

if [ -z "$DOMAIN" ]; then
    read -p "Введите ваш домен (например, example.com): " DOMAIN
    if [ -z "$DOMAIN" ]; then
        echo "Домен не может быть пустым. Прерывание."
        exit 1
    fi
fi

# --- Установка NVM (Node Version Manager) ---
echo "Установка nvm..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# --- Загрузка nvm в текущую сессию ---
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# --- Проверка, что nvm загружен ---
if ! command -v nvm &> /dev/null
then
    echo "Ошибка: nvm не был загружен. Попробуйте перезапустить терминал и запустить скрипт снова."
    exit 1
fi

# --- Установка Node.js ---
echo "Установка Node.js v$NODE_VERSION..."
nvm install $NODE_VERSION
nvm use $NODE_VERSION
nvm alias default $NODE_VERSION

echo "Проверка версий:"
node -v
npm -v

# --- Создание .env файла ---
echo "Создание файла .env в $WEBSOCKET_DIR..."
mkdir -p "$WEBSOCKET_DIR"
echo "DOMAIN=$DOMAIN" > "$ENV_FILE"
echo "PORT=3000" >> "$ENV_FILE"

# --- Установка зависимостей проекта ---
echo "Установка зависимостей в директории $WEBSOCKET_DIR..."
# Переходим в папку websocket, чтобы npm нашел package.json
cd "$WEBSOCKET_DIR" || exit
npm install
cd ..

# --- Установка и настройка PM2 ---
echo "Установка и настройка pm2..."
npm install pm2 -g

# Удаляем старый сервис, если он существует
pm2 delete "$SERVICE_NAME" || true

# Запускаем новый сервис из основной директории проекта
pm2 start "$WEBSOCKET_DIR/server.js" --name "$SERVICE_NAME"

# Сохраняем конфигурацию для автозапуска
pm2 save

# Генерируем команду для настройки автозапуска
pm2 startup

echo "----------------------------------------------------------------"
echo "Установка почти завершена!"
echo "Сервис '$SERVICE_NAME' запущен."
echo "Чтобы настроить автозапуск, скопируйте команду, которую вывел pm2 выше, и выполните ее."
echo "----------------------------------------------------------------"