# MafBoard

Интерактивная веб-панель для ведущего игры "Мафия" с интеграцией в Telegram Web App, авторизацией через Telegram-бота, синхронизацией состояния через WebSocket и загрузкой данных о турнирах.

## ✨ Возможности

-   Управление списком игроков и их ролями.
-   Автоматическое ведение игрового процесса: день, ночь, голосование.
-   Синхронизация в реальном времени между несколькими устройствами через WebSocket.
-   **Авторизация через Telegram** — вход по 4-значному коду или автоматически из Telegram Mini App.
-   Загрузка данных о турнирах с внешнего API.
-   Сохранение и восстановление сессий.
-   Адаптивный дизайн и поддержка тем оформления Telegram.

## ⚙️ Технологии

-   **Фронтенд:** HTML, CSS, JavaScript, Vue.js 2
-   **Бэкенд (WebSocket):** Node.js, ws
-   **API:** PHP 8.2, Medoo (MySQL ORM)
-   **База данных:** MySQL 8
-   **Авторизация:** Telegram Bot API, PHP, Node.js
-   **Сервер:** Nginx, PHP-FPM, PM2, Let's Encrypt

## 📋 Предварительные требования

1.  Чистый сервер с **Ubuntu 22.04 / 24.04**.
2.  Доменное имя, **A-запись** которого указывает на IP-адрес сервера.
3.  **Telegram-бот** — создайте у [@BotFather](https://t.me/BotFather) и сохраните токен и username.

## 🚀 Автоматическая установка

Подключитесь к серверу по SSH и выполните:

```bash
# Клонируем репозиторий
git clone https://github.com/superkai-sdk1/mafboard.git
cd mafboard

# Запускаем скрипт установки
sudo bash install.sh
```

Скрипт в интерактивном режиме запросит:
- **Доменное имя** (например: `titanmafia.pro`)
- **Параметры MySQL** — имя БД, пользователь, пароль (или генерация случайного)
- **Токен и username Telegram-бота**

После чего автоматически выполнит все шаги:

| Шаг | Описание |
|-----|----------|
| 1/8 | Установка Nginx, PHP 8.2 + pdo_mysql, MySQL Server, Certbot |
| 2/8 | Создание БД, пользователя MySQL, всех таблиц (players, auth_sessions, auth_codes) |
| 3/8 | Копирование файлов проекта в `/var/www/<домен>` |
| 4/8 | Генерация `db.php`, `auth-config.php`, настройка `bot.js` |
| 5/8 | Установка Node.js 20 через NVM, npm зависимостей для WebSocket и бота |
| 6/8 | Настройка Nginx (PHP-FPM, WebSocket proxy), получение SSL-сертификата |
| 7/8 | Настройка брандмауэра (UFW) |
| 8/8 | Запуск WebSocket сервера и Telegram-бота через PM2 с автозапуском |

## 🔧 Ручная установка

Если вы предпочитаете контролировать каждый шаг, следуйте этой инструкции.

### 1. Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Установка зависимостей

```bash
sudo add-apt-repository -y ppa:ondrej/php
sudo apt update
sudo apt install -y nginx php8.2-fpm php8.2-mysql php8.2-curl mysql-server \
    python3-certbot-nginx curl git
```

### 3. Настройка MySQL

```bash
# Входим в MySQL
sudo mysql

# Создаём базу данных и пользователя
CREATE DATABASE IF NOT EXISTS webrarium_mafia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'maf_user'@'localhost' IDENTIFIED BY 'ВАШ_ПАРОЛЬ';
GRANT ALL PRIVILEGES ON webrarium_mafia.* TO 'maf_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. Создание таблиц

```bash
sudo mysql webrarium_mafia < webapp/api/mafia.sql
sudo mysql webrarium_mafia < webapp/login/auth-migration.sql
```

### 5. Клонирование проекта

```bash
git clone https://github.com/superkai-sdk1/mafboard.git /var/www/mafboard
sudo chown -R www-data:www-data /var/www/mafboard
```

### 6. Настройка конфигурации

Отредактируйте файл подключения к БД:
```bash
nano /var/www/mafboard/webapp/api/db.php
```
Укажите правильные `database_name`, `username`, `password` и `port`.

Настройте параметры Telegram-бота:
```bash
nano /var/www/mafboard/webapp/login/auth-config.php
```
Укажите `BOT_TOKEN` и `BOT_USERNAME`.

Настройте URL в Telegram-боте:
```bash
nano /var/www/mafboard/webapp/login/bot.js
```
Укажите правильные `BOT_TOKEN` и `CONFIRM_API_URL`.

### 7. Настройка Nginx

```bash
sudo nano /etc/nginx/sites-available/your_domain
```

```nginx
server {
    listen 80;
    server_name your_domain;
    root /var/www/mafboard/webapp;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ $uri.html =404;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }

    location /bridge {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/your_domain /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Установка Node.js и запуск сервисов

```bash
# Установка NVM и Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 20

# WebSocket сервер
cd /var/www/mafboard/websocket
npm install

# Telegram бот
cd /var/www/mafboard/webapp/login
npm install

# Запуск через PM2
npm install pm2 -g
pm2 start /var/www/mafboard/websocket/ws.js --name mafboard-websocket
pm2 start /var/www/mafboard/webapp/login/bot.js --name mafboard-auth-bot
pm2 save
pm2 startup
```

### 9. Получение SSL-сертификата

```bash
sudo certbot --nginx -d your_domain
```

## 📡 Управление сервисами

```bash
pm2 status                  # Статус всех сервисов
pm2 logs                    # Логи в реальном времени
pm2 logs mafboard-auth-bot  # Логи только бота
pm2 restart all             # Перезапуск всех сервисов
pm2 restart mafboard-auth-bot # Перезапуск бота
```

## 🗑️ Удаление

Для полного удаления приложения:

```bash
cd mafboard
sudo bash uninstall.sh
```

Скрипт запросит домен и предложит опционально удалить базу данных MySQL и серверные пакеты.

## 🔐 Система авторизации

Авторизация работает через Telegram-бота:

1. Пользователь открывает панель в браузере.
2. На экране появляется 4-значный код.
3. Пользователь отправляет код боту в Telegram (или переходит по ссылке).
4. Бот подтверждает код через API, создаётся сессия.
5. Панель автоматически авторизуется (polling каждые 2.5 сек).

Если панель открыта как **Telegram Mini App** — авторизация происходит автоматически через `initData`.
